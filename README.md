
# Market info 

Zaawansowany system monitorowania rynków z podziałem na warstwy logiczne.

## Struktura projektu

- `backend/`: Logika biznesowa AI, integracja z Gemini SDK, Google Search Grounding.
- `frontend/`: Warstwa prezentacji, React, Tailwind CSS, zarządzanie stanem UI.
- `docker-compose.yml`: Konfiguracja kontenerów dla środowiska produkcyjnego/deweloperskiego.

## Funkcje

- **Analiza dwufazowa** – szybki podgląd (Flash) + głęboka analiza z Google Search (Pro).
- **Realne dane rynkowe** – kursy walut z Frankfurter (EBC), VIX z Yahoo Finance, ceny instrumentów ze Stooq (bez klucza API); AI je interpretuje, nie zgaduje.
- **Trwały stan** – ETF-y, influencerzy i historia alertów zapisywane na dysk (`backend/data/`), przeżywają restart.
- **Powiadomienia Telegram** – backend skanuje rynek o zdefiniowanych godzinach (wiele pór dziennie) i wysyła istotne sygnały na Telegram, wg czasu polskiego.

## Powiadomienia Telegram (konfiguracja)

1. Napisz do **@BotFather** na Telegramie → `/newbot` → skopiuj token.
2. Napisz cokolwiek do swojego nowego bota, a potem pobierz `chat_id`:
   `https://api.telegram.org/bot<TOKEN>/getUpdates` → pole `chat.id`.
3. Uzupełnij w `.env`:
   ```
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=...
   ALERT_SEVERITY=high               # low | medium | high
   ALERT_CRON=0 5 * * *;55 13 * * *  # godziny skanów; wiele pór rozdziel ';'
   ```
   `ALERT_CRON` przyjmuje kilka wyrażeń cron rozdzielonych `;` (powyżej: skan o **5:00** i **13:55**).
   Godziny liczone są wg czasu polskiego — `docker-compose.yml` ustawia `TZ=Europe/Warsaw`,
   a obraz backendu instaluje `tzdata` (alpine bez tego ignoruje `TZ` i cron leci wg UTC).
4. Restart backendu. Test: `POST /api/alerts/test` (wiadomość kontrolna),
   ręczny skan: `POST /api/alerts/run`.

## Bezpieczeństwo

Klucz API Gemini oraz token Telegrama są wstrzykiwane wyłącznie do warstwy backendowej za pośrednictwem zmiennych środowiskowych, co zapobiega ich wyciekowi do kodu po stronie klienta.

## Historia zmian

Skrót prac wykonanych na aplikacji:

- **Strefa czasowa alertów** – `TZ=Europe/Warsaw` w `docker-compose.yml` + `tzdata` w obrazie backendu. Wcześniej alpine ignorował `TZ` i cron leciał wg UTC (alerty 2 h za późno); teraz `ALERT_CRON` liczony jest wg czasu polskiego.
- **Wiele godzin alertów** – `ALERT_CRON` przyjmuje kilka wyrażeń cron rozdzielonych `;` (np. skan o 5:00 i 13:55).
- **UI – spójność i rebranding** – nazwa ujednolicona do „Market Info"; usunięty zdublowany przycisk odświeżania; ujednolicone panele (zaokrąglenia, akcenty, bez niespójnego „glow"); siatka makro z czytelnymi podpisami (USD/PLN, EUR/PLN, NBP, FED, VIX); filtry bez kolorów kolidujących z `severity`; teksty po polsku z zachowanymi terminami rynkowymi.
- **Odporność na restart** – `restart: unless-stopped` dla obu serwisów (apka wstaje sama po restarcie Dockera / reboocie serwera).
- **Dokumentacja** – dodany `CLAUDE.md` z opisem architektury i pułapek dla przyszłych sesji.
