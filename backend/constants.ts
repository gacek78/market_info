import { ETF, Influencer } from './types';

// ─── Modele Gemini (jedno miejsce do zmiany) ─────────────────────────────────
export const MODEL_FAST = 'gemini-3-flash-preview';
// Faza Deep: research + Google Search. 3-flash jest ~3× tańszy od 'gemini-3.5-flash'
// ($0.50/$3 vs $1.50/$9 za 1M tokenów) — wróć na 3.5, gdyby jakość researchu spadła.
export const MODEL_DEEP = 'gemini-3-flash-preview';
export const MODEL_STRUCTURE = 'gemini-3-flash-preview'; // szybkie formatowanie research → JSON (bez search)
export const MODEL_VALIDATE = 'gemini-3-flash-preview';
export const MODEL_SUMMARY = MODEL_STRUCTURE; // synteza portfelowa: JSON, bez search

// ─── Ceny Gemini w złotówkach (zmierzone, nie z cennika) ─────────────────────
/**
 * Wyliczone z realnego rachunku za 1-19 września 2026 (Google Cloud Billing,
 * projekt marketinfo, rozbicie na pozycje cennika):
 *   tokeny wyjściowe  161,95 zł / 14 538 724 szt.  = 11,14 zł za milion
 *   tokeny wejściowe   18,70 zł / 10 072 674 szt.  =  1,86 zł za milion
 *   wyszukiwanie      385,30 zł /      7 412 szt.  =  0,052 zł za zapytanie
 * Bierzemy ceny zmierzone, a nie z cennika, bo to one trafiają na fakturę.
 * Gdy Google zmieni stawki albo zmienimy model — poprawić tutaj.
 */
export const CENA_ZL_ZA_MLN_TOKENOW_WY = 11.14;
export const CENA_ZL_ZA_MLN_TOKENOW_WE = 1.86;

// ─── Domyślna strategia inwestora (edytowalna w UI, trzymana w state.json) ────
export const DEFAULT_STRATEGY =
  'IKE = konto emerytalne, horyzont kilkanaście lat. TYLKO KUPUJĘ — nie sprzedaję nic, ' +
  'nigdy, niezależnie od sytuacji rynkowej. Co miesiąc wpłacam 700 zł metodą DCA i muszę ' +
  'kupić coś ze stałego zestawu nawet wtedy, gdy nie ma żadnego dobrego sygnału — ' +
  'pominięcie miesiąca nie wchodzi w grę. Wiem, że w tym horyzoncie wyszukiwanie idealnych ' +
  'momentów ma niewielkie znaczenie; zależy mi na tym, żeby wpłatę skierować tam, gdzie ' +
  'akurat jest najtaniej albo najrozsądniej, i żeby rozumieć dlaczego. ' +
  'Spadki to okazja do dokupienia, nie powód do paniki.';

/**
 * Miesięczna wpłata DCA w złotych. Podsumowanie dzieli TĘ kwotę między aktywa —
 * bez niej model dawałby ogólniki zamiast konkretnej propozycji „gdzie te 700 zł".
 */
export const DCA_BUDGET_PLN = Number(process.env.DCA_BUDGET_PLN ?? 700);

export const TRACKED_ETFS: ETF[] = [
  { ticker: 'XNAS.DE', name: 'iShares Nasdaq 100 UCITS ETF', category: 'Technologia USA', description: '100 największych spółek tech z Nasdaq.' },
  { ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World UCITS ETF', category: 'Akcje Globalne', description: 'Fundament dywersyfikacji — rynki rozwinięte i wschodzące.' },
  { ticker: 'SWIG80TR', name: 'Beta ETF sWIG80TR', category: 'Polska - Małe Spółki', description: 'Polskie małe spółki (sWIG80 Total Return).' },
  { ticker: 'CLN.PL', name: 'Celon Pharma S.A.', category: 'Farmacja / GPW', description: 'Polska spółka farmaceutyczna (biotech) z GPW.' },
  { ticker: 'XTB.PL', name: 'XTB S.A.', category: 'Finanse / Broker', description: 'Akcje brokera XTB — wrażliwe na wolumen rynkowy.' },
  { ticker: 'DNP.PL', name: 'Dino Polska S.A.', category: 'Handel Detaliczny', description: 'Sieć handlowa Dino — wzrostowa spółka z GPW.' },
];

export const DEFAULT_INFLUENCERS: Influencer[] = [
  { name: 'Elon Musk', handle: '@elonmusk', impact: 'Tech, Tesla, Sentiment' },
  { name: 'Jerome Powell', handle: 'FED (byly Prezes)', impact: 'Czlonek Rady FED do 2028, wciaz wplywowy' },
  { name: 'Kevin Warsh', handle: 'FED', impact: 'Prezes FED od 05/2026, stopy procentowe, USD' },
  { name: 'Przemyslaw Kwiecien', handle: '@PrzemekKwiecien', impact: 'Glowny Ekonomista XTB, Macro' },
  { name: 'Michael Burry', handle: '@michaeljburry', impact: 'Nastroje niedzwiedzie, Macro' },
  { name: 'Trader21', handle: 'Independent Trader', impact: 'Polski rynek, Surowce, ETF' },
];
