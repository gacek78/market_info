import { GoogleGenAI } from "@google/genai";
import { MarketIntelligenceResponse } from "./types";
import { ETF, Influencer } from "./types";
import { fetchMarketQuotes, fetchTickerPrice } from "./marketData";
import { MODEL_FAST, MODEL_DEEP, MODEL_VALIDATE } from "./constants";

const getAI = () => {
  if (!process.env.API_KEY) {
    console.error('[GeminiService] ERROR: API_KEY is not set in environment!');
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY! });
};

/**
 * Robustnie wyciąga obiekt JSON z odpowiedzi modelu.
 *
 * Gemini NIE pozwala łączyć `responseMimeType: 'application/json'` z narzędziem
 * `googleSearch` — w fazie Deep musimy więc prosić o zwykły tekst i sami
 * wydobyć JSON (model często opakowuje go w ```json ... ``` albo dokłada prozę).
 */
function extractJson<T = any>(raw: string | undefined | null): T | null {
  if (!raw) return null;
  let text = raw.trim();

  // Zdejmij ogrodzenie ```json ... ``` lub ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // Spróbuj sparsować całość; jeśli nie, wytnij pierwszy zbalansowany blok {...}
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as T;
      } catch {
        /* poniżej */
      }
    }
  }
  console.error('[GeminiService] Nie udało się sparsować JSON z odpowiedzi:', raw?.slice(0, 300));
  return null;
}

function isAuthError(error: any): boolean {
  const msg = error?.message ?? '';
  return (
    msg.includes('401') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('Requested entity was not found.')
  );
}

// ─── FAST (Faza 1): Gemini Flash bez Google Search ───────────────────────────
export const fetchMarketIntelligenceFast = async (
  target: ETF | 'GLOBAL'
): Promise<MarketIntelligenceResponse> => {
  const ai = getAI();
  const isGlobal = target === 'GLOBAL';

  const specificInstruction = isGlobal
    ? `Krótka analiza makro: ogólny sentyment rynkowy, USD/PLN, Euro/PLN, VIX.
       Wygeneruj 2 szybkie sygnały na podstawie swojej wiedzy.`
    : `Wstępna analiza instrumentu: ${(target as ETF).ticker} — ${(target as ETF).name}.
       Sektor: ${(target as ETF).category}.
       Wygeneruj 2 szybkie sygnały na podstawie swojej wiedzy trenningowej.`;

  const prompt = `
    Działaj jako senior analityk portfela IKE.
    ${specificInstruction}

    WAŻNE: To jest SZYBKA, wstępna analiza (Faza 1). Nie masz dostępu do internetu.
    Bazuj na swojej wiedzy. Oznacz sygnały jako: "phase": "fast".

    ZWRÓĆ WYŁĄCZNIE JSON:
    {
      "globalData": {
        "usdPln": "~wartość szacunkowa",
        "eurPln": "~wartość szacunkowa",
        "eurUsd": "~wartość szacunkowa",
        "vix": "~wartość",
        "cpiPl": "ND", "ratesPl": "ND", "cpiUs": "ND", "ratesUs": "ND",
        "sentiment": 50, "risk": 50
      },
      "signals": [
        {
          "type": "MACRO",
          "severity": "low",
          "priority": "DZIS",
          "title": "Wstępna ocena",
          "summary": "Krótki opis na bazie wiedzy modelu",
          "longTermImpact": "Kontekst IKE"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const data = extractJson<any>(response.text);
    if (!data) return { signals: [], calendar: [] };
    return {
      signals: (data.signals || []).map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        ticker: isGlobal ? 'GLOBAL' : (target as ETF).ticker,
        sources: [],
        phase: 'fast' as const,
        priority: s.priority || 'DZIS',
      })),
      calendar: [],
      globalData: data.globalData ? { ...data.globalData, sources: [] } : undefined,
    };
  } catch (error: any) {
    console.error('Fast API Error:', error);
    if (isAuthError(error)) throw new Error('AUTH_REQUIRED');
    return { signals: [], calendar: [] };
  }
};

// ─── DEEP (Faza 2): Gemini Pro + Google Search ────────────────────────────────
export const fetchMarketIntelligenceDeep = async (
  target: ETF | 'GLOBAL',
  influencers: Influencer[]
): Promise<MarketIntelligenceResponse> => {
  const ai = getAI();
  const isGlobal = target === 'GLOBAL';
  const influencersList = influencers.map((i) => `${i.name} (${i.handle})`).join(', ');

  // ── Realne dane rynkowe (Stooq) — AI ma je interpretować, nie zgadywać ──
  const quotes = await fetchMarketQuotes();
  const tickerQuote = isGlobal ? null : await fetchTickerPrice((target as ETF).ticker);

  const realDataBlock = `
    TWARDE DANE RYNKOWE (źródło: Stooq, na dzień ${quotes.asOf ?? 'b.d.'}) — TRAKTUJ JE JAKO PRAWDĘ, NIE ZGADUJ:
    - USD/PLN: ${quotes.usdPln}
    - EUR/PLN: ${quotes.eurPln}
    - EUR/USD: ${quotes.eurUsd}
    - VIX: ${quotes.vix}${
      tickerQuote
        ? `\n    - Ostatnia cena ${(target as ETF).ticker}: ${tickerQuote.price} (z ${tickerQuote.date ?? 'b.d.'})`
        : ''
    }
  `;

  const specificInstruction = isGlobal
    ? `ANALIZA MAKRO: Skup się na parach walutowych (USD/PLN, EUR/PLN), inflacji w Polsce i USA oraz ogólnym nastroju rynkowym.
       Pobierz AKTUALNE newsy i kontekst przez Google Search (dane liczbowe walut/VIX masz już podane wyżej — użyj ich).
       Monitoruj wypowiedzi tych osób: ${influencersList}.`
    : `GŁĘBOKA ANALIZA INSTRUMENTU: ${(target as ETF).ticker} (${(target as ETF).name}).
       ZAKAZ: Nie podawaj ogólnych danych o inflacji w Polsce czy kursie EUR/PLN, chyba że mają KLUCZOWY wpływ na ten instrument.
       SKUP SIĘ NA:
       1. Newsy dotyczące bezpośrednio ${(target as ETF).ticker}.
       2. Sytuacja w sektorze: ${(target as ETF).category}.
       3. Co te osoby mówią o tym aktywie lub sektorze: ${influencersList}.
       4. Wyniki finansowe największych spółek w tym ETF.`;

  const prompt = `
    Działaj jako senior analityk portfela IKE.
    ${realDataBlock}
    ${specificInstruction}

    WYMAGANE: Wygeneruj 3-5 sygnałów z AKTUALNYMI danymi z internetu.
    ZWRÓĆ WYŁĄCZNIE JSON (bez bloków markdown, bez komentarzy):
    {
      "globalData": {
        "usdPln": "wartość", "eurPln": "wartość", "eurUsd": "wartość", "vix": "wartość",
        "cpiPl": "wartość", "ratesPl": "wartość", "cpiUs": "wartość", "ratesUs": "wartość",
        "sentiment": 50, "risk": 50
      },
      "signals": [
        {
          "type": "NEWS",
          "severity": "medium",
          "priority": "DZIS/TYDZIEN/MIESIAC",
          "title": "Tytuł sygnału",
          "summary": "Konkretny opis z datą/źródłem",
          "longTermImpact": "Dlaczego to ważne dla emerytalnego IKE"
        }
      ]
    }
  `;

  try {
    // UWAGA: googleSearch jest niekompatybilny z responseMimeType:'application/json'
    // — prosimy o tekst i sami wyciągamy JSON (extractJson).
    const response = await ai.models.generateContent({
      model: MODEL_DEEP,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const data = extractJson<any>(response.text);
    if (!data) return { signals: [], calendar: [], globalData: { ...quotes, sources: [] } as any };

    const searchSources =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Web Reference',
        uri: chunk.web?.uri || '#',
      })) || [];

    // Realne kursy/VIX zawsze nadpisują to, co wymyśli model.
    const mergedGlobal = {
      ...(data.globalData || {}),
      usdPln: quotes.usdPln,
      eurPln: quotes.eurPln,
      eurUsd: quotes.eurUsd,
      vix: quotes.vix,
      sources: searchSources.slice(0, 5),
    };

    return {
      signals: (data.signals || []).map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        ticker: isGlobal ? 'GLOBAL' : (target as ETF).ticker,
        sources: searchSources.slice(0, 3),
        phase: 'deep' as const,
        priority: s.priority || 'DZIS',
      })),
      calendar: [],
      globalData: mergedGlobal,
    };
  } catch (error: any) {
    console.error('Deep API Error:', error);
    if (isAuthError(error)) throw new Error('AUTH_REQUIRED');
    return { signals: [], calendar: [] };
  }
};

// ─── VALIDATE TICKER ──────────────────────────────────────────────────────────
export const validateAndFetchTickerDetails = async (ticker: string): Promise<ETF | null> => {
  const ai = getAI();
  try {
    const prompt = `
      Sprawdź dostępność tickera "${ticker}" w ofercie brokera XTB (IKE/IKZE - akcje i ETFy, nie CFD).
      ZWRÓĆ WYŁĄCZNIE JSON:
      {
        "ticker": "${ticker}",
        "name": "Pełna Nazwa",
        "category": "Kategoria",
        "description": "Dlaczego warto w IKE (max 120 znaków)",
        "existsInXtb": true
      }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_VALIDATE,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const data = extractJson<any>(response.text);
    return data && data.existsInXtb ? data : null;
  } catch {
    return null;
  }
};
