
import { GoogleGenAI } from "@google/genai";
import { MarketIntelligenceResponse, GlobalMarketData } from "./types";
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
