/**
 * marketData.ts — realne dane rynkowe ze Stooq (darmowe, bez klucza API).
 *
 * Stooq udostępnia lekki endpoint CSV:
 *   https://stooq.com/q/l/?s=SYMBOL&f=sd2t2ohlcv&h&e=csv
 * Zwraca m.in. ostatnią cenę zamknięcia. Używamy go zamiast pozwalać modelowi
 * AI "zgadywać" kursy walut, VIX czy ceny ETF-ów.
 */

import { ChartPoint, ChartResponse } from './types';

export interface Quote {
  symbol: string;
  price: number | null;
  date: string | null;
}

/** Pobiera pojedynczy kurs ze Stooq. Zwraca null przy błędzie (nie rzuca). */
async function fetchStooqQuote(symbol: string): Promise<Quote> {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    // Stooq odrzuca żądania bez przeglądarkowego User-Agent (zwraca pusto).
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/csv,text/plain,*/*',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return { symbol, price: null, date: null };

    const csv = (await res.text()).trim();
    // Nagłówek + jedna linia danych: Symbol,Date,Time,Open,High,Low,Close,Volume
    const lines = csv.split('\n');
    if (lines.length < 2) return { symbol, price: null, date: null };

    const cols = lines[1].split(',');
    const date = cols[1] && cols[1] !== 'N/D' ? cols[1] : null;
    const closeRaw = cols[6];
    const price = closeRaw && closeRaw !== 'N/D' ? Number(closeRaw) : null;

    return { symbol, price: Number.isFinite(price as number) ? price : null, date };
  } catch {
    return { symbol, price: null, date: null };
  }
}

export interface MarketQuotes {
  usdPln: string;
  eurPln: string;
  eurUsd: string;
  vix: string;
  asOf: string | null;
}

/** Pobiera podstawowy koszyk makro: kursy z Frankfurter (EBC), VIX z Yahoo. */
export async function fetchMarketQuotes(): Promise<MarketQuotes> {
  const [fx, vix] = await Promise.all([fetchFx(), fetchVix()]);
  return {
    usdPln: fx.usdPln,
    eurPln: fx.eurPln,
    eurUsd: fx.eurUsd,
    vix: vix != null ? vix.toFixed(2) : 'ND',
    asOf: fx.asOf,
  };
}

/**
 * Kursy walut z Frankfurter.app (dane EBC) — darmowe, bez klucza, stabilny JSON.
 * 2 wywołania: bazą EUR (→ PLN, USD) oraz bazą USD (→ PLN).
 */
async function fetchFx(): Promise<{ usdPln: string; eurPln: string; eurUsd: string; asOf: string | null }> {
  const get = async (from: string, to: string): Promise<{ rates: Record<string, number>; date: string } | null> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      return (await res.json()) as { rates: Record<string, number>; date: string };
    } catch {
      return null;
    }
  };

  const [eur, usd] = await Promise.all([get('EUR', 'PLN,USD'), get('USD', 'PLN')]);
  const n = (v: number | undefined, d = 4) => (typeof v === 'number' ? v.toFixed(d) : 'ND');

  return {
    usdPln: n(usd?.rates?.PLN),
    eurPln: n(eur?.rates?.PLN),
    eurUsd: n(eur?.rates?.USD),
    asOf: usd?.date ?? eur?.date ?? null,
  };
}

/** VIX z publicznego endpointu wykresów Yahoo Finance (bez klucza). */
async function fetchVix(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentinelIKE/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json: any = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wykresy cenowe — koszt zakupu w PLN (karta "Wykresy (PLN)")
// ─────────────────────────────────────────────────────────────────────────────

/** Instrumenty dozwolone dla /api/chart (oba notowane w EUR na Xetrze). */
const CHART_ALLOWLIST = new Set(['XNAS.DE', 'VWCE.DE']);

/** Interwał UI → parametry Yahoo. Yahoo nie ma natywnego 4h → bierzemy 60m i agregujemy. */
const INTERVAL_MAP: Record<string, { yahoo: string; range: string; agg4h?: boolean }> = {
  '30m': { yahoo: '30m', range: '1mo' },
  '1h':  { yahoo: '60m', range: '3mo' },
  '4h':  { yahoo: '60m', range: '6mo', agg4h: true },
  '1d':  { yahoo: '1d',  range: '2y' },
};

interface Candle {
  t: number; // epoch (s)
  close: number;
}

/** Świece z Yahoo chart API (bez klucza). Best-effort — przy błędzie zwraca []. */
async function fetchYahooCandles(symbol: string, interval: string, range: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentinelIKE/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    const ts: number[] = result?.timestamp ?? [];
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
    const out: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      // Yahoo wstawia dziury (null) — pomijamy.
      if (typeof c === 'number' && Number.isFinite(c)) out.push({ t: ts[i], close: c });
    }
    return out;
  } catch {
    return [];
  }
}

/** Agreguje świece 60m do kubełków 4h (klucz = floor(t/4h)), close = ostatnia świeca kubełka. */
function aggregateTo4h(candles: Candle[]): Candle[] {
  const FOUR_H = 4 * 3600;
  const buckets = new Map<number, Candle>();
  for (const c of candles) {
    const key = Math.floor(c.t / FOUR_H);
    const prev = buckets.get(key);
    // Świece przychodzą rosnąco; nadpisanie zostawia ostatnią (close kubełka).
    if (!prev || c.t >= prev.t) buckets.set(key, c);
  }
  return [...buckets.values()].sort((a, b) => a.t - b.t);
}

/**
 * Buduje serię kosztu zakupu: cena instrumentu (EUR) + kurs EUR/PLN z tego samego
 * momentu (forward-fill z najbliższej wcześniejszej świecy FX; FX handluje 24h,
 * Xetra ~9:00–17:30). Przewalutowanie 0,5% XTB dolicza front z pól eur*fx.
 * Rzuca przy tickerze spoza allowlisty (→ 400 w endpointcie).
 */
export async function fetchPlnCostSeries(ticker: string, interval: string): Promise<ChartResponse> {
  const sym = ticker.toUpperCase();
  if (!CHART_ALLOWLIST.has(sym)) throw new Error(`Ticker not allowed: ${ticker}`);
  const map = INTERVAL_MAP[interval] ?? INTERVAL_MAP['1d'];

  let [priceCandles, fxCandles] = await Promise.all([
    fetchYahooCandles(sym, map.yahoo, map.range),
    fetchYahooCandles('EURPLN=X', map.yahoo, map.range),
  ]);

  if (map.agg4h) {
    priceCandles = aggregateTo4h(priceCandles);
    fxCandles = aggregateTo4h(fxCandles);
  }

  // Forward-fill kursu: dla każdego t świecy ceny bierz najbliższy wcześniejszy kurs FX.
  const fxSorted = fxCandles.slice().sort((a, b) => a.t - b.t);
  const points: ChartPoint[] = [];
  let j = 0;
  let lastFx: number | null = null;
  for (const p of priceCandles) {
    while (j < fxSorted.length && fxSorted[j].t <= p.t) {
      lastFx = fxSorted[j].close;
      j++;
    }
    if (lastFx != null) points.push({ t: p.t, eur: p.close, fx: lastFx });
  }

  const asOf = points.length ? new Date(points[points.length - 1].t * 1000).toISOString() : null;
  return { ticker: sym, interval, currency: 'EUR', asOf, points };
}

/**
 * Rozwiązuje przekierowanie (np. Google grounding `vertexaisearch`) do realnego URL-a.
 * Google grounding zwraca link-redirect, więc nie znamy z niego prawdziwej domeny —
 * podążamy za przekierowaniem i wyciągamy hostname z `res.url`.
 * Best-effort: przy błędzie / dalej-redirekcie zwraca null (nie rzuca).
 */
export async function resolveRedirect(
  url: string,
): Promise<{ finalUrl: string; domain: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
    });
    clearTimeout(timeout);

    const finalUrl = res.url || url;
    const host = new URL(finalUrl).hostname.replace(/^www\./, '');
    // Jeśli nadal jesteśmy na redirekcie Google, domena jest bezużyteczna.
    if (host.includes('vertexaisearch') || host.includes('google')) return null;
    return { finalUrl, domain: host };
  } catch {
    return null;
  }
}

/**
 * Mapuje ticker z aplikacji na symbol Stooq i pobiera cenę.
 * Best-effort — jeśli się nie uda, zwraca null (AI dostanie wtedy mniej danych,
 * ale analiza i tak się wykona).
 */
export async function fetchTickerPrice(ticker: string): Promise<Quote | null> {
  // Stooq używa małych liter; sufiksy giełd częściowo się pokrywają z naszymi
  // (.PL, .US, .DE, .UK/.L). Próbujemy kilku wariantów.
  const t = ticker.toLowerCase();
  const candidates = [t];

  if (t.endsWith('.l')) candidates.push(t.replace(/\.l$/, '.uk'));
  if (t.endsWith('.eu')) candidates.push(t.replace(/\.eu$/, ''));
  // GPW na Stooq: 'dnp.pl' / 'xtb.pl' → spróbuj też bez sufiksu ('dnp', 'xtb').
  if (t.endsWith('.pl')) candidates.push(t.replace(/\.pl$/, ''));

  for (const sym of candidates) {
    const q = await fetchStooqQuote(sym);
    if (q.price != null) return q;
  }
  return null;
}
