import { ETF, Influencer, MarketIntelligenceResponse, MarketSignal, SignalPriority, PortfolioSummary, ChartResponse } from '../types';
import { CACHE_TTL_MS, TRUSTED_SOURCES, SOURCE_NAME_ALIASES } from '../constants';

const API_BASE_URL = 'http://192.168.88.8:3010';

// ─────────────────────────────────────────────────────────────────────────────
// Source credibility helper
// ─────────────────────────────────────────────────────────────────────────────
export function getSourceCredibility(uri: string, title?: string, domain?: string): 'high' | 'medium' | 'unknown' {
  // Najpewniejsza jest domena rozwiązana przez backend (z redirectu vertexaisearch).
  // Gdy jej brak — odtwarzamy z URI/tytułu, a w ostateczności z aliasu nazwy serwisu.
  const candidates: string[] = [];

  if (domain) candidates.push(domain.replace(/^www\./, ''));

  try {
    const host = new URL(uri).hostname.replace(/^www\./, '');
    if (!host.includes('vertexaisearch')) candidates.push(host);
  } catch {
    /* uri nie jest pełnym URL-em — pomijamy */
  }

  if (title) {
    const t = title.toLowerCase().trim().replace(/^www\./, '');
    const match = t.match(/[a-z0-9-]+\.[a-z.]{2,}/);
    if (match) candidates.push(match[0]);
    // Tytuł bez kropki (np. "Reuters") — spróbuj zmapować nazwę serwisu na domenę.
    for (const [name, dom] of Object.entries(SOURCE_NAME_ALIASES)) {
      if (t.includes(name)) candidates.push(dom);
    }
  }

  for (const domain of candidates) {
    if (TRUSTED_SOURCES[domain]) return TRUSTED_SOURCES[domain];
    const hit = Object.keys(TRUSTED_SOURCES).find((d) => domain === d || domain.endsWith('.' + d));
    if (hit) return TRUSTED_SOURCES[hit];
  }
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal priority computation
// ─────────────────────────────────────────────────────────────────────────────
export function computePriority(signal: Omit<MarketSignal, 'priority'>): SignalPriority {
  const ageMs = Date.now() - new Date(signal.timestamp).getTime();
  const h24  = 24 * 60 * 60 * 1000;   // 1 dzień
  const d7   =  7 * 24 * 60 * 60 * 1000; // 7 dni
  if (ageMs < h24) return 'DZIS';
  if (ageMs < d7)  return 'TYDZIEN';
  return 'MIESIAC';
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Cache
// ─────────────────────────────────────────────────────────────────────────────
function cacheKey(target: ETF | 'GLOBAL'): string {
  const ticker = target === 'GLOBAL' ? 'GLOBAL' : (target as ETF).ticker;
  return `sentinel_cache_${ticker}`;
}

function getCached(target: ETF | 'GLOBAL'): MarketIntelligenceResponse | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(target));
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheKey(target));
      return null;
    }
    // Rehydrate Date objects
    data.signals = data.signals.map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) }));
    return data as MarketIntelligenceResponse;
  } catch {
    return null;
  }
}

export function getCacheTimestamp(target: ETF | 'GLOBAL'): Date | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(target));
    if (!raw) return null;
    const { timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return new Date(timestamp);
  } catch {
    return null;
  }
}

function setCache(target: ETF | 'GLOBAL', data: MarketIntelligenceResponse): void {
  try {
    sessionStorage.setItem(
      cacheKey(target),
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {
    // sessionStorage may be full — ignore silently
  }
}

export function invalidateCache(target: ETF | 'GLOBAL'): void {
  sessionStorage.removeItem(cacheKey(target));
}

// ─────────────────────────────────────────────────────────────────────────────
// Wykresy cenowe — koszt zakupu w PLN (karta "Wykresy (PLN)")
// Bez cache — dane śróddzienne, świeżość ważniejsza.
// ─────────────────────────────────────────────────────────────────────────────
export async function getChart(ticker: string, interval: string, range: string): Promise<ChartResponse> {
  const r = await fetch(
    `${API_BASE_URL}/api/chart?ticker=${encodeURIComponent(ticker)}&interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`
  );
  if (!r.ok) throw new Error(`Chart API error: ${r.statusText}`);
  return r.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-process: attach priority + credibility to signals
// ─────────────────────────────────────────────────────────────────────────────
function postProcess(response: MarketIntelligenceResponse): MarketIntelligenceResponse {
  return {
    ...response,
    signals: response.signals.map((s) => ({
      ...s,
      timestamp: s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp),
      priority: computePriority(s),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FAZA 1 — Fast (Flash, no search)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchMarketIntelligenceFast(
  target: ETF | 'GLOBAL',
  forceRefresh = false
): Promise<MarketIntelligenceResponse> {
  if (!forceRefresh) {
    const cached = getCached(target);
    if (cached) return cached;
  }

  const ticker = target === 'GLOBAL' ? 'GLOBAL' : (target as ETF).ticker;
  const marketType = target === 'GLOBAL' ? 'macro' : (target as ETF).category;

  const response = await fetch(`${API_BASE_URL}/api/market-intel/fast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, marketType }),
  });

  if (response.status === 401) throw new Error('AUTH_REQUIRED');
  if (!response.ok) throw new Error(`Fast API error: ${response.statusText}`);

  const data: MarketIntelligenceResponse = await response.json();
  return postProcess(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// FAZA 2 — Deep (Pro + Google Search)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchMarketIntelligenceDeep(
  target: ETF | 'GLOBAL',
  forceRefresh = false
): Promise<MarketIntelligenceResponse> {
  const ticker = target === 'GLOBAL' ? 'GLOBAL' : (target as ETF).ticker;
  const marketType = target === 'GLOBAL' ? 'macro' : (target as ETF).category;

  const response = await fetch(`${API_BASE_URL}/api/market-intel/deep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, marketType }),
  });

  if (response.status === 401) throw new Error('AUTH_REQUIRED');
  if (!response.ok) throw new Error(`Deep API error: ${response.statusText}`);

  const data: MarketIntelligenceResponse = await response.json();
  const processed = postProcess(data);

  // Cache only deep (verified) results
  setCache(target, processed);

  return processed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate ticker
// ─────────────────────────────────────────────────────────────────────────────
export async function validateAndFetchTickerDetails(ticker: string): Promise<ETF | null> {
  const response = await fetch(`${API_BASE_URL}/api/validate-ticker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker }),
  });

  if (!response.ok) return null;
  const result = await response.json();
  return result && result.existsInXtb ? result : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ETF & Influencer CRUD (via backend REST)
// ─────────────────────────────────────────────────────────────────────────────
export async function getEtfs(): Promise<ETF[]> {
  const r = await fetch(`${API_BASE_URL}/api/etfs`);
  return r.ok ? r.json() : [];
}

export async function saveEtf(etf: ETF): Promise<void> {
  await fetch(`${API_BASE_URL}/api/etfs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(etf),
  });
}

export async function deleteEtf(ticker: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/etfs/${encodeURIComponent(ticker)}`, { method: 'DELETE' });
}

export async function getInfluencers(): Promise<Influencer[]> {
  const r = await fetch(`${API_BASE_URL}/api/influencers`);
  return r.ok ? r.json() : [];
}

export async function saveInfluencer(inf: Influencer): Promise<void> {
  await fetch(`${API_BASE_URL}/api/influencers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inf),
  });
}

export async function deleteInfluencer(handle: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/influencers/${encodeURIComponent(handle)}`, { method: 'DELETE' });
}

export async function resetInfluencers(): Promise<Influencer[]> {
  const r = await fetch(`${API_BASE_URL}/api/influencers/reset`, { method: 'POST' });
  return r.ok ? r.json() : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategia inwestora + podsumowanie portfelowe ("Podsumowanie dla mnie")
// ─────────────────────────────────────────────────────────────────────────────
function rehydrateSummary(s: any): PortfolioSummary | null {
  if (!s) return null;
  return { ...s, timestamp: new Date(s.timestamp) } as PortfolioSummary;
}

export async function getStrategy(): Promise<string> {
  const r = await fetch(`${API_BASE_URL}/api/strategy`);
  if (!r.ok) return '';
  const data = await r.json();
  return data?.strategy ?? '';
}

export async function saveStrategy(strategy: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/strategy`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy }),
  });
}

/** Ostatnio wygenerowane podsumowanie (szybkie, bez skanu). */
export async function getPortfolioSummary(): Promise<PortfolioSummary | null> {
  const r = await fetch(`${API_BASE_URL}/api/summary`);
  if (!r.ok) return null;
  return rehydrateSummary(await r.json());
}

/** Uruchamia pełny skan + syntezę. Operacja długa. */
export async function runPortfolioSummary(): Promise<PortfolioSummary> {
  const r = await fetch(`${API_BASE_URL}/api/summary`, { method: 'POST' });
  if (r.status === 401) throw new Error('AUTH_REQUIRED');
  if (!r.ok) throw new Error(`Summary API error: ${r.statusText}`);
  return rehydrateSummary(await r.json())!;
}
