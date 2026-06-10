import { ETF, Influencer } from './types';

// ─── Modele Gemini (jedno miejsce do zmiany) ─────────────────────────────────
export const MODEL_FAST = 'gemini-3-flash-preview';
export const MODEL_DEEP = 'gemini-3.5-flash'; // faza Deep + Google Search
export const MODEL_VALIDATE = 'gemini-3-flash-preview';

export const TRACKED_ETFS: ETF[] = [
  { ticker: 'XNAS.DE', name: 'iShares Nasdaq 100 UCITS ETF', category: 'Technologia USA', description: '100 największych spółek tech z Nasdaq.' },
  { ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World UCITS ETF', category: 'Akcje Globalne', description: 'Fundament dywersyfikacji — rynki rozwinięte i wschodzące.' },
  { ticker: 'SWIG80TR', name: 'Beta ETF sWIG80TR', category: 'Polska - Małe Spółki', description: 'Polskie małe spółki (sWIG80 Total Return).' },
  { ticker: 'CLN.PL', name: 'CLN', category: 'Akcje GPW', description: 'Spółka z GPW (popraw nazwę/kategorię wg potrzeb).' },
  { ticker: 'XTB.PL', name: 'XTB S.A.', category: 'Finanse / Broker', description: 'Akcje brokera XTB — wrażliwe na wolumen rynkowy.' },
  { ticker: 'DNP.PL', name: 'Dino Polska S.A.', category: 'Handel Detaliczny', description: 'Sieć handlowa Dino — wzrostowa spółka z GPW.' },
];

export const DEFAULT_INFLUENCERS: Influencer[] = [
  { name: 'Elon Musk', handle: '@elonmusk', impact: 'Tech, Tesla, Sentiment' },
  { name: 'Jerome Powell', handle: 'FED', impact: 'Stopy procentowe, USD' },
  { name: 'Przemyslaw Kwiecien', handle: '@PrzemekKwiecien', impact: 'Glowny Ekonomista XTB, Macro' },
  { name: 'Michael Burry', handle: '@michaeljburry', impact: 'Nastroje niedzwiedzie, Macro' },
  { name: 'Trader21', handle: 'Independent Trader', impact: 'Polski rynek, Surowce, ETF' },
];
