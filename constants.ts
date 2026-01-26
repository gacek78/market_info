
import { ETF, Influencer } from './types';

export const TRACKED_ETFS: ETF[] = [
  { 
    ticker: 'XNAS.DE', 
    name: 'iShares Nasdaq 100 UCITS ETF', 
    category: 'Technologia USA', 
    description: '100 największych spółek technologicznych z giełdy Nasdaq. Kluczowy motor wzrostu Twojego portfela.' 
  },
  { 
    ticker: 'VWCE.EU', 
    name: 'Vanguard FTSE All-World UCITS ETF', 
    category: 'Akcje Globalne', 
    description: 'Najpopularniejszy ETF na świecie, śledzący rozwinięte i wschodzące rynki. Fundament dywersyfikacji.' 
  },
  { 
    ticker: 'ETFBW20TR.PL', 
    name: 'Beta ETF WIG20 TR', 
    category: 'Polska - Blue Chips', 
    description: '20 największych spółek z warszawskiej giełdy w wersji dochodowej (Total Return). Serce polskiego rynku.' 
  },
  { 
    ticker: 'XTB.PL', 
    name: 'XTB S.A.', 
    category: 'Spółki Dywidendowe / Finanse', 
    description: 'Akcje brokera XTB. Bardzo wrażliwe na wolumen rynkowy i wyniki finansowe spółki matki.' 
  },
  { 
    ticker: 'ETFBM40TR.PL', 
    name: 'Beta ETF mWIG40 TR', 
    category: 'Polska - Średnie Spółki', 
    description: 'Polskie średnie spółki (Total Return). Kluczowe dla ekspozycji na lokalny rynek GPW.' 
  },
  { 
    ticker: 'IGLN.L', 
    name: 'iShares Physical Gold', 
    category: 'Surowce - Złoto', 
    description: 'Fizyczne złoto jako zabezpieczenie przed inflacją i niepewnością geopolityczną.' 
  },
  { 
    ticker: 'ISLN.L', 
    name: 'iShares Physical Silver', 
    category: 'Surowce - Srebro', 
    description: 'Srebro fizyczne, metal o zastosowaniach zarówno inwestycyjnych, jak i przemysłowych.' 
  },
  { 
    ticker: 'COPA.L', 
    name: 'WisdomTree Copper', 
    category: 'Surowce - Miedź', 
    description: 'Ekspozycja na ceny miedzi - kluczowego metalu dla transformacji energetycznej i przemysłu.' 
  },
  { 
    ticker: 'AIGA.L', 
    name: 'WisdomTree Agriculture', 
    category: 'Surowce - Rolne', 
    description: 'Zdywersyfikowany koszyk surowców rolnych (kawa, kukurydza, cukier, pszenica). Wrażliwy na pogodę i konsumpcję.' 
  },
  { 
    ticker: 'IS3N.DE', 
    name: 'iShares Core MSCI EM IMI UCITS ETF', 
    category: 'Rynki Wschodzące', 
    description: 'Szeroka ekspozycja na kraje rozwijające się (Chiny, Indie, Brazylia, Korea).' 
  }
];

export const INFLUENCERS: Influencer[] = [
  { name: 'Elon Musk', handle: '@elonmusk', impact: 'Tech, Tesla, Sentiment' },
  { name: 'Jerome Powell', handle: 'FED', impact: 'Stopy procentowe, USD' },
  { name: 'Przemysław Kwiecień', handle: '@PrzemekKwiecien', impact: 'Główny Ekonomista XTB, Macro' },
  { name: 'Michael Burry', handle: '@michaeljburry', impact: 'Nastroje niedźwiedzie, Macro' },
  { name: 'Trader21', handle: 'Independent Trader', impact: 'Polski rynek, Surowce, ETF' },
  { name: 'Tarek Al-Wazir (lub lokalni liderzy)', handle: '@TarekAlWazir', impact: 'Europejska polityka gosp.' }
];
