import { promises as fs } from 'fs';
import path from 'path';
import { ETF, Influencer, LastScan, MarketSignal, PortfolioSummary } from './types';
import { TRACKED_ETFS, DEFAULT_INFLUENCERS, DEFAULT_STRATEGY } from './constants';

/**
 * TRWAŁY STAN APLIKACJI
 *
 * Dane (ETF-y, influencerzy, historia wysłanych alertów) są zapisywane do
 * pliku JSON na dysku, dzięki czemu PRZEŻYWAJĄ restart backendu. W docker-compose
 * katalog backendu jest zamontowany jako wolumen, więc plik trwa między
 * uruchomieniami kontenera.
 */

interface PersistedState {
  etfs: ETF[];
  influencers: Influencer[];
  /** Klucze już wysłanych alertów (dedup powiadomień Telegram). */
  sentAlertKeys: string[];
  /** Ostatnio wykryte sygnały (lekka historia / podgląd). */
  recentSignals: MarketSignal[];
  /** Opis strategii inwestora — wejście do podsumowania portfelowego. */
  strategy: string;
  /** Ostatnio wygenerowane podsumowanie portfelowe (do szybkiego podglądu). */
  lastSummary: PortfolioSummary | null;
  /** Ostatni pełny skan (reużywany przez POST /api/summary, gdy świeży). */
  lastScan: LastScan | null;
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const USAGE_FILE = path.join(DATA_DIR, 'gemini-usage.json');

/**
 * Zapis przez plik tymczasowy i `rename`. `writeFile` najpierw ucina plik, a potem
 * dopisuje — kontener ubity w tym oknie zostawiał obcięty JSON, po którym stan
 * wracał do domyślnego (czyli licznik wywołań do zera). `rename` jest niepodzielny.
 */
async function zapiszAtomowo(plik: string, tresc: string): Promise<void> {
  const tmp = `${plik}.tmp`;
  await fs.writeFile(tmp, tresc, 'utf-8');
  await fs.rename(tmp, plik);
}

let state: PersistedState | null = null;
let loading: Promise<PersistedState> | null = null;
let writeLock: Promise<void> = Promise.resolve();

function defaultState(): PersistedState {
  return {
    etfs: [...TRACKED_ETFS],
    influencers: [...DEFAULT_INFLUENCERS],
    sentAlertKeys: [],
    recentSignals: [],
    strategy: DEFAULT_STRATEGY,
    lastSummary: null,
    lastScan: null,
  };
}

async function load(): Promise<PersistedState> {
  if (state) return state;
  // Buforujemy obietnicę, nie wynik: dwa równoległe żądania na zimnym starcie
  // czytały plik niezależnie i drugie nadpisywało stan pierwszego — licznik
  // wywołań potrafił się przez to cofnąć.
  if (!loading) loading = wczytajZDysku();
  return loading;
}

async function wczytajZDysku(): Promise<PersistedState> {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    state = { ...defaultState(), ...parsed };
  } catch (e: any) {
    // Pierwszy start to normalka. Uszkodzony plik to NIE normalka — kasuje ETF-y,
    // strategię i klucze dedupu, więc musi zostawić ślad w logu.
    if (e?.code !== 'ENOENT') {
      console.error('[State] Nie udało się wczytać state.json — startuję od domyślnych:', e?.message ?? e);
    }
    state = defaultState();
    await persist();
  }
  return state;
}

async function persist(): Promise<void> {
  if (!state) return;
  const snapshot = JSON.stringify(state, null, 2);
  // Serializujemy zapisy, żeby uniknąć wyścigu przy równoległych żądaniach.
  // `.catch` przed `.then`: bez tego jeden nieudany zapis (brak miejsca, prawa)
  // zostawiał łańcuch w stanie odrzuconym i nic już się nie zapisywało.
  writeLock = writeLock.catch(() => undefined).then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await zapiszAtomowo(STATE_FILE, snapshot);
  });
  return writeLock;
}

// ─── ETF-y ───────────────────────────────────────────────────────────────────
export const getEtfsOnServer = async (): Promise<ETF[]> => {
  return (await load()).etfs;
};

export const saveEtfOnServer = async (etf: ETF): Promise<void> => {
  const s = await load();
  if (!s.etfs.find((e) => e.ticker === etf.ticker)) {
    s.etfs.push(etf);
    await persist();
  }
};

export const deleteEtfOnServer = async (ticker: string): Promise<void> => {
  const s = await load();
  s.etfs = s.etfs.filter((e) => e.ticker !== ticker);
  await persist();
};

// ─── Influencerzy ──────────────────────────────────────────────────────────────
export const getInfluencersOnServer = async (): Promise<Influencer[]> => {
  return (await load()).influencers;
};

export const saveInfluencerOnServer = async (influencer: Influencer): Promise<void> => {
  const s = await load();
  if (!s.influencers.find((i) => i.handle === influencer.handle)) {
    s.influencers.push(influencer);
    await persist();
  }
};

export const deleteInfluencerOnServer = async (handle: string): Promise<void> => {
  const s = await load();
  s.influencers = s.influencers.filter((i) => i.handle !== handle);
  await persist();
};

export const resetInfluencersOnServer = async (): Promise<Influencer[]> => {
  const s = await load();
  s.influencers = [...DEFAULT_INFLUENCERS];
  await persist();
  return s.influencers;
};

// ─── Dedup alertów + lekka historia sygnałów ────────────────────────────────────
export const wasAlertSent = async (key: string): Promise<boolean> => {
  return (await load()).sentAlertKeys.includes(key);
};

export const markAlertsSent = async (keys: string[]): Promise<void> => {
  if (!keys.length) return;
  const s = await load();
  s.sentAlertKeys = [...new Set([...s.sentAlertKeys, ...keys])].slice(-500); // limit rozrostu
  await persist();
};

export const recordSignals = async (signals: MarketSignal[]): Promise<void> => {
  if (!signals.length) return;
  const s = await load();
  s.recentSignals = [...signals, ...s.recentSignals].slice(0, 100);
  await persist();
};

export const getRecentSignals = async (): Promise<MarketSignal[]> => {
  return (await load()).recentSignals;
};

// ─── Strategia inwestora + ostatnie podsumowanie portfelowe ─────────────────────
export const getStrategy = async (): Promise<string> => {
  return (await load()).strategy;
};

export const saveStrategy = async (text: string): Promise<void> => {
  const s = await load();
  s.strategy = text;
  await persist();
};

export const getLastSummary = async (): Promise<PortfolioSummary | null> => {
  return (await load()).lastSummary;
};

export const saveLastSummary = async (summary: PortfolioSummary): Promise<void> => {
  const s = await load();
  s.lastSummary = summary;
  await persist();
};

// ─── Ostatni pełny skan (cache dla POST /api/summary) ───────────────────────────
export const getLastScan = async (): Promise<LastScan | null> => {
  return (await load()).lastScan;
};

export const saveLastScan = async (scan: LastScan): Promise<void> => {
  const s = await load();
  s.lastScan = scan;
  await persist();
};

// ─── Licznik wywołań Gemini (osobny, mały plik) ─────────────────────────────────
/**
 * Licznik MUSI być trwały — w pamięci procesu zerował się przy każdym restarcie
 * kontenera, a `restart: unless-stopped` plus backend wywracający się w pętli to
 * dokładnie ten scenariusz, przed którym bezpiecznik ma chronić.
 *
 * Trzyma się w WŁASNYM pliku, nie w `state.json`. Trzy powody:
 *  - uszkodzenie dużego stanu nie kasuje licznika (i odwrotnie),
 *  - plik jest malutki, więc okno na przerwany zapis jest minimalne,
 *  - nie przepisujemy całego `lastScan` przy każdym wywołaniu Gemini.
 */
export interface GeminiUsage {
  /** Data w czasie polskim, RRRR-MM-DD. */
  day: string;
  /** Wszystkie wywołania Gemini w tej dobie. */
  calls: number;
  /** Wywołania z Google Search w tej dobie. */
  searchCalls: number;
  /** Miesiąc w czasie polskim, RRRR-MM — do licznika kosztu i darmowej puli. */
  month: string;
  /** Narastający koszt tokenów w tym miesiącu, w złotych. */
  costPln: number;
  /** Wywołania z wyszukiwarką w tym miesiącu (pilnuje darmowej puli 5000 zapytań). */
  searchCallsMonth: number;
}

/** `'nieczytelny'` = plik istnieje, ale nie da się go sparsować → traktuj jak wyczerpany limit. */
export type OdczytZuzycia = GeminiUsage | 'nieczytelny';

let usageWriteLock: Promise<void> = Promise.resolve();

export const getGeminiUsage = async (): Promise<OdczytZuzycia> => {
  try {
    const raw = await fs.readFile(USAGE_FILE, 'utf-8');
    const p = JSON.parse(raw) as Partial<GeminiUsage>;
    if (typeof p.day !== 'string' || typeof p.calls !== 'number' || !Number.isFinite(p.calls)) {
      throw new Error('brak wymaganych pól');
    }
    const liczba = (v: unknown) => (Number.isFinite(v as number) ? (v as number) : 0);
    return {
      day: p.day,
      calls: p.calls,
      searchCalls: liczba(p.searchCalls),
      month: typeof p.month === 'string' ? p.month : '',
      costPln: liczba(p.costPln),
      searchCallsMonth: liczba(p.searchCallsMonth),
    };
  } catch (e: any) {
    if (e?.code === 'ENOENT') {
      return { day: '', calls: 0, searchCalls: 0, month: '', costPln: 0, searchCallsMonth: 0 };
    }
    // Świadomie NIE zerujemy licznika. Nieczytelny plik nie może być tańszą
    // ścieżką do wyzerowania bezpiecznika niż zwykłe czekanie do jutra.
    console.error('[Gemini] Licznik wywołań nieczytelny — blokuję wywołania do czasu naprawy:', e?.message ?? e);
    return 'nieczytelny';
  }
};

export const saveGeminiUsage = async (usage: GeminiUsage): Promise<void> => {
  const snapshot = JSON.stringify(usage);
  usageWriteLock = usageWriteLock.catch(() => undefined).then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await zapiszAtomowo(USAGE_FILE, snapshot);
  });
  return usageWriteLock;
};

/** Ręczny reset licznika (endpoint administracyjny) — bez edycji pliku na serwerze. */
export const resetGeminiUsage = async (day: string, month: string): Promise<GeminiUsage> => {
  const czysty: GeminiUsage = { day, calls: 0, searchCalls: 0, month, costPln: 0, searchCallsMonth: 0 };
  await saveGeminiUsage(czysty);
  return czysty;
};
