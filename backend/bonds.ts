/**
 * bonds.ts — raport obligacji „po inflacji” na Telegram.
 *
 * Dla każdego zakupu: ile dostałbym na rękę przy wykupie dziś (po karze za wcześniejszy
 * wykup i po Belce — liczy to portfel) i ile to jest warte w pieniądzu z dnia zakupu
 * (inflacja GUS od dnia zakupu, patrz `wzrostCenOd` w inflation.ts).
 * Bez płatnych API.
 *
 * Wysyła bot news-brief (@mynews_claude_bot): pobiera GET /api/bonds/messages na komendę
 * /obligacje i w niedzielę o 18:00 (poller.mjs w repo news-brief).
 */
import { pobierzZakupyObligacji } from './portfelClient';
import { pobierzInflacje, wzrostCenOd, dzisPL } from './inflation';

export interface BondRow {
  ticker: string;
  date: string;
  quantity: number;
  paid: number;          // wpłacono = 100 zł × sztuki
  exitNet: number;       // wykup na rękę dziś + kupony już wypłacone (po Belce)
  coupons: number;       // w tym kupony już wypłacone (po Belce)
  inflationPct: number;  // wzrost cen od dnia zakupu, %
  realValue: number;     // wykup na rękę w pieniądzu z dnia zakupu
  realGain: number;      // realValue − paid
  realGainPct: number;
  holdNet: number;       // bez kary (gdy trzymasz dalej): wartość dziś po Belce + kupony
  holdReal: number;      // to samo w pieniądzu z dnia zakupu
  holdGain: number;      // holdReal − paid
  holdGainPct: number;
  maturity: string | null; // dzień wykupu bez kary, RRRR-MM-DD
  partlyRedeemed: boolean;
}

export interface BondsReport {
  rows: BondRow[];
  totals: {
    paid: number; exitNet: number; realValue: number; realGain: number; realGainPct: number;
    holdNet: number; holdReal: number; holdGain: number; holdGainPct: number;
  };
  cpiThrough: string | null;  // ostatni miesiąc z danymi GUS, "RRRR-MM"
  cpiStale: boolean;          // dane GUS starsze niż 2 miesiące — coś nie tak ze źródłem
}

const MIESIACE = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec',
  'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

const zl = (x: number) => x.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
const pct = (x: number) => x.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const zeZnakiem = (x: number, f: (n: number) => string) => (x >= 0 ? '+' : '−') + f(Math.abs(x));
const szt = (q: number) => (Number.isInteger(q) ? String(q) : q.toLocaleString('pl-PL', { maximumFractionDigits: 2 }));
const dataPL = (iso: string) => iso.split('-').reverse().join('.');
/**
 * Dzień wykupu bez kary: miesiąc i rok z nazwy serii (ROD1237 → 12.2037), dzień z daty zakupu —
 * obligacje detaliczne zapadają w rocznicę zakupu (ROR0527 kupiona 9.05.2026 → 9.05.2027).
 */
export function dataWykupu(ticker: string, dataZakupu: string): string | null {
  const m = /^[A-Z]{3}(\d{2})(\d{2})$/.exec(ticker);
  if (!m) return null;
  const miesiac = Number(m[1]);
  const rok = 2000 + Number(m[2]);
  if (miesiac < 1 || miesiac > 12) return null;
  const dni = new Date(Date.UTC(rok, miesiac, 0)).getUTCDate();
  const dzien = Math.min(Number(dataZakupu.slice(8, 10)), dni);
  return `${rok}-${String(miesiac).padStart(2, '0')}-${String(dzien).padStart(2, '0')}`;
}

const miesiacPL = (ym: string) => `${MIESIACE[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export async function buildBondsReport(now = new Date()): Promise<BondsReport> {
  const zakupy = await pobierzZakupyObligacji();
  const rows: BondRow[] = [];
  let cpiThrough: string | null = null;

  if (zakupy.length > 0) {
    const cpi = await pobierzInflacje(Number(zakupy[0].date.slice(0, 4)), now);
    cpiThrough = cpi.lastPublished;
    for (const z of zakupy) {
      const wzrost = wzrostCenOd(z.date, cpi);
      const paid = 100 * z.quantity;
      // Kupony już wypłacone (COI/ROR/DOR) są częścią tego, co inwestycja dała — bez nich
      // seria kuponowa wychodzi na fałszywą stratę. Uproszczenie: dzielimy je przez inflację
      // od dnia zakupu, choć wpłynęły później — to lekko zaniża ich wartość realną.
      const naReke = z.exitNetValue + z.paidCouponsNet;
      const realValue = naReke / wzrost;
      const holdNet = z.netValue + z.paidCouponsNet;
      const holdReal = holdNet / wzrost;
      rows.push({
        ticker: z.ticker,
        date: z.date,
        quantity: z.quantity,
        paid,
        exitNet: naReke,
        coupons: z.paidCouponsNet,
        inflationPct: (wzrost - 1) * 100,
        realValue,
        realGain: realValue - paid,
        realGainPct: paid > 0 ? ((realValue - paid) / paid) * 100 : 0,
        holdNet,
        holdReal,
        holdGain: holdReal - paid,
        holdGainPct: paid > 0 ? ((holdReal - paid) / paid) * 100 : 0,
        maturity: dataWykupu(z.ticker, z.date),
        partlyRedeemed: z.partlyRedeemed,
      });
    }
  }

  const sum = (f: (r: BondRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const paid = sum((r) => r.paid);
  const realValue = sum((r) => r.realValue);
  const holdReal = sum((r) => r.holdReal);

  // GUS publikuje miesiąc ok. 15. dnia następnego — więc normalnie brakuje najwyżej 2 miesięcy.
  const [rokDzis, miesiacDzis] = dzisPL(now);
  const brakujace = cpiThrough
    ? (rokDzis - Number(cpiThrough.slice(0, 4))) * 12 + (miesiacDzis - Number(cpiThrough.slice(5, 7)))
    : 0;

  return {
    rows,
    totals: {
      paid,
      exitNet: sum((r) => r.exitNet),
      realValue,
      realGain: realValue - paid,
      realGainPct: paid > 0 ? ((realValue - paid) / paid) * 100 : 0,
      holdNet: sum((r) => r.holdNet),
      holdReal,
      holdGain: holdReal - paid,
      holdGainPct: paid > 0 ? ((holdReal - paid) / paid) * 100 : 0,
    },
    cpiThrough,
    cpiStale: brakujace > 2,
  };
}

/** Treść raportu jako wiadomości Telegram (HTML), każda poniżej limitu ~4096 znaków. */
export function formatBondsReport(rep: BondsReport): string[] {
  const head = [
    '🏦 <b>Obligacje — ile są warte dziś po inflacji</b>',
    '<i>Na rękę = wykup dziś, po karze za wcześniejszy wykup i po Belce 19%. '
      + 'Bez kary = ile jest warta dziś, gdy trzymasz dalej (kara znika w dniu wykupu). '
      + 'Realnie = w pieniądzu z dnia zakupu.</i>',
    rep.cpiThrough
      ? `Inflacja GUS do: <b>${miesiacPL(rep.cpiThrough)}</b>; późniejsze dni liczone bez inflacji.`
      : 'Inflacja GUS: brak opublikowanych danych od dnia zakupu — liczone bez inflacji.',
  ];
  if (rep.cpiStale) head.push('⚠️ <b>Dane GUS są starsze niż 2 miesiące — sprawdź źródło, wynik realny jest zawyżony.</b>');
  if (rep.rows.length === 0) return [[...head, '', 'Brak obligacji w portfelu.'].join('\n')];

  const bloki = rep.rows.map((r) => [
    `<b>${r.ticker}</b> · ${dataPL(r.date)} · ${szt(r.quantity)} szt.${r.partlyRedeemed ? ' (część umorzona)' : ''}`,
    `Wpłacono ${zl(r.paid)} → na rękę ${zl(r.exitNet)}`
      + (r.coupons > 0.005 ? ` (w tym wypłacone kupony ${zl(r.coupons)})` : ''),
    `Inflacja od zakupu ${pct(r.inflationPct)} → realnie ${zl(r.realValue)} `
      + `(${zeZnakiem(r.realGain, zl)}, ${zeZnakiem(r.realGainPct, pct)}) ${r.realGain >= 0 ? '🟢' : '🔴'}`,
    `Bez kary: ${zl(r.holdNet)} → realnie ${zl(r.holdReal)} `
      + `(${zeZnakiem(r.holdGain, zl)}, ${zeZnakiem(r.holdGainPct, pct)}) ${r.holdGain >= 0 ? '🟢' : '🔴'}`
      + (r.maturity ? ` · wykup ${dataPL(r.maturity)}` : ''),
  ].join('\n'));

  const t = rep.totals;
  const stopka = [
    '<b>Razem</b>',
    `Wpłacono ${zl(t.paid)} → na rękę ${zl(t.exitNet)}`,
    `Realnie ${zl(t.realValue)} (${zeZnakiem(t.realGain, zl)}, ${zeZnakiem(t.realGainPct, pct)})`,
    `Bez kary: ${zl(t.holdNet)} → realnie ${zl(t.holdReal)} (${zeZnakiem(t.holdGain, zl)}, ${zeZnakiem(t.holdGainPct, pct)})`,
  ].join('\n');

  const LIMIT = 3800;
  const out: string[] = [];
  let cur = head.join('\n');
  for (const b of [...bloki, stopka]) {
    if (cur.length + b.length + 2 > LIMIT) { out.push(cur); cur = b; } else { cur += '\n\n' + b; }
  }
  out.push(cur);
  return out;
}
