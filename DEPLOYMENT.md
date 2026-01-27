# Market Info - Wdrożenie na NAS (OMV)

## Wymagania

- Docker
- Docker Compose
- Klucz API Google Gemini (z włączonym billingiem)
- Minimum 2GB RAM dostępnej dla kontenerów

## Porty (zmieniane na: 3001 i 81)

⚠️ **WAŻNE ZMIANY PORTÓW I ZABEZPIECZEŃSTWA:**

### 1. docker-compose.yml (w głównym katalogu)

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "81:3001"  # Frontend dostępny na porcie 81
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=http://localhost:3001  # Backend API URL
    volumes:
      - ./frontend:/app/frontend
      - /app/frontend/node_modules
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}  # Przekazywany w runtime, NIE w pliku
      - PORT=3001
    ports:
      - "3001:3001"  # Backend wewnętrzny
    volumes:
      - ./backend:/app/backend
```

### 2. Frontend (React/Vite)

Frontend komunikuje z backendem poprzez HTTP API:

```typescript
// frontend/services/apiService.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Wywoływane endpoint'y:
// POST /api/market-intel
// POST /api/validate-ticker
```

### 3. Backend (Express.js + Gemini API)

- ✅ Backend bezpośrednio komunikuje się z Gemini API
- ✅ Frontend wysyła żądania do backendu (nie do Gemini bezpośrednio)
- ✅ **Brak .env pliku w Docker image** - klucz API jest bezpieczny
- ✅ Dockerfile zawiera wieloetapową kompilację TypeScript

## Architektura

```
HOST (NAS)
├── PORT 81 ──→ Frontend (React/Vite)
│   └── http://localhost:3001 ──→ Backend API
├── PORT 3001 ──→ Backend (Express.js)
│   └── Google Gemini API (bezpieczeństwo)
└── Docker Network (internal)
    ├── Frontend ←→ Backend
    └── Backend ←→ Gemini API
```

## Instalacja i Uruchomienie

### Krok 1: Klonowanie repozytorium

```bash
git clone https://github.com/gacek78/market_info.git
cd market_info
```

### Krok 2: Ustawienie zmiennej środowiskowej

```bash
# Bezpośrednio przed docker-compose:
export GEMINI_API_KEY="your-api-key-here"

# LUB: Utwórz plik .env (nie będzie commitowany):
echo 'GEMINI_API_KEY=your-api-key-here' > .env

# Następnie:
set -a && source .env && set +a
```

### Krok 3: Budowanie i uruchomienie

```bash
# Buduj obrazy Docker
docker-compose build

# Uruchom kontenery
docker-compose up -d
```

### Krok 4: Sprawdzenie statusu

```bash
# Wyświetl uruchomione kontenery
docker-compose ps

# Sprawdź logi backendu
docker-compose logs backend

# Sprawdź logi frontendu
docker-compose logs frontend
```

## Dostęp do aplikacji

- **Frontend**: http://nas-ip:81 (http://localhost:81 na lokalnym komputerze)
- **Backend API**: http://nas-ip:3001/api/market-intel (do testowania)
- **Health Check**: http://nas-ip:3001/health

## Troubleshooting

### Problem: Kontenery nie startują

```bash
# Sprawdź logi
docker-compose logs

# Rebuild kontenerów
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Problem: Frontend nie komunikuje się z backendem

1. Sprawdź czy backend jest uruchomiony: `docker-compose ps`
2. Zweryfikuj REACT_APP_API_URL w docker-compose.yml
3. Sprawdź czy port 3001 jest dostępny

### Problem: Błędy TypeScript w backendzie

```bash
# Rebuild backendu z czyszczeniem cache
docker-compose down
docker system prune -a
docker-compose build --no-cache backend
docker-compose up -d
```

## Bezpieczeństwo

✅ **Co zostało zrobione:**
- Klucz API Gemini NIE jest w docker image
- Klucz jest przekazywany jako zmienna środowiskowa w runtime
- Frontend nie ma bezpośredniego dostępu do Gemini API
- Frontend komunikuje się z backendem poprzez HTTP
- Backend obsługuje wszystkie żądania do Gemini API

⚠️ **Ważne:**
- Nikdy nie commituj .env pliku do repozytorium
- Zmień domyślne porty jeśli są zajęte na Twoim systemie
- Użyj HTTPS w produkcji (reverse proxy)

## Aktualizacja aplikacji

```bash
# Pobierz najnowszy kod
git pull origin main

# Rebuild kontenerów
docker-compose down
docker-compose build
docker-compose up -d
```

## Wyłączanie aplikacji

```bash
# Zatrzymaj kontenery
docker-compose down

# Zatrzymaj i usuń volumeny (ostrzeżenie: spowoduje utratę danych)
docker-compose down -v
```
