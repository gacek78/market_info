
import { ETF, Influencer } from './types';

export const TRACKED_ETFS: ETF[] = [
  { ticker: 'XNAS.DE', name: 'iShares Nasdaq 100', category: 'Tech USA', description: 'Kluczowy motor wzrostu.' },
  { ticker: 'VWCE.EU', name: 'Vanguard All-World', category: 'Global', description: 'Fundament dywersyfikacji.' },
  { ticker: 'ETFBW20TR.PL', name: 'Beta WIG20 TR', category: 'PL Blue Chips', description: '20 największych z GPW.' }
];

export const INFLUENCERS: Influencer[] = [
  { name: 'Donald Trump', handle: '@realDonaldTrump', impact: 'Polityka USA, Cła, Dolar' },
  { name: 'Elon Musk', handle: '@elonmusk', impact: 'Tech, Tesla, Sentyment' },
  { name: 'Jerome Powell', handle: 'FED', impact: 'Stopy procentowe, USD' },
  { name: 'Przemysław Kwiecień', handle: '@PrzemekKwiecien', impact: 'Główny Ekonomista XTB, Macro PL' },
  { name: 'Michael Burry', handle: '@michaeljburry', impact: 'Nastroje niedźwiedzie, Macro' }
];
