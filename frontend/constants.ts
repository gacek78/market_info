
import { ETF, Influencer } from './types';

// ─── Tracked ETFs ────────────────────────────────────────────────────────────
export const TRACKED_ETFS: ETF[] = [
  {
    ticker: 'XNAS.DE',
    name: 'iShares Nasdaq 100 UCITS ETF',
    category: 'Technologia USA',
    description: '100 największych spółek technologicznych z giełdy Nasdaq. Kluczowy motor wzrostu Twojego portfela.',
  },
  {
    ticker: 'VWCE.DE',
    name: 'Vanguard FTSE All-World UCITS ETF',
    category: 'Akcje Globalne',
    description: 'Najpopularniejszy ETF na świecie, śledzący rozwinięte i wschodzące rynki. Fundament dywersyfikacji.',
  },
  {
    ticker: 'SWIG80TR',
    name: 'Beta ETF sWIG80TR',
    category: 'Polska - Małe Spółki',
    description: 'Polskie małe spółki (sWIG80 Total Return). Ekspozycja na lokalny rynek GPW.',
  },
  {
    ticker: 'CLN.PL',
    name: 'CLN',
    category: 'Akcje GPW',
    description: 'Spółka z warszawskiej giełdy (popraw nazwę i kategorię wg potrzeb).',
  },
  {
    ticker: 'XTB.PL',
    name: 'XTB S.A.',
    category: 'Finanse / Broker',
    description: 'Akcje brokera XTB. Wrażliwe na wolumen rynkowy i wyniki finansowe spółki.',
  },
  {
    ticker: 'DNP.PL',
    name: 'Dino Polska S.A.',
    category: 'Handel Detaliczny',
    description: 'Sieć handlowa Dino — jedna z najszybciej rosnących spółek na GPW.',
  },
];

// ─── Influencers ─────────────────────────────────────────────────────────────
export const DEFAULT_INFLUENCERS: Influencer[] = [
  { name: 'Elon Musk', handle: '@elonmusk', impact: 'Tech, Tesla, Sentiment' },
  { name: 'Jerome Powell', handle: 'FED', impact: 'Stopy procentowe, USD' },
  { name: 'Przemysław Kwiecień', handle: '@PrzemekKwiecien', impact: 'Główny Ekonomista XTB, Macro' },
  { name: 'Michael Burry', handle: '@michaeljburry', impact: 'Nastroje niedźwiedzie, Macro' },
  { name: 'Trader21', handle: 'Independent Trader', impact: 'Polski rynek, Surowce, ETF' },
];

// ─── Source credibility ───────────────────────────────────────────────────────
export const TRUSTED_SOURCES: Record<string, 'high' | 'medium'> = {
  'reuters.com': 'high',
  'bloomberg.com': 'high',
  'ft.com': 'high',
  'wsj.com': 'high',
  'economist.com': 'high',
  'cnbc.com': 'medium',
  'marketwatch.com': 'medium',
  'bankier.pl': 'medium',
  'money.pl': 'medium',
  'stooq.pl': 'medium',
  'seekingalpha.com': 'medium',
  'investing.com': 'medium',
  'businessinsider.com': 'medium',
};

// ─── Cache TTL ────────────────────────────────────────────────────────────────
export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 godzina
