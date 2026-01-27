// Backend types - independent from frontend

export interface MarketIntelligenceResponse {
  insight: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  factors: string[];
}

export interface GlobalMarketData {
  index: string;
  value: number;
  change: number;
  changePercent: number;
}

export interface ErrorResponse {
  error: string;
  status: number;
}

// Additional types for geminiService
export interface ETFI {  symbol: string;
  name: string;
  sector: string;
}

export interface Influencer {
  id: string;
  name: string;
  platform: string;
}


