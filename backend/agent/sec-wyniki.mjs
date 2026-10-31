// Ostatnie wyniki kwartalne spółki z USA prosto z rejestru SEC (EDGAR), bez klucza.
// Spółka ogłasza wyniki raportem 8-K z punktem 2.02; sam komunikat prasowy to załącznik 99.1.
// Wypisuje nazwę, datę raportu i początek komunikatu (przychody, zysk, prognozy).
// Użycie: node agent/sec-wyniki.mjs <TICKER>   np. MSFT, GOOGL, AMZN, AAPL, NVDA, META
const ticker = (process.argv[2] || '').toUpperCase()
if (!ticker) {
  console.error('Użycie: node agent/sec-wyniki.mjs <TICKER>')
  process.exit(1)
}

// SEC wymaga User-Agent z kontaktem — inaczej zwraca 403.
const UA = 'market_info gacek78@gmail.com'

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} dla ${url}`)
  return res
}

function htmlToText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim()
}

try {
  const tickers = await (await get('https://www.sec.gov/files/company_tickers.json')).json()
  const firma = Object.values(tickers).find((t) => t.ticker === ticker)
  if (!firma) throw new Error(`SEC nie zna tickera ${ticker}`)
  const cik = String(firma.cik_str)

  const sub = await (await get(`https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`)).json()
  const r = sub.filings.recent
  const i = r.form.findIndex((f, k) => f === '8-K' && /2\.02/.test(r.items[k]))
  if (i < 0) throw new Error(`Brak raportu z wynikami (8-K 2.02) wśród ostatnich raportów ${sub.name}`)

  const katalog = `https://www.sec.gov/Archives/edgar/data/${cik}/${r.accessionNumber[i].replace(/-/g, '')}`
  // Nazwy plików są różne w każdej spółce (googexhibit991…, q2fy27pr.htm) — typ dokumentu
  // „EX-99.1” stoi w tabeli indeksu raportu, w tym samym wierszu co link.
  const indeks = await (await get(`${katalog}/${r.accessionNumber[i]}-index.htm`)).text()
  const wiersz = (indeks.match(/<tr[\s\S]*?<\/tr>/gi) || []).find((w) => />\s*EX-99\.1\s*</i.test(w))
  const zalacznik = wiersz?.match(/href="([^"]+\.htm)"/i)?.[1]
  if (!zalacznik) throw new Error(`Raport ${r.accessionNumber[i]} nie ma załącznika EX-99.1 z komunikatem`)
  const adres = new URL(zalacznik, 'https://www.sec.gov').href

  const tekst = htmlToText(await (await get(adres)).text())
  console.log(`${sub.name} — raport z wynikami z ${r.filingDate[i]}`)
  console.log(`Źródło: ${adres}`)
  // początek komunikatu wystarcza: liczby kwartału i wypowiedzi zarządu są na górze
  console.log(tekst.slice(0, 5000))
} catch (e) {
  console.error(e?.message || 'Pobranie z SEC nie powiodło się')
  process.exit(0)
}
