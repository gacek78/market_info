# Market Sentiment - Deployment na NAS (OMV)

## Konfiguracja wstępna

### 1. Klonowanie repozytorium

Na NAS-ie (via SSH):

```bash
cd /docker/compose
git clone https://github.com/gacek78/kopia-kopiii-market.git market_sentyment
cd market_sentyment
```

### 2. Przygotowanie zmiennych środowiskowych

Utwórz plik `.env` w głównym katalogu projektu:

```bash
cat > .env << 'EOF'
GEMINI_API_KEY=tu_wklej_swoj_klucz_API_od_gemini
EOF
```

⚠️ **WAŻNE**: Plik `.env` **nigdy** nie trafia na GitHub - jest w `.gitignore`

### 3. Przygotowanie backend/Dockerfile

Utwórz `backend/Dockerfile`:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### 4. Przygotowanie frontend/Dockerfile

Jest już gotowy w root: `Dockerfile`

## Deploy z Docker Compose

### Budowanie i uruchamianie

```bash
cd /docker/compose/market_sentyment
docker compose up -d --build
```

### Weryfikacja

```bash
# Sprawdź status kontenerów
docker compose ps

# Sprawdź logi backendu
docker compose logs market_sentiment_backend

# Sprawdź logi frontendu
docker compose logs market_sentiment_frontend

# Test health check
curl http://localhost:3000/health
```

### Dostęp do aplikacji

- **Frontend**: http://nas.local (lub http://IP_NASIA)
- **Backend API**: http://nas.local:3000

## Zarządzanie kontenerami

### Zatrzymanie

```bash
cd /docker/compose/market_sentyment
docker compose down
```

### Restart

```bash
docker compose restart
```

### Aktualizacja z GitHub

```bash
git pull origin main
docker compose up -d --build
```

## Troubleshooting

### Backend zwraca 401 Unauthorized

- Sprawdź czy `.env` ma poprawny `GEMINI_API_KEY`
- Sprawdź logi: `docker compose logs market_sentiment_backend`

### Frontend nie łączy się z backend

- Sprawdź czy backend jest uruchomiony: `docker compose ps`
- Sprawdź network: `docker network ls`

### Czyszczenie

```bash
# Usunięcie kontenerów i sieci
docker compose down

# Usunięcie obrazów (rebuild przy następnym uruchomieniu)
docker compose down --rmi all

# Pełne czyszczenie (uwaga!)
docker system prune -a
```

## Integracja z OMV Web UI

Go to: Openmediavault → Services → Docker → Compose

1. Click "Add" → New Project
2. Project Name: `market_sentyment`
3. Path: `/docker/compose/market_sentyment`
4. Click Save
5. Select project → Click "Up"

Abo z CLI w OMV:

```bash
sudo docker compose -f /docker/compose/market_sentyment/docker-compose.yml up -d
```
