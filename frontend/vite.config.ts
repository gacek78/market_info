import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // ŚWIADOMIE BEZ `define` z kluczem Gemini. Wcześniej było tu wstrzykiwanie
      // GEMINI_API_KEY do paczki wysyłanej do przeglądarki. Żaden plik frontendu
      // z tego nie korzystał, ale sama możliwość jest groźna: kod działający
      // w przeglądarce woła Gemini bezpośrednio, z pominięciem backendu — a więc
      // i z pominięciem licznika kosztów, który jest jedyną ochroną działającą
      // natychmiast. Frontend rozmawia z Gemini WYŁĄCZNIE przez backend.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
