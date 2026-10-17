// Awaryjne dociągnięcie pełnego tekstu artykułu — zastępuje Workers /api/proxy.
// Pobiera stronę bezpośrednio (UA przeglądarkowy), zdejmuje skrypty/style/nawigację
// i zwraca zgrubny tekst do streszczenia. Używane TYLKO gdy desc z feeda jest zbyt ubogi.
// NIE używać do stron za paywallem (np. NYT) — zwrócą ściankę logowania, nie treść.
// Użycie: node agent/fetch-article.mjs <URL_ARTYKUŁU>
const url = process.argv[2]
if (!url) {
  console.error('Użycie: node agent/fetch-article.mjs <URL_ARTYKUŁU>')
  process.exit(1)
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function htmlToText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(head|nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim()
}

try {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 18000)
  let res
  try {
    res = await fetch(url, {
      signal: ac.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) { console.error(`HTTP ${res.status}`); process.exit(0) }
  const html = await res.text()
  // przytnij — do streszczenia wystarczy początek tekstu, oszczędza tokeny
  process.stdout.write(htmlToText(html).slice(0, 6000))
} catch (e) {
  console.error(e?.message || 'Article fetch failed')
  process.exit(0)
}
