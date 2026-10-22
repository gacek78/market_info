/**
 * bonds.ts — raport obligacji „po inflacji” na Telegram.
 *
 * Dla każdego zakupu: ile dostałbym na rękę przy wykupie dziś (po karze za wcześniejszy
 * wykup i po Belce — liczy to portfel) i ile to jest warte w pieniądzu z dnia zakupu
 * (inflacja GUS od dnia zakupu, patrz `wzrostCenOd` w inflation.ts).
 * Bez płatnych API.
 *
 * Wysyła bot market_info: komenda /obligacje i BONDS_CRON (domyślnie niedziela 18:00),
 * patrz sendBondsReport w telegramCommands.ts.
 */
import { pobierzZakupyObligacji, pobierzPrognozeObligacji, BondProjection } from './portfelClient';
import { pobierzInflacje, wzrostCenOd, dzisPL } from './inflation';

/** Przewidywany dzień, w którym wykup na rękę dogoni inflację (null = nie przed wykupem). */
export interface ExitBreakEven {
  date: string;        // RRRR-MM-DD
  atMaturity: boolean; // dopiero w dniu wykupu, gdy kary już nie ma
}

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
  /** Tylko dla zakupów na realnej stracie przy wykupie dziś; undefined = nie dotyczy albo brak prognozy. */
  exitBreakEven?: ExitBreakEven | null;
}

export interface BondsReport {
  rows: BondRow[];
  totals: {
    paid: number; exitNet: number; realValue: number; realGain: number; realGainPct: number;
    holdNet: number; holdReal: number; holdGain: number; holdGainPct: number;
  };
  cpiThrough: string | null;  // ostatni miesiąc z danymi GUS, "RRRR-MM"
  cpiStale: boolean;          // dane GUS starsze niż 2 miesiące — coś nie tak ze źródłem
  /** Założenie prognozy wyjścia ze straty: CPI r/r z ostatniego odczytu GUS (wg portfela). */
  projection: { assumedCpi: number; cpiMonth: string } | null;
  projectionError: string | null; // prognoza nie wyszła — raport idzie dalej bez niej
}

const DZIEN_MS = 86_400_000;
const isoDzien = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const msDnia = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** Od kiedy inflacja jest szacowana, nie zmierzona: dzień po ostatnim miesiącu GUS albo dzień zakupu, jeśli późniejszy. */
function startSzacunku(dataZakupu: string, cpiThrough: string | null): number {
  const poGus = cpiThrough
    ? Date.UTC(Number(cpiThrough.slice(0, 4)), Number(cpiThrough.slice(5, 7)), 1) // 1. dzień następnego miesiąca
    : msDnia(dataZakupu);
  return Math.max(poGus, msDnia(dataZakupu));
}

/** Wzrost cen od `start` do `ms` przy stałej inflacji `cpi` r/r (1 = brak wzrostu). */
const wzrostStaly = (cpi: number, start: number, ms: number) =>
  Math.pow(1 + cpi, Math.max(0, ms - start) / DZIEN_MS / 365);

/**
 * Pierwszy dzień, w którym wykup na rękę (z kuponami) jest realnie wart co najmniej wpłatę.
 * Inflacja do ostatniego miesiąca GUS — zmierzona (`wzrost`), potem stała `assumedCpi` r/r
 * (od `startSzacunku`). Między tygodniowymi punktami portfela — interpolacja liniowa
 * (odsetki rosną liniowo, więc błąd to grosze).
 */
function wyjscieZeStraty(
  paid: number, naRekeDzis: number, dataZakupu: string, wzrost: number,
  cpiThrough: string | null, punkty: { date: string; value: number }[],
  assumedCpi: number, dzis: string,
): ExitBreakEven | null {
  const startStalej = startSzacunku(dataZakupu, cpiThrough);
  const nadwyzka = (ms: number, value: number) =>
    value / (wzrost * wzrostStaly(assumedCpi, startStalej, ms)) - paid;

  let prevMs = msDnia(dzis);
  let prev = nadwyzka(prevMs, naRekeDzis);
  if (prev >= 0) return { date: dzis, atMaturity: false };
  for (let i = 0; i < punkty.length; i++) {
    const ms = msDnia(punkty[i].date);
    const r = nadwyzka(ms, punkty[i].value);
    if (r >= 0) {
      if (i === punkty.length - 1) return { date: punkty[i].date, atMaturity: true };
      const dni = Math.ceil(((ms - prevMs) / DZIEN_MS) * (-prev / (r - prev)));
      return { date: isoDzien(prevMs + dni * DZIEN_MS), atMaturity: false };
    }
    prevMs = ms;
    prev = r;
  }
  return null;
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
  const [zakupy, prognoza] = await Promise.all([
    pobierzZakupyObligacji(),
    pobierzPrognozeObligacji().catch((e: Error) => e),
  ]);
  const rows: BondRow[] = [];
  let cpiThrough: string | null = null;
  if (prognoza instanceof Error) console.error('[Obligacje] Prognoza z portfela nieudana:', prognoza.message);
  const progn: BondProjection | null = prognoza instanceof Error ? null : prognoza;
  const [rd, md, dd] = dzisPL(now);
  const dzis = `${rd}-${String(md).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

  if (zakupy.length > 0) {
    const cpi = await pobierzInflacje(Number(zakupy[0].date.slice(0, 4)), now);
    cpiThrough = cpi.lastPublished;
    for (const z of zakupy) {
      const wzrostGus = wzrostCenOd(z.date, cpi);
      // Miesiące, których GUS jeszcze nie ogłosił: szacunek z ostatniego odczytu r/r — ten sam,
      // którego używa prognoza wyjścia ze straty, żeby obie liczby szły tą samą miarą.
      // Bez prognozy (portfel nie odpowiedział) zostaje 0% i nagłówek to mówi.
      const wzrost = progn
        ? wzrostGus * wzrostStaly(progn.assumedCpi, startSzacunku(z.date, cpiThrough), msDnia(dzis))
        : wzrostGus;
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
        exitBreakEven: realValue < paid && progn?.points.has(z.key)
          ? wyjscieZeStraty(paid, naReke, z.date, wzrostGus, cpiThrough, progn.points.get(z.key)!, progn.assumedCpi, dzis)
          : undefined,
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
    projection: progn ? { assumedCpi: progn.assumedCpi, cpiMonth: progn.cpiMonth } : null,
    projectionError: prognoza instanceof Error ? prognoza.message : null,
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
      ? `Inflacja GUS do: <b>${miesiacPL(rep.cpiThrough)}</b>; `
        + (rep.projection
          ? `późniejsze dni — szacunek ${pct(rep.projection.assumedCpi * 100)} rok do roku (ostatni odczyt GUS).`
          : 'późniejsze dni liczone bez inflacji (prognoza niedostępna).')
      : rep.projection
        ? `Inflacja GUS: brak opublikowanych danych od dnia zakupu — szacunek ${pct(rep.projection.assumedCpi * 100)} rok do roku.`
        : 'Inflacja GUS: brak opublikowanych danych od dnia zakupu — liczone bez inflacji.',
  ];
  if (rep.cpiStale) head.push('⚠️ <b>Dane GUS są starsze niż 2 miesiące — sprawdź źródło, wynik realny jest zawyżony.</b>');
  if (rep.projection) {
    head.push(`<i>Wyjście ze straty = dzień, od którego wykup na rękę dogoni inflację. Prognoza zakłada, `
      + `że inflacja zostanie na poziomie ${pct(rep.projection.assumedCpi * 100)} rok do roku `
      + `(ostatni odczyt GUS: ${miesiacPL(rep.projection.cpiMonth)}).</i>`);
  } else if (rep.projectionError) {
    head.push(`⚠️ Prognoza wyjścia ze straty niedostępna: ${rep.projectionError.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`);
  }
  const wyjscie = (r: BondRow): string[] => {
    if (r.exitBreakEven === undefined) return [];
    if (r.exitBreakEven === null) return ['⏳ Wyjście ze straty: przy tej inflacji nie dogoni jej nawet do dnia wykupu'];
    if (r.exitBreakEven.atMaturity) return [`⏳ Wyjście ze straty: dopiero w dniu wykupu ${dataPL(r.exitBreakEven.date)}`];
    return [`⏳ Wyjście ze straty przy wykupie: ok. <b>${dataPL(r.exitBreakEven.date)}</b>`];
  };
  if (rep.rows.length === 0) return [[...head, '', 'Brak obligacji w portfelu.'].join('\n')];

  const bloki = rep.rows.map((r) => [
    `<b>${r.ticker}</b> · ${dataPL(r.date)} · ${szt(r.quantity)} szt.${r.partlyRedeemed ? ' (część umorzona)' : ''}`,
    `Wpłacono ${zl(r.paid)} → na rękę ${zl(r.exitNet)}`
      + (r.coupons > 0.005 ? ` (w tym wypłacone kupony ${zl(r.coupons)})` : ''),
    `Inflacja od zakupu ${pct(r.inflationPct)} → realnie ${zl(r.realValue)} `
      + `(${zeZnakiem(r.realGain, zl)}, ${zeZnakiem(r.realGainPct, pct)}) ${r.realGain >= 0 ? '🟢' : '🔴'}`,
    ...wyjscie(r),
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
