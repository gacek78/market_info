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
  partlyRedeemed: boolean;
}

export interface BondsReport {
  rows: BondRow[];
  totals: { paid: number; exitNet: number; realValue: number; realGain: number; realGainPct: number };
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
        partlyRedeemed: z.partlyRedeemed,
      });
    }
  }

  const sum = (f: (r: BondRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const paid = sum((r) => r.paid);
  const realValue = sum((r) => r.realValue);

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
      + 'Realnie = to samo w pieniądzu z dnia zakupu.</i>',
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
  ].join('\n'));

  const t = rep.totals;
  const stopka = [
    '<b>Razem</b>',
    `Wpłacono ${zl(t.paid)} → na rękę ${zl(t.exitNet)}`,
    `Realnie ${zl(t.realValue)} (${zeZnakiem(t.realGain, zl)}, ${zeZnakiem(t.realGainPct, pct)})`,
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
