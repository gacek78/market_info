
export interface ETF {
  ticker: string;
  name: string;
  category: string;
  description: string;
}

// ─── Wykresy cenowe (karta "Wykresy (PLN)") ──────────────────────────────────
export interface ChartPoint {
  t: number;   // epoch (s)
  eur: number; // cena instrumentu w EUR
  fx: number;  // kurs EUR/PLN w tym momencie
}
export interface ChartResponse {
  ticker: string;
  interval: string;
  currency: string;
  asOf: string | null;
  points: ChartPoint[];
}

export type SignalType = 'ANOMALY' | 'INFLUENCER' | 'NEWS' | 'THESIS' | 'MACRO';
export type SignalPhase = 'fast' | 'deep';
export type SignalPriority = 'DZIS' | 'TYDZIEN' | 'MIESIAC';
export type SignalFilter = 'ALL' | 'DZIS' | 'TYDZIEN' | 'MIESIAC';
export type LoadingPhase = 'fast' | 'deep' | null;

export interface MarketSignal {
  id: string;
  ticker: string;
  type: SignalType;
  severity: 'low' | 'medium' | 'high';
  title: string;
  summary: string;
  longTermImpact?: string;
  timestamp: Date;
  sources: { title: string; uri: string; domain?: string }[];
  /** Faza AI ktora wygenerowala sygnal */
  phase?: SignalPhase;
  /** Obliczany priorytet dla filtrow */
  priority?: SignalPriority;
  /** Walidacja high-severity (VALIDATE_SIGNALS): false = niepotwierdzone przez wyszukiwarke */
  verified?: boolean;
}

export interface EconomicEvent {
  date: string;
  region: 'PL' | 'USA' | 'EU';
  event: string;
  impact: 'low' | 'medium' | 'high';
}

export interface Influencer {
  name: string;
  handle: string;
  impact: string;
}

export interface GlobalMacroData {
  usdPln: string;
  eurPln: string;
  eurUsd: string;
  vix: string;
  cpiPl: string;
  ratesPl: string;
  cpiUs: string;
  ratesUs: string;
  sentiment: number;
  risk: number;
  sources: { title: string; uri: string; domain?: string }[];
}

export interface MarketIntelligenceResponse {
  signals: MarketSignal[];
  calendar: EconomicEvent[];
  globalData?: GlobalMacroData;
}

export interface CacheInfo {
  timeLabel: string;
  ageMs: number;
}

// ─── Podsumowanie portfelowe ("Podsumowanie dla mnie") ───────────────────────
export type PortfolioStance = 'HOLD' | 'ACCUMULATE' | 'WATCH' | 'REDUCE';

export interface PortfolioSummary {
  overall: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  headline: string;
  narrative: string;
  perAsset: { ticker: string; stance: PortfolioStance; note: string }[];
  actions: string[];
  strategy: string;
  timestamp: Date;
}
