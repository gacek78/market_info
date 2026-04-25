FROM node:22-alpine

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
