// API Service - Frontend calls backend instead of directly importing
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export interface MarketIntelligenceResult {
  signals: Array<{
    timestamp: string;
    ticker: string;
    signal: string;
    confidence: number;
    description: string;
  }>;
  globalData?: {
    sentiment: number;
    risk: number;
    usdPln: number;
    eurPln: number;
    cpiPl: number;
    cpiUs: number;
    ratesPl: number;
    ratesUs: number;
    vix: number;
  };
}

export async function fetchMarketIntelligence(
  selectedEtf: any,
  influencers: any[]
): Promise<MarketIntelligenceResult> {
  try {
    const ticker = selectedEtf === 'GLOBAL' ? 'GLOBAL' : selectedEtf.ticker;
    const response = await fetch(`${API_BASE_URL}/api/market-intel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticker,
        marketType: selectedEtf === 'GLOBAL' ? 'macro' : selectedEtf.category,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching market intelligence:', error);
    throw error;
  }
}

export async function validateAndFetchTickerDetails(
  ticker: string
): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/validate-ticker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticker,
        currentType: 'stock',
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.markets?.[0]?.data || null;
  } catch (error) {
    console.error('Error validating ticker:', error);
    throw error;
  }
}
