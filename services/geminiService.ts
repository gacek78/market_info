
import { GoogleGenAI } from "@google/genai";
import { MarketSignal, ETF, Influencer, MarketIntelligenceResponse, GlobalMacroData } from "../types";

/**
 * Backend Service - Zarządza komunikacją z Gemini API.
 */
export const validateAndFetchTickerDetails = async (ticker: string): Promise<ETF | null> => {
  // Always create a new GoogleGenAI instance right before making an API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const prompt = `
      Sprawdź dostępność tickera "${ticker}" w ofercie brokera XTB (dla kont IKE/IKZE - tylko akcje i ETFy, nie CFD).
      Zasady:
      - Jeśli istnieje, zwróć JSON z danymi (nazwa, kategoria, opis po polsku).
      - Jeśli nie istnieje lub jest to instrument CFD, zwróć "existsInXtb": false.
      
      ZWRÓĆ WYŁĄCZNIE JSON:
      {
        "ticker": "${ticker}",
        "name": "Pełna Nazwa ETF",
        "category": "Kategoria",
        "description": "Zwięzły opis dlaczego warto go mieć (max 150 znaków)",
        "existsInXtb": true
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      },
    });

    // Access text property directly as per latest Gemini SDK
    const data = JSON.parse(response.text);
    return data.existsInXtb ? {
      ticker: data.ticker,
      name: data.name,
      category: data.category,
      description: data.description
    } : null;
  } catch (error) {
    console.error("Validation Error:", error);
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
  const influencersContext = influencers.map(i => `${i.name} (${i.handle})`).join(", ");

  const prompt = isGlobal 
    ? `ANALIZA GLOBALNA: Skoncentruj się na Macro (USD/PLN, EUR/PLN, Inflacja PL/US, Sentyment). 
       Uwzględnij wypowiedzi osób: ${influencersContext}.
       Pobierz aktualne dane kursowe przez Google Search.`
    : `ANALIZA INSTRUMENTU: ${target.name} (${target.ticker}). 
       Zignoruj ogólne dane o walutach PLN, jeśli nie mają bezpośredniego wpływu na ten instrument. 
       Skup się na: newsach o tym ETFie, wynikach kluczowych spółek w jego składzie, trendach sektora ${target.category}.
       Uwzględnij co o tym aktywie lub sektorze mówią: ${influencersContext}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
        Działaj jako senior analityk portfela IKE. 
        ${prompt}

        WYMAGANE: Wygeneruj 3-5 sygnałów rynkowych.
        ZWRÓĆ WYŁĄCZNIE JSON (zgodny z tym schematem):
        {
          "globalData": {
            "usdPln": "wartość", "eurPln": "wartość", "eurUsd": "wartość", "vix": "wartość",
            "cpiPl": "wartość", "ratesPl": "wartość", "cpiUs": "wartość", "ratesUs": "wartość",
            "sentiment": 0-100, "risk": 0-100
          },
          "signals": [
            {
              "type": "NEWS/ANOMALY/MACRO",
              "severity": "low/medium/high",
              "title": "Tytuł sygnału",
              "summary": "Konkretny opis",
              "longTermImpact": "Dlaczego to ważne dla emerytalnego IKE"
            }
          ]
        }
      `,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      },
    });

    const data = JSON.parse(response.text);
    // Extract website URLs from grounding chunks as mandated by Search Grounding rules
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
      globalData: data.globalData ? { ...data.globalData, sources: searchSources.slice(0, 5) } : undefined
    };
  } catch (error: any) {
    // Implementing robust error handling for API 4xx/5xx errors
    // Specifically catching auth errors and "Requested entity was not found." to trigger re-selection
    if (error?.message?.includes('401') || 
        error?.message?.includes('UNAUTHENTICATED') || 
        error?.message?.includes('Requested entity was not found.')) {
      throw new Error('AUTH_REQUIRED');
    }
    return { signals: [], calendar: [] };
  }
};
