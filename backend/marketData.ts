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
    const res = await fetch(url, { signal: controller.signal });
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

const fmt = (q: Quote): string => (q.price != null ? q.price.toFixed(q.price < 10 ? 4 : 2) : 'ND');

export interface MarketQuotes {
  usdPln: string;
  eurPln: string;
  eurUsd: string;
  vix: string;
  asOf: string | null;
}

/** Pobiera podstawowy koszyk makro (waluty + VIX) równolegle. */
export async function fetchMarketQuotes(): Promise<MarketQuotes> {
  const [usdpln, eurpln, eurusd, vix] = await Promise.all([
    fetchStooqQuote('usdpln'),
    fetchStooqQuote('eurpln'),
    fetchStooqQuote('eurusd'),
    fetchStooqQuote('^vix'),
  ]);

  return {
    usdPln: fmt(usdpln),
    eurPln: fmt(eurpln),
    eurUsd: fmt(eurusd),
    vix: fmt(vix),
    asOf: usdpln.date ?? eurpln.date ?? null,
  };
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
