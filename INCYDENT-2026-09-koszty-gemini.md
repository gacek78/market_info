# Incydent: rachunek 564 zł za Gemini API (10–11 września 2026)

> Spisane 2026-09-15. Aplikacja jest **zatrzymana** — patrz „Stan na koniec sesji".

## Co się stało

Między 1 a 14 września 2026 konto rozliczeniowe Google zebrało **563,86 zł**, przy czym
**cała kwota pochodzi z Gemini API w projekcie `marketinfo`** (`gen-lang-client-0769202107`).
Żaden inny projekt ani usługa nie dołożyły ani grosza. Prognoza Google na pełny wrzesień
wynosiła **1 321 zł**.

Punktem wyjścia było pytanie użytkownika, czy rachunek nie pochodzi z syntezy mowy do
podcastu. Nie pochodzi: to zupełnie inny projekt i inna usługa.

## Twarde dane

### Rozbicie na pozycje (1–14 września)

| Pozycja (SKU) | Zużycie | Koszt |
|---|---|---|
| Zapytania wyszukiwania Google, płatne | 7 384 | **383,85 zł** |
| Tokeny wygenerowanego tekstu (gemini 3 flash) | 14 484 644 | **161,35 zł** |
| Tokeny wysłane do modelu | 10 036 200 | 18,63 zł |
| Tokeny z pamięci podręcznej | 177 983 | 0,03 zł |
| Zapytania wyszukiwania, darmowe | 5 085 | 0,00 zł |

Największa pozycja to **płatne zapytania wyszukiwarki** (funkcja „grounding": model dopytuje
Google, żeby oprzeć odpowiedź na świeżych źródłach). Wychodzi ok. 5 groszy za zapytanie.
Darmowy limit dzienny został wyczerpany, reszta poszła po pełnej stawce.

### Koszt dzienny

| Dzień | Koszt |
|---|---|
| 1–4, 7–8 września | 0,56–0,78 zł dziennie |
| 6 września | 6,75 zł |
| 9 września | 4,17 zł |
| **10 września** | **374,34 zł** |
| **11 września** | **140,34 zł** |
| 12 września | 0 zł |
| 13 września | 15,65 zł |
| 14 września | 18,70 zł |

Po szczycie koszt spadł dwudziestokrotnie, ale **nie wrócił do normy** — 13 i 14 września
było ok. 25× drożej niż w typowym dniu z początku miesiąca, i rosło.

### Ruch w API (metryki `generativelanguage.googleapis.com`)

- Szczyt 10–11 września: **~0,055 żądań/s** ≈ 4 700 wywołań dziennie.
- Tło w pozostałe dni: **0,0013 żądań/s** ≈ 110 wywołań dziennie.
- Ruch szedł przez klucz **`marketnew`** — odfiltrowanie klucza `xtb` nie zmieniło wykresu.
  Czyli to ta aplikacja, nie żadna inna.
- 13–15 września ruch ma inny kształt: zamiast całodobowego obciążenia pojedyncze ostre
  skoki, m.in. o 6:00 i koło 16:00.

### Logi kontenera `market_info-backend-1`

- Zwyczajowo **2 linie dziennie**. 10 września: **345**, 11 września: **246**.
- W tym **35 razy** `[GeminiService] Nie udało się sparsować JSON z odpowiedzi`, przy czym
  każda odpowiedź jest **urwana w pół słowa** (np. `"impact": "high` i koniec).
- Błędy są rozrzucone przez całą dobę, **także o 2, 3 i 4 w nocy** — gdy żaden harmonogram
  nie działa.
- Harmonogram zadziałał normalnie: 10 i 11 września o 14:00 UTC (16:00 czasu lokalnego),
  7 celów, ~5 minut, 18 sygnałów. To nie on wygenerował lawinę.

### Konfiguracja, która wtedy obowiązywała (serwerowy `.env`)

```
ALERT_CRON=0 16 * * 1-5      # jeden skan dziennie, dni robocze
ALERT_SEVERITY=high
VALIDATE_SIGNALS=false
PORTFOLIO_SUMMARY=false
```

Ostatni commit w repo pochodził z **25 sierpnia** — kod się w tym czasie nie zmieniał.

## Co jest ustalone, a co nie

**Ustalone:**
- Koszt pochodzi z tej aplikacji (klucz `marketnew`), nie z innego projektu.
- Napędziły go płatne zapytania wyszukiwarki, a w drugiej kolejności tokeny wyjściowe.
- Harmonogram działał prawidłowo i nie odpowiada za skalę ruchu.
- Odpowiedzi modelu bywają ucinane w połowie, co psuje odczyt JSON-a.

**Nieustalone — traktować jako hipotezy:**
- **Co zleciło ~4 700 wywołań na dobę.** Backend nie zapisywał żadnego śladu wywołań Gemini,
  więc nie ma z czego tego odtworzyć. Nocne godziny wykluczają ręczne klikanie w UI,
  a w kodzie nie ma innego timera niż `ALERT_CRON` ani pętli ponawiającej nieudane wywołania.
- **Dlaczego odpowiedzi są ucinane.** Najbardziej prawdopodobne wyjaśnienie to wyczerpanie
  limitu tokenów wyjściowych przez „myślenie" modelu (`gemini-3-flash-preview` rozumuje przed
  odpowiedzią, a te tokeny liczą się do wyjścia). Nigdzie nie ustawiono `maxOutputTokens`,
  więc obowiązuje domyślny limit modelu. **Potwierdzi to dopiero `finish=MAX_TOKENS`
  w nowych logach** (patrz niżej).
- Związek między ucinaniem a liczbą wywołań jest **nieudowodniony**.

## Co zostało zrobione

### 1. Twardy limit wydatków w Google Cloud

Budżet **`limit 10 zl - marketinfo gemini`**: 10 zł miesięcznie, tryb **„Egzekwowanie limitu
wydatków"**, zakres `marketinfo` + Gemini API. Po przekroczeniu Google **wstrzymuje usługę**,
a nie tylko wysyła maila.

Zastrzeżenia, o których ostrzega sama konsola:
- egzekwowanie **nie jest natychmiastowe** — przekroczenie i tak zostanie naliczone,
  dlatego limit warto trzymać poniżej kwoty granicznej;
- limit obejmuje **jeden projekt i jedną usługę** naraz (kwalifikują się tylko Gemini API,
  Vertex AI, Cloud Run i Cloud Run Functions).

**Dlaczego to w ogóle było potrzebne:** budżet na tym koncie **już istniał** — `budzet dla xtb`,
40 zł miesięcznie, z alertami na 50/90/100%. Został przekroczony czternastokrotnie i nie
zatrzymał niczego, bo wysyłał wyłącznie maile. **Sam alert nie jest zabezpieczeniem.**

### 2. Bezpiecznik i pomiar w kodzie (niezacommitowane)

W `backend/geminiService.ts` i `backend/index.ts`:

- wszystkie sześć wywołań Gemini idzie teraz przez jedną funkcję **`callGemini`**;
- **dzienny limit wywołań** — po 300 na dobę backend przestaje wołać Gemini i rzuca błąd
  (`GEMINI_MAX_CALLS_PER_DAY` w `.env`, domyślnie 300). To ok. 3× powyżej normalnego ruchu
  i 15× poniżej lawiny z 10 września;
- **log każdego wywołania**: etykieta, model, czy użyto wyszukiwarki, `finishReason`
  i zużycie tokenów (w tym „myślenie"). `finish=MAX_TOKENS` od razu wskaże ucięcie;
- **`GET /api/gemini-usage`** — bieżący licznik i limit, bez zaglądania do Google Cloud.

Backend przechodzi `npx tsc --noEmit` bez błędów. Kod **nie został zacommitowany
ani wdrożony**.

### 3. Zatrzymanie aplikacji

`docker compose stop` w `/compose/market_info` — **oba** kontenery, backend i frontend
(frontend też ma w sobie klucz do Gemini, patrz `frontend/vite.config.ts`). Ponieważ to
`stop`, kontenery nie wstaną same nawet po restarcie NAS-a.

## Stan na koniec sesji (2026-09-15)

- Aplikacja **zatrzymana**, ruch do Gemini spadł do zera.
- Twardy limit 10 zł **działa**.
- Poprawki w kodzie **czekają niezacommitowane** w drzewie roboczym.

## Zanim aplikacja znów ruszy

1. **Zacommitować i wdrożyć** bezpiecznik z punktu 2 — bez niego nie ma po co startować.
2. **Odczytać z nowych logów `finishReason`** i potwierdzić albo obalić hipotezę o ucinaniu
   odpowiedzi. Jeśli to `MAX_TOKENS` — ograniczyć „myślenie" modelu
   (`thinkingConfig.thinkingBudget`) albo ustawić `maxOutputTokens`.
3. **Ustalić, kto wołał API poza harmonogramem.** Nowy log wywołań pokaże etykietę
   (`fast` / `deep-research` / `deep-structure` / `validate-signal` / `summary` /
   `validate-ticker`), co zawęzi poszukiwania do konkretnej ścieżki.
4. ~~**Sprawdzić, czy frontend nie woła Gemini bezpośrednio z przeglądarki**~~ —
   **sprawdzone 2026-09-20, hipoteza ODRZUCONA.** Szczegóły w aktualizacji niżej.
5. Dopiero po tym podnieść limit w Google powyżej 10 zł, jeśli będzie trzeba.

## Gdzie to sprawdzić

| Co | Gdzie |
|---|---|
| Rachunek z podziałem na pozycje | [Raporty rozliczeń](https://console.cloud.google.com/billing/019F99-060D78-D6D462/reports) — grupowanie „Data › SKU" |
| Budżety i twardy limit | [Budżety i alerty](https://console.cloud.google.com/billing/019F99-060D78-D6D462/budgets) |
| Ruch w API (na bieżąco, bez opóźnienia) | [Metryki Gemini API](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/metrics?project=gen-lang-client-0769202107) |
| Logi backendu | NAS: `docker logs --timestamps market_info-backend-1` |
| Licznik wywołań (po wdrożeniu) | `GET /api/gemini-usage` |

Uwaga: dane rozliczeniowe Google mają **dobę opóźnienia**. Bieżący dzień widać tylko
w metrykach API.

---

# Aktualizacja 2026-09-20

## Co kosztowało — rozbicie faktury

Odczyt z Google Cloud Billing (konto `019F99-060D78-D6D462`, projekt `marketinfo`),
grupowanie po pozycjach cennika, okres 1–19 września 2026. **Razem 565,99 zł**, w całości
Gemini API. Ten sam kawałek sierpnia: 8,71 zł. Najdroższa doba: 374,34 zł.

| Pozycja | Ilość | Koszt | Udział |
|---|---|---|---|
| Zapytania wyszukiwania — płatne | 7 412 | 385,30 zł | 68% |
| Tokeny wyjściowe (gemini 3 flash) | 14 538 724 | 161,95 zł | 29% |
| Tokeny wejściowe | 10 072 674 | 18,70 zł | 3% |
| Tokeny z cache | 177 983 | 0,03 zł | — |
| Zapytania wyszukiwania — darmowe | 5 085 | 0,00 zł | — |

**Wniosek koryguje wcześniejsze założenie.** W notatkach z czerwca przyjęliśmy, że koszt
napędza wyłącznie `googleSearch`. Wyszukiwanie faktycznie dominuje, ale **tokeny wyjściowe
to prawie jedna trzecia rachunku** — limit liczący same wywołania z wyszukiwarką nie
domknąłby tematu. Stawki jednostkowe stąd wyliczone (11,14 zł za milion tokenów wyjściowych,
1,86 zł za milion wejściowych, 5,2 gr za zapytanie wyszukiwania) siedzą teraz
w `backend/constants.ts` i służą do liczenia kosztu na bieżąco.

Kontrola poprawności stawek: 9 400 wywołań z awarii × 1,93 gr = 181 zł, a rachunek za same
tokeny wyniósł 180,65 zł.

## Twardy limit Google zadziałał — ale po fakcie

Budżet `limit 10 zl - marketinfo gemini` (tryb egzekwowany) **osiągnął limit 15 września
o 22:46** — cztery dni po awarii z 10–11 września. Od 16 września każde wywołanie wraca jako:

```
403 Forbidden: "Spend cap breached for project: projects/160906824930
for service: generativelanguage.googleapis.com"
```

Aplikacja była więc **martwa od 16 do 20 września** i nikt tego nie zauważył, bo skan kończył
się cicho („brak treści do wysłania"). Odblokuje się 1 października, wraz z nowym miesiącem
rozliczeniowym.

Drugi budżet, `budzet dla xtb` (40 zł, całe konto), ma w kolumnie stanu **„Nie dotyczy"** —
to sam alert. Pokazuje 565,99 zł / 40,00 zł i nie zatrzymał niczego.

**Konsola Google stwierdza wprost: „Koszty są zazwyczaj rejestrowane w ciągu 24 godzin".**
Przy szczycie 374 zł na dobę limit egzekwowany może przepuścić setki złotych, zanim zadziała.
Nie jest to bezpiecznik, tylko ostatnia siatka — realna ochrona musi działać w aplikacji,
w momencie wysyłki żądania.

## Punkt 4 — hipoteza odrzucona

„Frontend woła Gemini bezpośrednio z przeglądarki, z pominięciem backendu" — **nieprawda.**
Trzy zgodne dowody, zebrane 2026-09-20:

- żaden plik frontendu nie importował `@google/genai` ani nie czytał `process.env`
  (wstrzykiwanie w `vite.config.ts` istniało, ale nie miało odbiorcy);
- na serwerze **nie ma** `frontend/.env`, a w `/compose/market_info/.env` nie ma
  `GEMINI_API_KEY` — `loadEnv` nie znajdował więc nic i `define` wstawiał `undefined`;
- kontener frontendu ma **zero** zmiennych środowiskowych zawierających `GEMINI`/`API_KEY`.

Klucz nigdy nie trafił do przeglądarki, **rotacja nie jest potrzebna**. Cała instalacja
(wstrzykiwanie, wpis w importmap, zależność) została mimo to usunięta — była martwa, ale
gotowa do użycia jednym importem.

## Co zostało do sprawdzenia

**Podwajanie wywołań przez React StrictMode.** Aplikacja chodzi na produkcji na serwerze
deweloperskim vite, a `frontend/index.tsx` opakowuje ją w `React.StrictMode`, który celowo
uruchamia każdy efekt dwa razy. Efekt startujący analizę (`App.tsx`, zależności
`[selectedEtf, initialLoading, isAuthRequired]`) nie ma przed tym blokady, więc jedno wejście
na świeżą zakładkę może kosztować 6 wywołań zamiast 3. **To wniosek z kodu, nie pomiar** —
nie dało się go zweryfikować, bo od 16 września nie ma ani jednego udanego wywołania.

Potwierdzenie po 1 października: w logu backendu szukać **par identycznych wpisów `[Gemini]`
w odstępie sekund**. Log pokazuje teraz także koszt każdego wywołania, więc podwojenie będzie
widać wprost w złotówkach.

## Dlaczego w logach z 16–18 września nie było ani jednej linii `[Gemini]`

Poprawka z 15 września logowała wywołanie **dopiero po udanej odpowiedzi**. Wszystkie 21 żądań
odrzuconych przez Google nie zostawiło śladu, choć każde zajęło miejsce w limicie. To ta sama
dziura („brak śladu w logach"), którą poprawka miała zasypać — załatana 20 września:
nieudane wywołanie loguje się teraz razem z treścią błędu.

## Zabezpieczenia po zmianach z 2026-09-20

| Warstwa | Co robi | Kiedy działa |
|---|---|---|
| `GEMINI_MAX_COST_PLN_PER_MONTH` (5 zł) | liczy realny koszt z `usageMetadata`, blokuje po przekroczeniu | natychmiast |
| `GEMINI_MAX_SEARCH_CALLS_PER_MONTH` (900) | trzyma wyszukiwanie w darmowej puli Google (5000/mies.) | natychmiast |
| `GEMINI_MAX_SEARCH_CALLS_PER_DAY` (25) | dzienny sufit na płatną ścieżkę | natychmiast |
| `GEMINI_MAX_CALLS_PER_DAY` (200) | wykrywacz lawiny | natychmiast |
| Budżet 10 zł u Google | ostatnia siatka | z dobą opóźnienia |

Licznik siedzi w `gemini-usage.json` w `DATA_DIR`, zapisywany atomowo, przeżywa restart
kontenera; nieczytelny plik **blokuje** wywołania zamiast je odblokowywać. Błędna wartość
któregokolwiek limitu **zatrzymuje aplikację** z komunikatem `[KONFIGURACJA]` zamiast po cichu
wracać do wartości domyślnej.

Zużycie zbite do budżetu: `ALERT_CRON=0 16 * * 2,5` (wtorek i piątek, ~9 skanów miesięcznie
× 15 wywołań × 1,93 gr ≈ 2,6 zł, reszta budżetu na ręczne przeglądanie).
