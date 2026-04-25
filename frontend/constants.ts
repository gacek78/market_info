
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
    ticker: 'VWCE.EU',
    name: 'Vanguard FTSE All-World UCITS ETF',
    category: 'Akcje Globalne',
    description: 'Najpopularniejszy ETF na świecie, śledzący rozwinięte i wschodzące rynki. Fundament dywersyfikacji.',
  },
  {
    ticker: 'ETFBW20TR.PL',
    name: 'Beta ETF WIG20 TR',
    category: 'Polska - Blue Chips',
    description: '20 największych spółek z warszawskiej giełdy w wersji dochodowej (Total Return).',
  },
  {
    ticker: 'XTB.PL',
    name: 'XTB S.A.',
    category: 'Spółki Dywidendowe / Finanse',
    description: 'Akcje brokera XTB. Wrażliwe na wolumen rynkowy i wyniki finansowe spółki matki.',
  },
  {
    ticker: 'ETFBM40TR.PL',
    name: 'Beta ETF mWIG40 TR',
    category: 'Polska - Średnie Spółki',
    description: 'Polskie średnie spółki (Total Return). Ekspozycja na lokalny rynek GPW.',
  },
  {
    ticker: 'IGLN.L',
    name: 'iShares Physical Gold',
    category: 'Surowce - Złoto',
    description: 'Fizyczne złoto jako zabezpieczenie przed inflacją i niepewnością geopolityczną.',
  },
  {
    ticker: 'ISLN.L',
    name: 'iShares Physical Silver',
    category: 'Surowce - Srebro',
    description: 'Srebro fizyczne, metal o zastosowaniach inwestycyjnych i przemysłowych.',
  },
  {
    ticker: 'COPA.L',
    name: 'WisdomTree Copper',
    category: 'Surowce - Miedź',
    description: 'Ekspozycja na ceny miedzi — kluczowego metalu dla transformacji energetycznej.',
  },
  {
    ticker: 'AIGA.L',
    name: 'WisdomTree Agriculture',
    category: 'Surowce - Rolne',
    description: 'Zdywersyfikowany koszyk surowców rolnych (kawa, kukurydza, cukier, pszenica).',
  },
  {
    ticker: 'IS3N.DE',
    name: 'iShares Core MSCI EM IMI UCITS ETF',
    category: 'Rynki Wschodzące',
    description: 'Szeroka ekspozycja na kraje rozwijające się (Chiny, Indie, Brazylia, Korea).',
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
