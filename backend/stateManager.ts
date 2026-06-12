import { promises as fs } from 'fs';
import path from 'path';
import { ETF, Influencer, MarketSignal, PortfolioSummary } from './types';
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
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

let state: PersistedState | null = null;
let writeLock: Promise<void> = Promise.resolve();

function defaultState(): PersistedState {
  return {
    etfs: [...TRACKED_ETFS],
    influencers: [...DEFAULT_INFLUENCERS],
    sentAlertKeys: [],
    recentSignals: [],
    strategy: DEFAULT_STRATEGY,
    lastSummary: null,
  };
}

async function load(): Promise<PersistedState> {
  if (state) return state;
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    state = { ...defaultState(), ...parsed };
  } catch {
    // Pierwszy start lub uszkodzony plik — startujemy od domyślnych.
    state = defaultState();
    await persist();
  }
  return state;
}

async function persist(): Promise<void> {
  if (!state) return;
  const snapshot = JSON.stringify(state, null, 2);
  // Serializujemy zapisy, żeby uniknąć wyścigu przy równoległych żądaniach.
  writeLock = writeLock.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STATE_FILE, snapshot, 'utf-8');
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
