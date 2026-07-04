// Backend shared types - must stay in sync with frontend/types.ts

export interface ETF {
  ticker: string;
  name: string;
  category: string;
  description: string;
}

export interface Influencer {
  name: string;
  handle: string;
  impact: string;
}

export interface MarketSignal {
  id: string;
  ticker: string;
  type: 'ANOMALY' | 'INFLUENCER' | 'NEWS' | 'THESIS' | 'MACRO';
  severity: 'low' | 'medium' | 'high';
  title: string;
  summary: string;
  longTermImpact?: string;
  timestamp: Date;
  sources: { title: string; uri: string; domain?: string }[];
  phase?: 'fast' | 'deep';
  priority?: 'DZIS' | 'TYDZIEN' | 'MIESIAC';
  /** Ustawiane przez walidację high-severity (VALIDATE_SIGNALS). false = niepotwierdzone. */
  verified?: boolean;
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
  calendar: any[];
  globalData?: GlobalMacroData;
}

// ─── Wykresy cenowe (karta "Wykresy (PLN)") ──────────────────────────────────
/** Jeden punkt serii: cena instrumentu w EUR + kurs EUR/PLN w tym samym momencie. */
export interface ChartPoint {
  /** epoch w sekundach (jak Yahoo) */
  t: number;
  /** cena zamknięcia instrumentu w walucie notowania (EUR) */
  eur: number;
  /** kurs EUR/PLN dopasowany do tego znacznika czasu */
  fx: number;
}

export interface ChartResponse {
  ticker: string;
  interval: string;
  /** waluta notowania instrumentu (oczekiwane 'EUR') */
  currency: string;
  /** znacznik ostatniego punktu (ISO) lub null */
  asOf: string | null;
  points: ChartPoint[];
}

// ─── Podsumowanie portfelowe ("Podsumowanie dla mnie") ───────────────────────
export type PortfolioStance = 'HOLD' | 'ACCUMULATE' | 'WATCH' | 'REDUCE';

export interface PortfolioSummary {
  overall: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  /** Jednozdaniowy nagłówek. */
  headline: string;
  /** 3-5 zdań: co się dzieje i co to znaczy dla planu inwestycyjnego. */
  narrative: string;
  /** Rekomendacja per śledzony aktyw. */
  perAsset: { ticker: string; stance: PortfolioStance; note: string }[];
  /** Konkretne sugestie działań. */
  actions: string[];
  /** Strategia użyta do wygenerowania (audyt). */
  strategy: string;
  timestamp: Date;
}
