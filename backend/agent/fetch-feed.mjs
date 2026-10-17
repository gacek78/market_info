// Autonomiczny pobór feeda — zastępuje wywołanie Workers /api/feed czytnika.
// Pobiera i parsuje feed bezpośrednio (node fetch nie ma CORS), zwraca ten sam
// kształt JSON co backend czytnika: { title, feedUrl, items:[{title,link,desc,image,pubDate,feedUrl}], cachedAt }.
// Użycie: node agent/fetch-feed.mjs <FEED_URL>
import { parseFeed } from './rss-parser.mjs'

const url = process.argv[2]
if (!url) {
  console.error('Użycie: node agent/fetch-feed.mjs <FEED_URL>')
  process.exit(1)
}

try {
  const data = await parseFeed(url)
  process.stdout.write(JSON.stringify(data))
} catch (e) {
  // Zwróć błąd w tym samym kształcie co backend (pole error), nie wywracaj briefu
  process.stdout.write(JSON.stringify({ error: e?.message || 'Fetch failed', feedUrl: url }))
  process.exit(0)
}
