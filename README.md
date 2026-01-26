
# Market info 

Zaawansowany system monitorowania rynków z podziałem na warstwy logiczne.

## Struktura projektu

- `backend/`: Logika biznesowa AI, integracja z Gemini SDK, Google Search Grounding.
- `frontend/`: Warstwa prezentacji, React, Tailwind CSS, zarządzanie stanem UI.
- `docker-compose.yml`: Konfiguracja kontenerów dla środowiska produkcyjnego/deweloperskiego.

## Bezpieczeństwo

Klucz API Gemini jest wstrzykiwany wyłącznie do warstwy backendowej za pośrednictwem zmiennych środowiskowych, co zapobiega jego wyciekowi do kodu po stronie klienta.
