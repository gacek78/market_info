FROM node:22-alpine

# Alpine nie ma bazy stref czasowych — bez tego TZ=Europe/Warsaw jest ignorowany
# (date i node-cron lecą wg UTC). Z tzdata cron alertów działa wg czasu PL.
# Reszta dla agenta Claude (/portfel, /analiza — portfelAgent.ts):
#   python3  — agent/portfel-stan.py czyta bazę aplikacji portfel (sqlite3 jest w pakiecie),
#   curl     — agent pobiera kursy z Yahoo i Frankfurtera, rss-parser.mjs pobiera feedy,
#   bash, grep — narzędzie Bash Claude Code i kontrola żargonu (busybox grep nie zna \b),
#   ripgrep, libgcc, libstdc++ — Claude Code na alpine (musl) nie używa wbudowanego rg.
RUN apk add --no-cache tzdata python3 curl bash grep ripgrep libgcc libstdc++
ENV USE_BUILTIN_RIPGREP=0

RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Instalujemy zależności systemowe dla genai jeśli potrzebne (ale node-alpine zazwyczaj wystarczy)
# COPY pliki zależności
COPY package.json package-lock.json* ./

RUN npm install

# Kopiujemy całą resztę kodu backendu
COPY . .

# Wystawiamy port 3000 (zgodnie z index.ts)
EXPOSE 3000

# W trybie Docker Compose uruchamiamy wersję deweloperską z ts-node
# aby zmiany w kodzie (mounted volumes) były odświeżane.
CMD ["npm", "run", "dev"]
