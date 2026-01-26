# Market Info - Deployment na NAS (OMV)


### Porty (zmienione na: 3001 i 81)

**📍 GDZIE ZMIENIĆ PORTY I ZALEŻNOŚCI:**

1. **docker-compose.yml** (root katalogu)
   ```yaml
   services:
     market_info_backend:
       ports:
         - "3001:3000"   # HOST_PORT:CONTAINER_PORT
     
     market_info_frontend:
       ports:
         - "81:80"       # HOST_PORT:CONTAINER_PORT
       environment:
         - VITE_API_URL=http://market_info_backend:3001  # ⚠️ ZMIEŃ PORT!
   ```

2. **App.tsx** (frontend/src)
   ```typescript
   // Zmień tylko jeśli masz custom baseURL
   const API_BASE = import.meta.env.DEV 
     ? 'http://localhost:3001'  // ⚠️ ZMIEŃ PORT tutaj
     : '';
   ```

3. **backend/Dockerfile**
   ```dockerfile
   # EXPOSE port powinien się zgadzać z container port w compose
   EXPOSE 3000  # Nie zmieniaj! (to wewnątrz kontenera)
   ```

### Zależności między portami:

```
┌─────────────────────────────────┐
│  HOST (NAS)                     │
│                                 │
│  Port 81 ──────> Frontend       │
│           (Nginx, :80)          │
│           (serves React)        │
│                                 │
│  Port 3001 ─> Backend           │
│              (Express, :3000)   │
│              (Gemini API)       │
│                                 │
│  Docker Network (internal):     │
│  Frontend → localhost:3000 ❌   │
│  Frontend → backend:3001 ✅     │
└─────────────────────────────────┘
```

**⚠️ WAŻNE**: 
- Frontend (React/Vite) **musi znać** port backendu
- W `docker-compose.yml` ustawiasz HOST porty (81, 3001)
- W kodzie App.tsx komunikujesz się poprzez **DNS wewnątrz Dockera** (`backend:3001`)
- W `VITE_API_URL` MUSI być port backendu (3001 w `dev` mode, albo `` dla prod)

## Konfiguracja wstępna

### 1. Klonowanie repozytorium

Na NAS-ie (via SSH):

```bash
cd /docker/compose
git clone https://github.com/gacek78/market_info.git market_info
cd market_info
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
cd /docker/compose/market_info
docker compose up -d --build
```

### Weryfikacja

```bash
# Sprawdź status kontenerów
docker compose ps

# Sprawdź logi backendu
docker compose logs market_info_backend

# Sprawdź logi frontendu
docker compose logs market_info_frontend

# Test health check
curl http://localhost:3001/health
```

### Dostęp do aplikacji

- **Frontend**: http://nas.local:81 (lub http://IP_NASIA:81)
- **Backend API**: http://nas.local:3001 (lub http://IP_NASIA:3001)

## Zarządzanie kontenerami

### Zatrzymanie

```bash
cd /docker/compose/market_info
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

## Zmiana portów post-deployment

Jeśli chcesz zmienić porty już po wdrożeniu:

1. **Edytuj `docker-compose.yml`** - zmień sekcję `ports`
2. **Jeśli frontend:** zmień też `VITE_API_URL` w `environment`
3. **Jeśli backend:** upewnij się że `EXPOSE` w Dockerfile się zgadza
4. **Rebuilduj**: `docker compose up -d --build`

## Troubleshooting

### Backend zwraca 401 Unauthorized

- Sprawdź czy `.env` ma poprawny `GEMINI_API_KEY`
- Sprawdź logi: `docker compose logs market_info_backend`

### Frontend nie łączy się z backend

- Sprawdź czy `VITE_API_URL` w `docker-compose.yml` ma prawidłowy port
- Sprawdź czy backend jest uruchomiony: `docker compose ps`
- Sprawdź network: `docker network ls`
- Test połączenia: `curl http://localhost:3001/health`

### Port zajęty

Jeśli port 3001 lub 81 jest zajęty:

```bash
# Znajdź co korzysta z portu
sudo lsof -i :3001
sudo lsof -i :81

# Zmień porty w docker-compose.yml
# Np. zamiast 3001:3000 wpisz 3002:3000
```

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
2. Project Name: `market_info`
3. Path: `/docker/compose/market_info`
4. Click Save
5. Select project → Click "Up"

Abo z CLI w OMV:

```bash
sudo docker compose -f /docker/compose/market_info/docker-compose.yml up -d
```
