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
4. **Sprawdzić, czy frontend nie woła Gemini bezpośrednio z przeglądarki** — klucz jest
   mapowany w `frontend/vite.config.ts`, więc trafia do paczki wysyłanej do przeglądarki.
   To niezbadany trop, a tłumaczyłby wywołania bez udziału backendu.
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
