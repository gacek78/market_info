
import { GoogleGenAI } from "@google/genai";
import { MarketIntelligenceResponse } from "./types";
import { ETF, Influencer } from "./types";

// ─── FAST (Faza 1): Gemini Flash bez Google Search ───────────────────────────
export const fetchMarketIntelligenceFast = async (
  target: ETF | 'GLOBAL'
): Promise<MarketIntelligenceResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
          "title": "Wstępna ocena",
          "summary": "Krótki opis na bazie wiedzy modelu",
          "longTermImpact": "Kontekst IKE"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const data = JSON.parse(response.text);
    return {
      signals: (data.signals || []).map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        ticker: isGlobal ? 'GLOBAL' : (target as ETF).ticker,
        sources: [],
        phase: 'fast' as const,
      })),
      calendar: [],
      globalData: data.globalData ? { ...data.globalData, sources: [] } : undefined,
    };
  } catch (error: any) {
    if (
      error?.message?.includes('401') ||
      error?.message?.includes('UNAUTHENTICATED') ||
      error?.message?.includes('Requested entity was not found.')
    ) {
      throw new Error('AUTH_REQUIRED');
    }
    return { signals: [], calendar: [] };
  }
};

// ─── DEEP (Faza 2): Gemini Pro + Google Search ────────────────────────────────
export const fetchMarketIntelligenceDeep = async (
  target: ETF | 'GLOBAL',
  influencers: Influencer[]
): Promise<MarketIntelligenceResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isGlobal = target === 'GLOBAL';
  const influencersList = influencers.map((i) => `${i.name} (${i.handle})`).join(', ');

  const specificInstruction = isGlobal
    ? `ANALIZA MAKRO: Skup się na parach walutowych (USD/PLN, EUR/PLN), inflacji w Polsce i USA oraz ogólnym nastroju rynkowym.
       Pobierz AKTUALNE dane przez Google Search.
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
    ${specificInstruction}

    WYMAGANE: Wygeneruj 3-5 sygnałów z AKTUALNYMI danymi z internetu.
    ZWRÓĆ WYŁĄCZNIE JSON:
    {
      "globalData": {
        "usdPln": "wartość", "eurPln": "wartość", "eurUsd": "wartość", "vix": "wartość",
        "cpiPl": "wartość", "ratesPl": "wartość", "cpiUs": "wartość", "ratesUs": "wartość",
        "sentiment": 0-100, "risk": 0-100
      },
      "signals": [
        {
          "type": "NEWS/ANOMALY/MACRO/THESIS/INFLUENCER",
          "severity": "low/medium/high",
          "title": "Tytuł sygnału",
          "summary": "Konkretny opis z datą/źródłem",
          "longTermImpact": "Dlaczego to ważne dla emerytalnego IKE"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro-preview-05-06',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
      },
    });

    const data = JSON.parse(response.text);
    const searchSources =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Web Reference',
        uri: chunk.web?.uri || '#',
      })) || [];

    return {
      signals: (data.signals || []).map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        ticker: isGlobal ? 'GLOBAL' : (target as ETF).ticker,
        sources: searchSources.slice(0, 3),
        phase: 'deep' as const,
      })),
      calendar: [],
      globalData: data.globalData ? { ...data.globalData, sources: searchSources.slice(0, 5) } : undefined,
    };
  } catch (error: any) {
    if (
      error?.message?.includes('401') ||
      error?.message?.includes('UNAUTHENTICATED') ||
      error?.message?.includes('Requested entity was not found.')
    ) {
      throw new Error('AUTH_REQUIRED');
    }
    return { signals: [], calendar: [] };
  }
};

// ─── VALIDATE TICKER ──────────────────────────────────────────────────────────
export const validateAndFetchTickerDetails = async (ticker: string): Promise<ETF | null> => {
  // Always create a new GoogleGenAI instance right before making an API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" },
    });

    const data = JSON.parse(response.text);
    return data.existsInXtb ? data : null;
  } catch (error) {
    return null;
  }
};

export const fetchMarketIntelligence = async (
  target: ETF | 'GLOBAL', 
  influencers: Influencer[]
): Promise<MarketIntelligenceResponse> => {
  // Always create a new GoogleGenAI instance right before making an API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isGlobal = target === 'GLOBAL';
  const influencersList = influencers.map(i => `${i.name} (${i.handle})`).join(', ');

  // Bardzo restrykcyjny prompt dla instrumentów
  const specificInstruction = isGlobal 
    ? `ANALIZA MAKRO: Skup się na parach walutowych (USD/PLN, EUR/PLN), inflacji w Polsce i USA oraz ogólnym nastroju rynkowym.
       Monitoruj wypowiedzi tych osób: ${influencersList}.`
    : `GŁĘBOKA ANALIZA INSTRUMENTU: ${target.ticker} (${target.name}).
       ZAKAZ: Nie podawaj ogólnych danych o inflacji w Polsce czy kursie EUR/PLN, chyba że mają one KLUCZOWY wpływ na ten konkretny instrument.
       SKUP SIĘ NA: 
       1. Newsy dotyczące bezpośrednio ${target.ticker}.
       2. Sytuacja w sektorze: ${target.category}.
       3. Co te osoby mówią o tym konkretnym aktywie lub sektorze: ${influencersList}.
       4. Wyniki finansowe największych spółek w tym ETF.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
        Działaj jako senior analityk IKE. 
        ${specificInstruction}
        
        ZWRÓĆ WYŁĄCZNIE JSON:
        {
          "globalData": {
            "usdPln": "wartość/ND", "eurPln": "wartość/ND", "vix": "wartość",
            "cpiPl": "wartość/ND", "ratesPl": "wartość/ND", "cpiUs": "wartość/ND", "ratesUs": "wartość/ND",
            "sentiment": 0-100, "risk": 0-100
          },
          "signals": [
            {
              "type": "NEWS",
              "severity": "medium",
              "title": "Tytuł",
              "summary": "Opis",
              "longTermImpact": "Komentarz IKE"
            }
          ]
        }
      `,
      config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" },
    });

    const data = JSON.parse(response.text);
    // Mandatory extraction of grounding sources as per Gemini Search Grounding guidelines
    const searchSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || "Web Reference",
      uri: chunk.web?.uri || "#"
    })) || [];

    return {
      signals: (data.signals || []).map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        ticker: isGlobal ? 'GLOBAL' : target.ticker,
        sources: searchSources.slice(0, 3)
      })),
      calendar: [],
      globalData: data.globalData
    };
  } catch (error: any) {
    // Specifically handle authentication and project errors by throwing AUTH_REQUIRED 
    // to trigger the API key selection dialog in the frontend.
    if (error?.message?.includes('401') || 
        error?.message?.includes('UNAUTHENTICATED') || 
        error?.message?.includes('Requested entity was not found.')) {
      throw new Error('AUTH_REQUIRED');
    }
    return { signals: [], calendar: [] };
  }
};
