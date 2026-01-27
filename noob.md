# Terminal Commands - Przewodnik dla Noobów 🚀

## Podstawowe Polecenia

### Nawigacja w systemie plików

```bash
# Pokaż aktualny katalog
pwd

# Zmień katalog
cd /path/to/directory

# Wróć do poprzedniego katalogu
cd -

# Wróć do home'u
cd ~

# Wyświetl listę plików
ls
ls -la  # Pokaż wszystkie pliki (włącznie z ukrytymi) ze szczegółami

# Utwórz nowy katalog
mkdir folder_name

# Zmień nazwę pliku/folderu
mv old_name new_name

# Skopiuj plik
cp source.txt destination.txt

# Skopiuj cały folder
cp -r source_folder/ destination_folder/

# Usuń plik
rm file.txt

# Usuń katalog (bez zawartości)
rmdir empty_folder

# Usuń katalog z całą zawartością (OSTROŻNIE!)
rm -rf folder_name
```

## Docker - Komendy do Market Info

### Sprawdzenie statusu

```bash
# Pokaż wszystkie kontenery (tylko uruchomione)
docker ps

# Pokaż wszystkie kontenery (włącznie z zatrzymanymi)
docker ps -a

# Pokaż obrazy Docker
docker images
```

### Uruchamianie aplikacji

```bash
# Przejdź do katalogu market_info
cd /path/to/market_info

# Ustawienie klucza API (wykonaj raz, przed docker-compose)
export GEMINI_API_KEY="twoj-klucz-api-tutaj"

# Budowanie kontenerów
docker-compose build

# Uruchomienie aplikacji w tle
docker-compose up -d

# Uruchomienie aplikacji z wyświetlaniem logów
docker-compose up

# Zatrzymanie aplikacji
docker-compose down
```

### Logi i diagnostyka

```bash
# Wyświetl logi wszystkich kontenerów
docker-compose logs

# Wyświetl logi backend'u
docker-compose logs backend

# Wyświetl logi frontend'u
docker-compose logs frontend

# Wyświetl logi w czasie rzeczywistym (follow mode)
docker-compose logs -f

# Wyświetl ostatnie 50 linii logów
docker-compose logs --tail=50
```

## Usuwanie Nieprawidłowych Kontenerów

### Problem: Kontener "застрял" lub nie działa

```bash
# Krok 1: Zatrzymaj kompletnie aplikację
docker-compose down

# Krok 2: Pokaż wszystkie kontenery (włącznie z zatrzymanymi)
docker ps -a

# Krok 3: Jeśli widzisz kontenery, które chcesz usunąć, usuń je
# Usuń konkretny kontener po ID lub nazwie
docker rm container_id_or_name

# Przykład:
docker rm market_info_frontend_1
docker rm market_info_backend_1

# Krok 4: Wyczyść nieużywane obrazy
docker system prune

# Krok 5: Wyczyść wszystkie nieużywane zasoby (volumeny, sieci, kontenery)
docker system prune -a

# Krok 6: Wyczyść cache podczas budowania
docker-compose build --no-cache
```

### Kompleksowa czystka (gdy wszystko się zepsuło)

```bash
# OSTROŻNIE: To usunie WSZYSTKIE kontenery, obrazy, volumeny!

# Krok 1: Zatrzymaj aplikację
docker-compose down -v

# Krok 2: Usuń wszystkie kontenery
docker system prune -a --volumes

# Krok 3: Przebuduj od zera
docker-compose build --no-cache
docker-compose up -d
```

## Szybkie Rozwiązania Problemów

### Port już zajęty

```bash
# Pokaż, który process używa portu 3001
lsof -i :3001

# Pokaż, który process używa portu 81
lsof -i :81

# Zabij process na danym porcie (Linux/Mac)
kill -9 PID

# Na Windows: Find-NetTCPConnection, Stop-Process
```

### Frontend nie widzi backendu

```bash
# Sprawdź czy backend jest uruchomiony
docker ps

# Sprawdź logi backendu
docker-compose logs backend

# Sprawdź czy port 3001 jest dostępny
curl http://localhost:3001/health
```

### Błędy budowania

```bash
# Wyczyść cache Docker i rebuild
docker-compose down
docker system prune -a
docker-compose build --no-cache
docker-compose up -d

# Sprawdź logi budowania
docker-compose build
```

## Git - Podstawowe Polecenia

```bash
# Sklonuj repozytorium
git clone https://github.com/gacek78/market_info.git
cd market_info

# Sprawdź status
git status

# Pobierz najnowszy kod
git pull origin main

# Pokaż ostatnie commity
git log --oneline -10
```

## Zmienne Środowiskowe

```bash
# Ustaw zmienną do aktualnej sesji
export GEMINI_API_KEY="twoj-klucz"

# Pokaż wartość zmiennej
echo $GEMINI_API_KEY

# Utwórz plik .env
cat > .env << EOF
GEMINI_API_KEY=twoj-klucz-tutaj
EOF

# Załaduj zmienne z .env
set -a && source .env && set +a

# Wyczyść zmienną
unset GEMINI_API_KEY
```

## Przydatne Polecenia

```bash
# Pokaż wolne miejsce na dysku
df -h

# Pokaż zużycie RAM
free -h

# Pokaż procesy Docker
docker stats

# Pokaż wersję Docker
docker --version
docker-compose --version

# Pomoc dla polecenia
command --help
# lub
man command
```

## Checklist - Wdrożenie na NAS

- [ ] Klonujesz repozytorium: `git clone https://github.com/gacek78/market_info.git`
- [ ] Przechodzisz do folderu: `cd market_info`
- [ ] Ustawiasz klucz API: `export GEMINI_API_KEY="twoj-klucz"`
- [ ] Sprawdzasz docker-compose.yml (czy porty są dobre)
- [ ] Budujesz obrazy: `docker-compose build`
- [ ] Uruchamiasz aplikację: `docker-compose up -d`
- [ ] Sprawdzasz status: `docker-compose ps` (oba kontenery powinny być "Up")
- [ ] Sprawdzasz logi: `docker-compose logs`
- [ ] Wejdziesz na http://localhost:81 (frontend powinien się załadować)
- [ ] Testujesz API: `curl http://localhost:3001/health`

## Przy Problemach

1. **Sprawdź logi**: `docker-compose logs`
2. **Sprawdź status**: `docker ps`
3. **Wyczyść i rebuild**: `docker-compose down && docker-compose build --no-cache && docker-compose up -d`
4. **Jeśli wciąż nie działa**: Usuń wszystko: `docker system prune -a -v` i zacznij od nowa

## Jak Się Uczyć

- Czytaj błędy w logach - zawierają dużo informacji
- Korzystaj z `--help` dla każdego polecenia
- Google jest Twoim przyjacielem
- Próbuj, eksperymentuj, uczyj się na błędach!

---

**Powodzenia! 🎉**
