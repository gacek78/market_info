import { GoogleGenAI } from "@google/genai";
import { MarketIntelligenceResponse, MarketSignal, GlobalMacroData, PortfolioSummary } from "./types";
import { ETF, Influencer } from "./types";
import { fetchMarketQuotes, fetchTickerPrice, resolveRedirect } from "./marketData";
import { MODEL_FAST, MODEL_DEEP, MODEL_STRUCTURE, MODEL_VALIDATE, MODEL_SUMMARY } from "./constants";

const getAI = () => {
  if (!process.env.API_KEY) {
    console.error('[GeminiService] ERROR: API_KEY is not set in environment!');
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY! });
};

/**
 * Robustnie wyciąga obiekt JSON z odpowiedzi modelu.
 *
 * Gemini NIE pozwala łączyć `responseMimeType: 'application/json'` z narzędziem
 * `googleSearch` — w fazie Deep musimy więc prosić o zwykły tekst i sami
 * wydobyć JSON (model często opakowuje go w ```json ... ``` albo dokłada prozę).
 */
function extractJson<T = any>(raw: string | undefined | null): T | null {
  if (!raw) return null;
  let text = raw.trim();

  // Zdejmij ogrodzenie ```json ... ``` lub ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // Spróbuj sparsować całość; jeśli nie, wytnij pierwszy zbalansowany blok {...}
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as T;
      } catch {
        /* poniżej */
      }
    }
  }
  console.error('[GeminiService] Nie udało się sparsować JSON z odpowiedzi:', raw?.slice(0, 300));
  return null;
}

function isAuthError(error: any): boolean {
  const msg = error?.message ?? '';
  return (
    msg.includes('401') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('Requested entity was not found.')
  );
}

// ─── FAST (Faza 1): Gemini Flash bez Google Search ───────────────────────────
export const fetchMarketIntelligenceFast = async (
  target: ETF | 'GLOBAL'
): Promise<MarketIntelligenceResponse> => {
  const ai = getAI();
  const isGlobal = target === 'GLOBAL';

  const specificInstruction = isGlobal
    ? `Krótka analiza makro: ogólny sentyment rynkowy, USD/PLN, Euro/PLN, VIX.
       Wygeneruj 2 szybkie sygnały na podstawie swojej wiedzy.`
    : `Wstępna analiza instrumentu: ${(target as ETF).ticker} — ${(target as ETF).name}.
       Sektor: ${(target as ETF).category}.
       Wygeneruj 2 szybkie sygnały na podstawie swojej wiedzy trenningowej.`;

  const prompt = `
    Działaj jako senior analityk portfela IKE.
    ${specificInstruction}

    WAŻNE: To jest SZYBKA, wstępna analiza (Faza 1). Nie masz dostępu do internetu.
    Bazuj na swojej wiedzy. Oznacz sygnały jako: "phase": "fast".

    ZWRÓĆ WYŁĄCZNIE JSON:
    {
      "globalData": {
        "usdPln": "~wartość szacunkowa",
        "eurPln": "~wartość szacunkowa",
        "eurUsd": "~wartość szacunkowa",
        "vix": "~wartość",
        "cpiPl": "ND", "ratesPl": "ND", "cpiUs": "ND", "ratesUs": "ND",
        "sentiment": 50, "risk": 50
      },
      "signals": [
        {
          "type": "MACRO",
          "severity": "low",
          "priority": "DZIS",
          "title": "Wstępna ocena",
          "summary": "Krótki opis na bazie wiedzy modelu",
          "longTermImpact": "Kontekst IKE"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const data = extractJson<any>(response.text);
    if (!data) return { signals: [], calendar: [] };
    return {
      signals: (data.signals || []).map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        ticker: isGlobal ? 'GLOBAL' : (target as ETF).ticker,
        sources: [],
        phase: 'fast' as const,
        priority: s.priority || 'DZIS',
      })),
      calendar: [],
      globalData: data.globalData ? { ...data.globalData, sources: [] } : undefined,
    };
  } catch (error: any) {
    console.error('Fast API Error:', error);
    if (isAuthError(error)) throw new Error('AUTH_REQUIRED');
    return { signals: [], calendar: [] };
  }
};

// ─── DEEP (Faza 2): dwukrokowo — research z Google Search + strukturyzacja do JSON ──
export const fetchMarketIntelligenceDeep = async (
  target: ETF | 'GLOBAL',
  influencers: Influencer[]
): Promise<MarketIntelligenceResponse> => {
  const ai = getAI();
  const isGlobal = target === 'GLOBAL';
  const influencersList = influencers.map((i) => `${i.name} (${i.handle})`).join(', ');

  // ── Realne dane rynkowe (Stooq) — AI ma je interpretować, nie zgadywać ──
  const quotes = await fetchMarketQuotes();
  const tickerQuote = isGlobal ? null : await fetchTickerPrice((target as ETF).ticker);

  const realDataBlock = `
    TWARDE DANE RYNKOWE (źródło: Stooq, na dzień ${quotes.asOf ?? 'b.d.'}) — TRAKTUJ JE JAKO PRAWDĘ, NIE ZGADUJ:
    - USD/PLN: ${quotes.usdPln}
    - EUR/PLN: ${quotes.eurPln}
    - EUR/USD: ${quotes.eurUsd}
    - VIX: ${quotes.vix}${
      tickerQuote
        ? `\n    - Ostatnia cena ${(target as ETF).ticker}: ${tickerQuote.price} (z ${tickerQuote.date ?? 'b.d.'})`
        : ''
    }
  `;

  const specificInstruction = isGlobal
    ? `ANALIZA MAKRO: Skup się na parach walutowych (USD/PLN, EUR/PLN), inflacji w Polsce i USA oraz ogólnym nastroju rynkowym.
       Pobierz AKTUALNE newsy i kontekst przez Google Search (dane liczbowe walut/VIX masz już podane wyżej — użyj ich).

       OBOWIĄZKOWO ustal przez Google Search i podaj na początku, w osobnej sekcji "DANE MAKRO",
       AKTUALNE liczby (każda z datą/okresem) — nawet jeśli nie są głównym tematem dnia:
       - CPI USA (inflacja r/r),
       - CPI Polska (inflacja r/r),
       - stopa referencyjna NBP,
       - górna granica przedziału stóp Fed (Fed funds).
       Każda z tych czterech liczb MUSI się pojawić w tekście.

       Monitoruj wypowiedzi tych osób: ${influencersList}.`
    : `GŁĘBOKA ANALIZA INSTRUMENTU: ${(target as ETF).ticker} (${(target as ETF).name}).
       ZAKAZ: Nie podawaj ogólnych danych o inflacji w Polsce czy kursie EUR/PLN, chyba że mają KLUCZOWY wpływ na ten instrument.
       SKUP SIĘ NA:
       1. Newsy dotyczące bezpośrednio ${(target as ETF).ticker}.
       2. Sytuacja w sektorze: ${(target as ETF).category}.
       3. Co te osoby mówią o tym aktywie lub sektorze: ${influencersList}.
       4. Wyniki finansowe największych spółek w tym ETF.`;

  // KROK 1 — RESEARCH: naturalny prompt + Google Search.
  // WAŻNE: wymuszanie "zwróć JSON" wyłącza wyszukiwanie (model odpowiada z pamięci),
  // dlatego research prosimy tekstem — wtedy grounding realnie działa i daje źródła.
  const researchPrompt = `
    Działaj jako senior analityk portfela IKE.
    ${realDataBlock}
    ${specificInstruction}

    Przeszukaj internet (Google) i zbierz NAJNOWSZE, KONKRETNE informacje — każdy wątek
    z datą, liczbą i wydarzeniem. Wypisz 3-5 najważniejszych, aktualnych tematów dla tego
    instrumentu. Dla każdego: co się stało, kiedy, dlaczego to ważne dla długoterminowego IKE.
    Pisz zwięźle, rzeczowo. Opieraj się WYŁĄCZNIE na znalezionych informacjach.
  `;

  try {
    const research = await ai.models.generateContent({
      model: MODEL_DEEP,
      contents: researchPrompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const researchText = research.text ?? '';
    const rawSources =
      research.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Web Reference',
        uri: chunk.web?.uri || '#',
      })) || [];

    // Google grounding daje redirect `vertexaisearch` zamiast prawdziwego URL-a,
    // a `title` to często sama nazwa serwisu bez domeny — przez co frontend nie
    // umiał ocenić wiarygodności (wszystko ❓). Rozwiązujemy redirect na realny
    // URL + domenę, żeby kredytowanie i klikalne linki faktycznie działały.
    const searchSources = await Promise.all(
      rawSources.map(async (s) => {
        const resolved = s.uri && s.uri !== '#' ? await resolveRedirect(s.uri) : null;
        const fromTitle = s.title.toLowerCase().match(/[a-z0-9-]+\.[a-z.]{2,}/)?.[0];
        return {
          title: s.title,
          uri: resolved?.finalUrl ?? s.uri,
          domain: resolved?.domain ?? fromTitle,
        };
      }),
    );

    // Ponumerowana lista źródeł — model przy każdym sygnale wskaże, które go potwierdzają.
    const sourceList = searchSources
      .map((s, i) => `[${i + 1}] ${s.domain ?? s.title}`)
      .join('\n');

    // KROK 2 — STRUKTURYZACJA: zamień research na czysty JSON (bez search → można JSON mode).
    const structurePrompt = `
      Na podstawie PONIŻSZEJ ANALIZY zamień ją na sygnały rynkowe. NIE dodawaj informacji
      spoza analizy. Zachowaj konkrety (daty, liczby).

      ANALIZA:
      ${researchText}
${
  sourceList
    ? `
      DOSTĘPNE ŹRÓDŁA (numeruj od 1):
      ${sourceList}

      Dla KAŻDEGO sygnału w polu "sourceIndices" podaj numery TYLKO tych źródeł, które
      potwierdzają DOKŁADNIE tę konkretną informację (zwykle 1-2). Nie wrzucaj wszystkich
      źródeł do każdego sygnału. Gdy nie da się przypisać żadnego — podaj pustą listę [].
`
    : ''
}
      ZASADY dla globalData (wyciągnij z sekcji "DANE MAKRO" oraz reszty analizy):
      - "cpiUs" = inflacja CPI USA r/r jako LICZBA z % (np. "4.2%").
      - "cpiPl" = inflacja CPI Polska r/r jako LICZBA z % (np. "3.1%").
      - "ratesPl" = aktualna stopa referencyjna NBP jako LICZBA z % (np. "5.75%").
      - "ratesUs" = górna granica przedziału Fed funds jako LICZBA z % (np. "3.75%").
      - Każda z tych czterech liczb jest w analizie — MUSISZ ją wypełnić. NIE wpisuj
        słów typu "bez zmian"/"stabilnie", tylko liczbę. "ND" jest dopuszczalne TYLKO
        gdy danej liczby faktycznie nie ma w analizie.

      ZWRÓĆ WYŁĄCZNIE JSON:
      {
        "globalData": {
          "cpiPl": "3.1%", "ratesPl": "5.75%",
          "cpiUs": "4.2%", "ratesUs": "3.75%",
          "sentiment": 50, "risk": 50
        },
        "signals": [
          {
            "type": "NEWS",
            "severity": "low|medium|high",
            "priority": "DZIS|TYDZIEN|MIESIAC",
            "title": "Tytuł sygnału",
            "summary": "Konkretny opis z datą",
            "longTermImpact": "Dlaczego to ważne dla emerytalnego IKE",
            "sourceIndices": [1]
          }
        ]
      }
    `;

    const structured = await ai.models.generateContent({
      model: MODEL_STRUCTURE,
      contents: structurePrompt,
      config: { responseMimeType: 'application/json' },
    });

    const data = extractJson<any>(structured.text);
    if (!data) return { signals: [], calendar: [], globalData: { ...quotes, sources: searchSources.slice(0, 5) } as any };

    // Realne kursy/VIX zawsze nadpisują to, co wymyśli model.
    const mergedGlobal = {
      ...(data.globalData || {}),
      usdPln: quotes.usdPln,
      eurPln: quotes.eurPln,
      eurUsd: quotes.eurUsd,
      vix: quotes.vix,
      sources: searchSources.slice(0, 5),
    };

    const deepSignals: MarketSignal[] = (data.signals || []).map((s: any) => {
      // Przypisz każdemu sygnałowi TYLKO źródła wskazane przez model (sourceIndices,
      // numerowane od 1), zamiast dolepiać wszystkim tę samą trójkę. Indeksy spoza
      // zakresu i duplikaty odrzucamy; brak wskazań → brak źródeł (uczciwiej niż mylące).
      const idxs: number[] = Array.isArray(s.sourceIndices) ? s.sourceIndices : [];
      const picked = [...new Set(idxs)]
        .map((n) => searchSources[Number(n) - 1])
        .filter((x): x is (typeof searchSources)[number] => !!x)
        .slice(0, 3);
      const { sourceIndices, ...rest } = s;
      return {
        ...rest,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        ticker: isGlobal ? 'GLOBAL' : (target as ETF).ticker,
        sources: picked,
        phase: 'deep' as const,
        priority: s.priority || 'DZIS',
      };
    });

    // Zabezpieczenie: gdy model całkiem zignorował sourceIndices (żaden sygnał nie
    // dostał źródła), nie zostawiamy feedu bez źródeł — wracamy do top-3 dla każdego.
    if (searchSources.length > 0 && deepSignals.every((s) => s.sources.length === 0)) {
      const top = searchSources.slice(0, 3);
      deepSignals.forEach((s) => { s.sources = top; });
    }

    return {
      signals: await verifyHighSeveritySignals(deepSignals),
      calendar: [],
      globalData: mergedGlobal,
    };
  } catch (error: any) {
    console.error('Deep API Error:', error);
    if (isAuthError(error)) throw new Error('AUTH_REQUIRED');
    return { signals: [], calendar: [] };
  }
};

// ─── WALIDACJA SYGNAŁÓW (anty-halucynacja) ───────────────────────────────────
/**
 * Weryfikuje sygnały wysokiej wagi osobnym wywołaniem z Google Search.
 * Faza Deep struktury potrafi wyolbrzymić lub zmyślić tytuł mimo grounding —
 * tu sprawdzamy każdy `high`-severity przez wyszukiwarkę i ustawiamy `verified`.
 *
 * Sterowane env `VALIDATE_SIGNALS`:
 *   - 'false' / '0'  → wyłączone (brak dodatkowych wywołań),
 *   - w innym wypadku → walidujemy tylko sygnały high-severity (domyślnie).
 */
export const verifyHighSeveritySignals = async (
  signals: MarketSignal[],
): Promise<MarketSignal[]> => {
  if ((process.env.VALIDATE_SIGNALS ?? '').toLowerCase() === 'false' ||
      process.env.VALIDATE_SIGNALS === '0') {
    return signals;
  }

  const ai = getAI();
  return Promise.all(
    signals.map(async (s) => {
      if (s.severity !== 'high') return s;
      try {
        const prompt = `
          Zweryfikuj przez Google Search, czy poniższe twierdzenie rynkowe jest
          PRAWDZIWE i AKTUALNE (nie zmyślone, zgodne z faktami):
          Tytuł: "${s.title}"
          Opis: "${s.summary}"
          ZWRÓĆ WYŁĄCZNIE JSON: { "verified": true|false, "note": "krótkie uzasadnienie" }
        `;
        const response = await ai.models.generateContent({
          model: MODEL_VALIDATE,
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] },
        });
        const data = extractJson<{ verified?: boolean }>(response.text);
        // Brak jednoznacznej odpowiedzi traktujemy jako "nie udało się potwierdzić".
        return { ...s, verified: data?.verified === true };
      } catch {
        return { ...s, verified: false };
      }
    }),
  );
};

// ─── PODSUMOWANIE PORTFELOWE ("Podsumowanie dla mnie") ───────────────────────
/**
 * Synteza portfelowa: bierze WSZYSTKIE świeże sygnały (ze skanu makro + każdego
 * aktywa) i opis strategii inwestora, po czym zwraca jedno zwięzłe podsumowanie —
 * co najnowsze informacje znaczą dla planów inwestycyjnych użytkownika.
 *
 * Jedno wywołanie modelu w trybie JSON (bez Google Search — to czysta synteza nad
 * już zebranymi sygnałami). ZASADA anty-halucynacji: model NIE może dodawać
 * informacji spoza dostarczonych sygnałów.
 */
export const generatePortfolioSummary = async (
  strategy: string,
  signals: MarketSignal[],
  globalData?: GlobalMacroData,
): Promise<PortfolioSummary> => {
  const ai = getAI();

  // Lista śledzonych tickerów (z sygnałów, bez GLOBAL) — model ma się trzymać tych aktywów.
  const tickers = [...new Set(signals.map((s) => s.ticker).filter((t) => t && t !== 'GLOBAL'))];

  const macroBlock = globalData
    ? `DANE MAKRO (twarde, użyj jako kontekst): USD/PLN ${globalData.usdPln}, EUR/PLN ${globalData.eurPln}, ` +
      `VIX ${globalData.vix}, CPI PL ${globalData.cpiPl}, CPI US ${globalData.cpiUs}, ` +
      `stopa NBP ${globalData.ratesPl}, Fed ${globalData.ratesUs}.`
    : '';

  const signalsBlock = signals
    .map(
      (s, i) =>
        `[${i + 1}] (${s.ticker}, ${s.severity}) ${s.title}: ${s.summary}` +
        (s.longTermImpact ? ` | IKE: ${s.longTermImpact}` : ''),
    )
    .join('\n');

  const prompt = `
    Działaj jako senior doradca portfela IKE. Napisz spersonalizowane PODSUMOWANIE dla inwestora.

    STRATEGIA INWESTORA (dopasuj ton i rekomendacje do niej):
    ${strategy}

    ${macroBlock}

    ŚWIEŻE SYGNAŁY (jedyne źródło — NIE dodawaj informacji spoza tej listy):
    ${signalsBlock || '(brak sygnałów — napisz, że nie wykryto istotnych zmian)'}

    Śledzone aktywa: ${tickers.join(', ') || '(brak)'}.

    Zsyntetyzuj to w skrócie: ogólny wydźwięk dla portfela, co to znaczy KONKRETNIE dla planów
    inwestora (z uwzględnieniem jego strategii), oraz rekomendacja per aktyw. Pisz po polsku,
    rzeczowo, bez ogólników. Rekomendacje muszą wynikać z sygnałów, a nie z domysłów.

    ZWRÓĆ WYŁĄCZNIE JSON:
    {
      "overall": "BULLISH|NEUTRAL|BEARISH",
      "headline": "Jedno zdanie podsumowania",
      "narrative": "3-5 zdań: co się dzieje i co to znaczy dla planu inwestycyjnego",
      "perAsset": [
        { "ticker": "XNAS.DE", "stance": "HOLD|ACCUMULATE|WATCH|REDUCE", "note": "krótkie uzasadnienie z sygnału" }
      ],
      "actions": ["konkretna sugestia działania"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_SUMMARY,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    const data = extractJson<any>(response.text);
    return {
      overall: data?.overall === 'BULLISH' || data?.overall === 'BEARISH' ? data.overall : 'NEUTRAL',
      headline: data?.headline ?? 'Brak istotnych zmian dla portfela.',
      narrative: data?.narrative ?? '',
      perAsset: Array.isArray(data?.perAsset) ? data.perAsset : [],
      actions: Array.isArray(data?.actions) ? data.actions : [],
      strategy,
      timestamp: new Date(),
    };
  } catch (error: any) {
    console.error('Portfolio Summary Error:', error);
    if (isAuthError(error)) throw new Error('AUTH_REQUIRED');
    return {
      overall: 'NEUTRAL',
      headline: 'Nie udało się wygenerować podsumowania.',
      narrative: '',
      perAsset: [],
      actions: [],
      strategy,
      timestamp: new Date(),
    };
  }
};

// ─── VALIDATE TICKER ──────────────────────────────────────────────────────────
export const validateAndFetchTickerDetails = async (ticker: string): Promise<ETF | null> => {
  const ai = getAI();
  try {
    const prompt = `
      Sprawdź dostępność tickera "${ticker}" w ofercie brokera XTB (IKE/IKZE - akcje i ETFy, nie CFD).
      ZWRÓĆ WYŁĄCZNIE JSON:
      {
        "ticker": "${ticker}",
        "name": "Pełna Nazwa",
        "category": "Kategoria",
        "description": "Dlaczego warto w IKE (max 120 znaków)",
        "existsInXtb": true
      }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_VALIDATE,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const data = extractJson<any>(response.text);
    return data && data.existsInXtb ? data : null;
  } catch {
    return null;
  }
};
