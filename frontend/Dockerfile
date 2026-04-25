FROM node:20-alpine

WORKDIR /app

# Kopiujemy pliki zależności
COPY package.json ./

# Instalujemy zależności
RUN npm install

# Kopiujemy resztę plików (z kontekstu frontend/)
COPY . .

EXPOSE 3000

# Uruchamiamy Vite w trybie hosta 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
