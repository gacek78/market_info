
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
    name: 'Celon Pharma S.A.',
    category: 'Farmacja / GPW',
    description: 'Polska spółka farmaceutyczna (biotech) z GPW.',
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
  // Agencje / czołowa prasa finansowa
  'reuters.com': 'high',
  'bloomberg.com': 'high',
  'ft.com': 'high',
  'wsj.com': 'high',
  'economist.com': 'high',
  'pap.pl': 'high',
  'bankier.pl': 'high',
  'parkiet.com': 'high',
  'bbc.com': 'high',
  'apnews.com': 'high',
  // Źródła oficjalne / instytucjonalne (dane u źródła)
  'nbp.pl': 'high', // Narodowy Bank Polski — pierwotne źródło dla stóp/komunikatów
  'stat.gov.pl': 'high', // GUS — pierwotne źródło dla CPI/inflacji
  'gov.pl': 'high',
  'ecb.europa.eu': 'high', // Europejski Bank Centralny
  'federalreserve.gov': 'high',
  'obserwatorfinansowy.pl': 'high', // portal NBP
  // Wiarygodne, ale publicystyczne / wtórne
  'cnbc.com': 'medium',
  'tradingeconomics.com': 'medium', // szeroko cytowany agregator danych makro
  'gurufocus.com': 'medium',
  'forbes.pl': 'medium',
  'cbsnews.com': 'medium',
  'marketwatch.com': 'medium',
  'money.pl': 'medium',
  'stooq.pl': 'medium',
  'stockwatch.pl': 'medium',
  'strefainwestorow.pl': 'medium',
  'comparic.pl': 'medium',
  'businessradio.pl': 'medium',
  'seekingalpha.com': 'medium',
  'investing.com': 'medium',
  'businessinsider.com': 'medium',
};

// Aliasy nazw serwisów → domena. Google grounding bywa, że w `title` podaje samą
// nazwę bez kropki (np. „Reuters"), więc regex domeny nie trafia — wtedy mapujemy
// nazwę na domenę, żeby kredytowanie i tak zadziałało (fallback, gdy backend nie
// rozwiązał domeny z redirectu vertexaisearch).
export const SOURCE_NAME_ALIASES: Record<string, string> = {
  reuters: 'reuters.com',
  bloomberg: 'bloomberg.com',
  'financial times': 'ft.com',
  ft: 'ft.com',
  'wall street journal': 'wsj.com',
  wsj: 'wsj.com',
  economist: 'economist.com',
  pap: 'pap.pl',
  bankier: 'bankier.pl',
  parkiet: 'parkiet.com',
  bbc: 'bbc.com',
  'associated press': 'apnews.com',
  cnbc: 'cnbc.com',
  marketwatch: 'marketwatch.com',
  money: 'money.pl',
  stooq: 'stooq.pl',
  stockwatch: 'stockwatch.pl',
  'strefa inwestorów': 'strefainwestorow.pl',
  comparic: 'comparic.pl',
  'seeking alpha': 'seekingalpha.com',
  investing: 'investing.com',
  'business insider': 'businessinsider.com',
};

// ─── Domyślna strategia inwestora (fallback; źródłem prawdy jest backend) ─────
export const DEFAULT_STRATEGY =
  'Długoterminowe IKE (horyzont 10-15 lat), regularna akumulacja, podejście buy-and-hold. ' +
  'Spadki traktuję jako okazje do dokupienia, nie panikuję. Priorytet: szeroka dywersyfikacja i niskie koszty.';

// ─── Cache TTL ────────────────────────────────────────────────────────────────
export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 godzina
