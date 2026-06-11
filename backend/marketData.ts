/**
 * marketData.ts — realne dane rynkowe ze Stooq (darmowe, bez klucza API).
 *
 * Stooq udostępnia lekki endpoint CSV:
 *   https://stooq.com/q/l/?s=SYMBOL&f=sd2t2ohlcv&h&e=csv
 * Zwraca m.in. ostatnią cenę zamknięcia. Używamy go zamiast pozwalać modelowi
 * AI "zgadywać" kursy walut, VIX czy ceny ETF-ów.
 */

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
