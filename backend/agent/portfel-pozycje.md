# Moje pozycje IKE (XTB)

> Aktualizuj ten plik, gdy zmienią się pozycje. Stan z: **2026-09-20**.
> Wartości są orientacyjne — służą do liczenia wag portfela, nie do rozliczeń.

| Instrument | Ticker (XTB) | Ticker w market_info | Typ | Wolumen | Wartość PLN | Cena 1 szt. (PLN) | Udział |
|---|---|---|---|---|---|---|---|
| Vanguard FTSE All-World | VWCE.DE | VWCE.DE | ETF | 3,5187 | 2549,46 | ~724 | 37,2% |
| Xtrackers Nasdaq 100 | XNAS.DE | XNAS.DE | ETF | 6,0194 | 1562,19 | ~260 | 22,8% |
| XTB S.A. | XTB.PL | XTB.PL | Akcje | 7 | 1047,06 | **~150** | 15,3% |
| Beta ETF sWIG80TR | ETFBS80TR.PL | SWIG80TR | ETF | 1,4354 | 703,41 | ~490 | 10,3% |
| Dino Polska | DNP.PL | DNP.PL | Akcje | 13,2078 | 472,05 | ~36 | 6,9% |
| Celon Pharma | CLN.PL | CLN.PL | Akcje | 18,7634 | 369,64 | ~20 | 5,4% |
| iShares Physical Gold | IGLN.UK | IGLN.UK | ETC | 0,4961 | 158,01 | ~319 | 2,3% |

> Cena 1 szt. policzona jako **wartość rynkowa ÷ wolumen**. UWAGA: w interfejsie XTB
> kolumna „@" pokazuje **cenę nabycia**, a nie bieżącą — nie bierz jej za cenę zakupu.
> Przykład: XTB.PL „7 @ 105,58" przy wartości 1047,06 zł oznacza cenę bieżącą 149,58 zł,
> bo 105,58 to średnia cena, po jakiej te akcje kupiono.

**Razem: 6861,82 PLN**

## Zasady zakupu — WAŻNE przy dzieleniu wpłaty

- **XTB.PL można kupować TYLKO w całych akcjach.** Cena ok. **150 zł** za sztukę.
  Kwota przydzielona tej pozycji musi być wielokrotnością ceny akcji — inaczej
  reszta zostanie niewykorzystana. Jeśli nie starcza na całą akcję, przydziel 0 zł
  i skieruj środki gdzie indziej.
  **Zanim przydzielisz tej pozycji środki, sprawdź bieżącą cenę** — ceny z tej tabeli
  są ze zrzutu z 2026-09-20 i starzeją się. W wiadomości napisz wprost, ile to całych
  akcji i po jakiej cenie, np. „150 zł = 1 akcja po ok. 150 zł".
- **Pozostałe pozycje można kupować w częściach** (ułamki jednostek) — dowolna kwota.
  Widać to po wolumenach: 3,5187 czy 18,7634 to ułamki.
- Uwaga na cenę jednostki **ETFBS80TR.PL (~488 zł)** — przy wpłacie 700 zł jedna
  jednostka zjada większość miesiąca. Dlatego kupuj ułamkami, nie całymi.

## Symbole do pobierania aktualnych cen (Yahoo Finance, bez klucza)

Wszystkie sprawdzone 2026-09-20 — działają z wnętrza tego kontenera.
Stooq jest z tego kontenera **zablokowany**, nie używaj go.

| Pozycja | Symbol Yahoo | Waluta |
|---|---|---|
| VWCE.DE | `VWCE.DE` | EUR |
| XNAS.DE | `XNAS.DE` | EUR |
| XTB.PL | `XTB.WA` | PLN |
| ETFBS80TR.PL | `ETFBS80TR.WA` | PLN |
| DNP.PL | `DNP.WA` | PLN |
| CLN.PL | `CLN.WA` | PLN |
| IGLN.UK | `IGLN.L` | USD |

Wzór wywołania:
`curl -s -A "Mozilla/5.0" "https://query1.finance.yahoo.com/v8/finance/chart/XTB.WA?interval=1d&range=5d"`
Cena jest w polu `regularMarketPrice`, waluta w `currency`.

Pozycje w EUR i USD przelicz na złote po bieżącym kursie, zanim porównasz wagi.

## Zgodność z market_info

Wszystkie siedem pozycji jest śledzonych przez market_info (złoto IGLN.UK dodane
2026-09-20). Jeśli w sygnałach brakuje któregoś tickera, znaczy to, że skan go nie
objął — napisz o tym wprost zamiast zgadywać.
