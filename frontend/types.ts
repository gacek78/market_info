
export interface ETF {
  ticker: string;
  name: string;
  category: string;
  description: string;
}

export type SignalType = 'ANOMALY' | 'INFLUENCER' | 'NEWS' | 'THESIS' | 'MACRO';

export interface MarketSignal {
  id: string;
  ticker: string;
  type: SignalType;
  severity: 'low' | 'medium' | 'high';
  title: string;
  summary: string;
  longTermImpact?: string;
  timestamp: Date;
  sources: { title: string; uri: string }[];
}

export interface Influencer {
  name: string;
  handle: string;
  impact: string;
}

export interface GlobalMacroData {
  usdPln: string;
  eurPln: string;
  vix: string;
  cpiPl: string;
  ratesPl: string;
  cpiUs: string;
  ratesUs: string;
  sentiment: number;
  risk: number;
  sources: { title: string; uri: string }[];
}

export interface MarketIntelligenceResponse {
  signals: MarketSignal[];
  calendar: any[];
  globalData?: GlobalMacroData;
}
