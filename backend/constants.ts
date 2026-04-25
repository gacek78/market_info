import { ETF, Influencer } from './types';

export const TRACKED_ETFS: ETF[] = [
  { ticker: 'XNAS.DE', name: 'iShares Nasdaq 100 UCITS ETF', category: 'Technologia USA', description: '100 największych spółek tech z Nasdaq.' },
  { ticker: 'VWCE.EU', name: 'Vanguard FTSE All-World UCITS ETF', category: 'Akcje Globalne', description: 'Fundament dywersyfikacji.' },
  { ticker: 'ETFBW20TR.PL', name: 'Beta ETF WIG20 TR', category: 'Polska - Blue Chips', description: '20 największych spółek GPW.' },
  { ticker: 'XTB.PL', name: 'XTB S.A.', category: 'Spółki Dywidendowe / Finanse', description: 'Akcje brokera XTB.' },
  { ticker: 'ETFBM40TR.PL', name: 'Beta ETF mWIG40 TR', category: 'Polska - Średnie Spółki', description: 'Polskie średnie spółki.' },
  { ticker: 'IGLN.L', name: 'iShares Physical Gold', category: 'Surowce - Zloto', description: 'Fizyczne zloto.' },
  { ticker: 'ISLN.L', name: 'iShares Physical Silver', category: 'Surowce - Srebro', description: 'Srebro fizyczne.' },
  { ticker: 'COPA.L', name: 'WisdomTree Copper', category: 'Surowce - Miedz', description: 'Miedz.' },
  { ticker: 'AIGA.L', name: 'WisdomTree Agriculture', category: 'Surowce - Rolne', description: 'Koszyk surowcow rolnych.' },
  { ticker: 'IS3N.DE', name: 'iShares Core MSCI EM IMI', category: 'Rynki Wschodzace', description: 'Kraje rozwijajace sie.' },
];

export const DEFAULT_INFLUENCERS: Influencer[] = [
  { name: 'Elon Musk', handle: '@elonmusk', impact: 'Tech, Tesla, Sentiment' },
  { name: 'Jerome Powell', handle: 'FED', impact: 'Stopy procentowe, USD' },
  { name: 'Przemyslaw Kwiecien', handle: '@PrzemekKwiecien', impact: 'Glowny Ekonomista XTB, Macro' },
  { name: 'Michael Burry', handle: '@michaeljburry', impact: 'Nastroje niedzwiedzie, Macro' },
  { name: 'Trader21', handle: 'Independent Trader', impact: 'Polski rynek, Surowce, ETF' },
];
