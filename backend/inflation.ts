/**
 * inflation.ts — inflacja GUS i spadek siły nabywczej od dnia zakupu.
 *
 * Źródło: API DBW GUS (https://api-dbw.stat.gov.pl/apidocs/), bez klucza.
 * Zmienna 305 „Wskaźniki cen towarów i usług konsumpcyjnych”, miara 8
 * „grudzień roku poprzedniego = 100” (np. wrzesień 2026: 103,7 = ceny +3,7% od grudnia 2025).
 * Te same przekroje i pozycje „ogółem” czyta aplikacja portfel
 * (`portfel/backend/app/services/reference_data.py`, tam miara 5 = r/r).
 *
 * Czemu nie miara 2 („miesiąc poprzedni = 100”): GUS zaokrągla każdy miesiąc do 0,1,
 * a iloczyn 12 zaokrąglonych miesięcy 2025 dał 2,32% zamiast oficjalnych 2,4%.
 * Z miary 8 składamy ciągły poziom cen (grudzień każdego roku = baza następnego),
 * więc zaokrąglenie działa tylko na końcach okresu, a nie co miesiąc.
 *
 * Opublikowane miesiące się nie zmieniają, więc trzymamy je w `cpi-ytd.json`
 * w DATA_DIR i dociągamy tylko brakujące.
 */
import { promises as fs } from 'fs';
import path from 'path';

const DBW_BASE = 'https://api-dbw.stat.gov.pl/api';
const CPI_VARIABLE = 305;
const MIARA_OD_GRUDNIA = 8;
const POZYCJA_GOSPODARSTWA_OGOLEM = 6902025;
// [rok_od, rok_do, id-przekroj, id-pozycja „0 - OGÓŁEM” towarów i usług]
const PRZEKROJE: [number, number, number, number][] = [
  [2014, 2025, 909, 7215815],     // COICOP 1999
  [2026, 9999, 1722, 14916914],   // COICOP 2018, od 2026
];
// Limit anonimowy DBW: 5 zapytań/s, 100 na 15 min.
const PAUZA_MS = 300;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CACHE_FILE = path.join(DATA_DIR, 'cpi-ytd.json');

/** Klucz "RRRR-MM" → ceny względem grudnia roku poprzedniego, jako mnożnik (103,7 → 1.037). */
export type CpiYtd = Record<string, number>;

const klucz = (rok: number, miesiac: number) => `${rok}-${String(miesiac).padStart(2, '0')}`;

function nastepny(rok: number, miesiac: number): [number, number] {
  return miesiac === 12 ? [rok + 1, 1] : [rok, miesiac + 1];
}

/** Dzisiejsza data w czasie polskim jako [rok, miesiąc, dzień]. */
export function dzisPL(now = new Date()): [number, number, number] {
  const [r, m, d] = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }).split('-').map(Number);
  return [r, m, d];
}

/**
 * Wskaźnik „od grudnia” za jeden miesiąc. `null` = GUS jeszcze go nie opublikował.
 * Błąd sieci albo nieznany rok rzuca wyjątek — nie udajemy, że inflacji nie było.
 */
async function pobierzMiesiac(rok: number, miesiac: number): Promise<number | null> {
  const przekroj = PRZEKROJE.find(([od, doRoku]) => rok >= od && rok <= doRoku);
  if (!przekroj) throw new Error(`Brak mapy przekrojów GUS dla roku ${rok} — uzupełnij PRZEKROJE w inflation.ts`);
  const [, , idPrzekroj, ogolemTowary] = przekroj;
  const params = new URLSearchParams({
    'id-zmienna': String(CPI_VARIABLE),
    'id-przekroj': String(idPrzekroj),
    'id-rok': String(rok),
    'id-okres': String(246 + miesiac), // M01 = 247 … M12 = 258
    'ile-na-stronie': '5000',
    'numer-strony': '0',
    lang: 'pl',
  });
  let res: Response | null = null;
  for (let proba = 0; proba < 3; proba++) {
    await new Promise((r) => setTimeout(r, PAUZA_MS * (proba === 0 ? 1 : 10 * proba)));
    res = await fetch(`${DBW_BASE}/variable/variable-data-section?${params}`, {
      headers: { 'User-Agent': 'market_info/1.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (res.status !== 429) break;
  }
  res = res!;
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GUS DBW HTTP ${res.status} dla ${klucz(rok, miesiac)}`);
  const body = (await res.json()) as { data?: Record<string, unknown>[] };
  const rows = body.data ?? [];
  if (rows.length === 0) return null;
  const row = rows.find((r) => {
    const poz = [r['id-pozycja-1'], r['id-pozycja-2'], r['id-pozycja-3']];
    return r['id-sposob-prezentacji-miara'] === MIARA_OD_GRUDNIA
      && poz.includes(ogolemTowary) && poz.includes(POZYCJA_GOSPODARSTWA_OGOLEM);
  });
  if (!row) throw new Error(`GUS DBW: brak wiersza „ogółem, grudzień=100” dla ${klucz(rok, miesiac)} — zmienił się układ danych?`);
  const wartosc = Number(row['wartosc']);
  if (!Number.isFinite(wartosc) || wartosc < 80 || wartosc > 130) {
    throw new Error(`GUS DBW: podejrzana wartość ${row['wartosc']} dla ${klucz(rok, miesiac)}`);
  }
  return wartosc / 100;
}

async function wczytajCache(): Promise<CpiYtd> {
  try {
    return JSON.parse(await fs.readFile(CACHE_FILE, 'utf-8')) as CpiYtd;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error(`Nie da się odczytać ${CACHE_FILE}: ${(e as Error).message} — napraw albo skasuj plik`);
  }
}

async function zapiszCache(dane: CpiYtd): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${CACHE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(dane, null, 2), 'utf-8');
  await fs.rename(tmp, CACHE_FILE);
}

export interface CpiData {
  /** Poziom cen na koniec miesiąca "RRRR-MM"; grudzień roku przed `odRok` = 1. */
  level: Record<string, number>;
  /** Ostatni opublikowany miesiąc "RRRR-MM" (null, gdy brak jakichkolwiek danych od `odRok`). */
  lastPublished: string | null;
}

/**
 * Poziom cen od stycznia `odRok` do ostatniego opublikowanego miesiąca.
 * Bieżący miesiąc nigdy nie ma danych, więc kończymy najpóźniej na poprzednim.
 */
export async function pobierzInflacje(odRok: number, now = new Date()): Promise<CpiData> {
  const ytd = await wczytajCache();
  const [rokDzis, miesiacDzis] = dzisPL(now);
  const level: Record<string, number> = { [klucz(odRok - 1, 12)]: 1 };
  let baza = 1; // poziom grudnia poprzedniego roku
  let [r, m] = [odRok, 1];
  let lastPublished: string | null = null;
  let zmiany = false;
  try {
    while (r < rokDzis || (r === rokDzis && m < miesiacDzis)) {
      const k = klucz(r, m);
      if (ytd[k] === undefined) {
        const wartosc = await pobierzMiesiac(r, m);
        if (wartosc === null) break; // GUS jeszcze nie podał — dalsze miesiące też nie
        ytd[k] = wartosc;
        zmiany = true;
      }
      level[k] = baza * ytd[k];
      if (m === 12) baza = level[k];
      lastPublished = k;
      [r, m] = nastepny(r, m);
    }
  } finally {
    // Zapisz to, co już pobrane — po błędzie następna próba zacznie od brakującego miesiąca.
    if (zmiany) await zapiszCache(ytd);
  }
  // Ani jednego miesiąca, choć od stycznia `odRok` minęły już ponad 2 — to awaria źródła
  // (zmienione API/przekrój), nie brak publikacji. Bez tego raport cicho liczyłby bez inflacji.
  const minelo = (rokDzis - odRok) * 12 + (miesiacDzis - 1);
  if (lastPublished === null && minelo > 2) {
    throw new Error(`GUS DBW nie zwrócił żadnych danych od ${klucz(odRok, 1)} — sprawdź API/przekroje w inflation.ts`);
  }
  return { level, lastPublished };
}

/**
 * Skumulowany wzrost cen od dnia zakupu do dziś, jako mnożnik (1.05 = ceny +5%).
 *
 * - Miesiąc zakupu liczy się tylko w części: od dnia zakupu do końca miesiąca
 *   (wzrost cen w tym miesiącu podniesiony do potęgi pozostałe_dni / dni_w_miesiącu).
 *   Zakup 1. dnia bierze cały miesiąc, zakup 30. — prawie nic.
 * - Kolejne miesiące — w całości, do ostatniego opublikowanego przez GUS.
 * - Miesiące, za które GUS jeszcze nie podał danych — inflacja 0.
 */
export function wzrostCenOd(dataZakupu: string, cpi: CpiData): number {
  const [rz, mz, dz] = dataZakupu.slice(0, 10).split('-').map(Number);
  const kZakupu = klucz(rz, mz);
  if (cpi.lastPublished === null || kZakupu > cpi.lastPublished) return 1;
  const [rp, mp] = mz === 1 ? [rz - 1, 12] : [rz, mz - 1];
  const przed = cpi.level[klucz(rp, mp)];
  const poZakupie = cpi.level[kZakupu];
  const koniec = cpi.level[cpi.lastPublished];
  if (przed === undefined || poZakupie === undefined || koniec === undefined) {
    throw new Error(`Brak poziomu cen GUS dla zakupu ${dataZakupu} — dane pobrane od złego roku?`);
  }
  const dniWMiesiacu = new Date(Date.UTC(rz, mz, 0)).getUTCDate();
  const czesc = (dniWMiesiacu - dz + 1) / dniWMiesiacu;
  return Math.pow(poZakupie / przed, czesc) * (koniec / poZakupie);
}
