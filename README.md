
# Market info 

Zaawansowany system monitorowania rynków z podziałem na warstwy logiczne.

## Struktura projektu

- `backend/`: Logika biznesowa AI, integracja z Gemini SDK, Google Search Grounding.
- `frontend/`: Warstwa prezentacji, React, Tailwind CSS, zarządzanie stanem UI.
- `docker-compose.yml`: Konfiguracja kontenerów dla środowiska produkcyjnego/deweloperskiego.

## Funkcje

- **Analiza dwufazowa** – szybki podgląd (Flash) + głęboka analiza z Google Search (Pro).
- **Realne dane rynkowe** – kursy walut i VIX pobierane ze Stooq (bez klucza API); AI je interpretuje, nie zgaduje.
- **Trwały stan** – ETF-y, influencerzy i historia alertów zapisywane na dysk (`backend/data/`), przeżywają restart.
- **Powiadomienia Telegram** – backend cyklicznie skanuje rynek i wysyła istotne sygnały na Telegram.

## Powiadomienia Telegram (konfiguracja)

1. Napisz do **@BotFather** na Telegramie → `/newbot` → skopiuj token.
2. Napisz cokolwiek do swojego nowego bota, a potem pobierz `chat_id`:
   `https://api.telegram.org/bot<TOKEN>/getUpdates` → pole `chat.id`.
3. Uzupełnij w `.env`:
   ```
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=...
   ALERT_SEVERITY=high      # low | medium | high
   ALERT_CRON=0 8 * * *     # domyślnie 8:00 codziennie
   ```
4. Restart backendu. Test: `POST /api/alerts/test` (wiadomość kontrolna),
   ręczny skan: `POST /api/alerts/run`.

## Bezpieczeństwo

Klucz API Gemini oraz token Telegrama są wstrzykiwane wyłącznie do warstwy backendowej za pośrednictwem zmiennych środowiskowych, co zapobiega ich wyciekowi do kodu po stronie klienta.
