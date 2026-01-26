
import { GoogleGenAI } from "@google/genai";
import { MarketSignal, ETF, Influencer, MarketIntelligenceResponse, GlobalMacroData } from "../types";

/**
 * Backend Service - Zarządza komunikacją z Gemini API.
 * Wykorzystuje process.env.API_KEY w bezpieczny sposób.
 */
export const validateAndFetchTickerDetails = async (ticker: string): Promise<ETF | null> => {
  // Inicjalizacja instancji tuż przed użyciem dla pewności co do klucza API
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const prompt = `
      Sprawdź dostępność tickera "${ticker}" w ofercie brokera XTB (IKE/IKZE).
      Zasady:
      - Jeśli istnieje, zwróć JSON z danymi (nazwa, kategoria, opis po polsku).
      - Jeśli nie istnieje lub jest to instrument CFD (niedostępny w IKE), zwróć "existsInXtb": false.
      
      ZWRÓĆ WYŁĄCZNIE JSON:
      {
        "ticker": "${ticker}",
        "name": "Nazwa",
        "category": "Kategoria",
        "description": "Dlaczego warto go mieć w IKE (max 150 znaków)",
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

    const data = JSON.parse(response.text);
    if (!data.existsInXtb) return null;

    return {
      ticker: data.ticker,
      name: data.name,
      category: data.category,
      description: data.description
    };
  } catch (error) {
    console.error("Backend Error (Validation):", error);
    return null;
  }
};

export const fetchMarketIntelligence = async (
  target: ETF | 'GLOBAL', 
  influencers: Influencer[]
): Promise<MarketIntelligenceResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isGlobal = target === 'GLOBAL';

  try {
    const prompt = `
      Działaj jako analityk rynkowy dla portfela IKE. Analizujesz: ${isGlobal ? 'RYNEK GLOBALNY I POLSKĘ' : `Instrument: ${target.ticker}`}.
      WYMAGANE DANE (Użyj Google Search):
      1. Aktualne kursy: USD/PLN, EUR/PLN, VIX.
      2. Ostatnie dane o inflacji (CPI) i stopach: Polska (NBP), USA (FED).
      3. 3-5 konkretnych sygnałów (makro, anomalie, newsy).
      
      ZWRÓĆ WYŁĄCZNIE JSON:
      {
        "globalData": {
          "usdPln": "wartość",
          "eurPln": "wartość",
          "eurUsd": "wartość",
          "vix": "wartość",
          "cpiPl": "wartość %",
          "ratesPl": "wartość %",
          "cpiUs": "wartość %",
          "ratesUs": "wartość %",
          "sentiment": 0-100,
          "risk": 0-100
        },
        "signals": [
          {
            "type": "MACRO",
            "severity": "medium/high",
            "title": "Tytuł",
            "summary": "Opis faktów",
            "longTermImpact": "Wpływ na IKE"
          }
        ],
        "calendar": []
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

    const data = JSON.parse(response.text);

    // Ekstrakcja źródeł z groundingMetadata (Grounding Chunks)
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
      calendar: data.calendar || [],
      globalData: data.globalData ? {
        ...data.globalData,
        sources: searchSources.slice(0, 5) // Główne źródła dla makro
      } : undefined
    };

  } catch (error: any) {
    console.error("Backend Error (Intelligence):", error);
    if (error?.message?.includes('401') || error?.message?.includes('OAuth2') || error?.message?.includes('not found')) {
      throw new Error('AUTH_REQUIRED');
    }
    return { signals: [], calendar: [] };
  }
};
