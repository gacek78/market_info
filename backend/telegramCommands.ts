/**
 * telegramCommands.ts — komendy wpisywane do bota market_info na Telegramie.
 *
 * Long polling `getUpdates` (bez webhooka, bez otwierania portu). Reaguje tylko na
 * wiadomości z TELEGRAM_CHAT_ID. Bot market_info jest inny niż bot news-brief
 * (sprawdzone 17.10.2026 po skrótach tokenów), więc nie walczą o te same aktualizacje.
 *
 * Komendy:
 *   /portfel        — gdzie wpłacić miesięczny budżet (agent Claude, portfelAgent.ts)
 *   /analiza [co]   — lista ocen albo świeży research jednego aktywa (agent Claude)
 *   /obligacje      — raport obligacji po inflacji (bonds.ts, bez AI)
 *   /help (/pomoc, /start) — lista komend z opisem; menu „/” ustawia setMyCommands przy starcie
 */
import { buildBondsReport, formatBondsReport } from './bonds';
import { sendTelegramMessage } from './notifier';
import { runPortfel, runAnaliza, isAgentConfigured } from './portfelAgent';

const POLL_TIMEOUT_S = 50;

const POMOC = [
  '<b>Komendy bota market_info</b>',
  '',
  '/portfel — gdzie wpłacić miesięczny budżet IKE. Agent czyta portfel z aplikacji, robi świeży '
    + 'research każdej pozycji i przysyła dwie wiadomości: ocenę aktywów i podział wpłaty. '
    + 'Trwa kilkanaście minut. Sam przychodzi codziennie o 16:30, dopóki miesiąc nie jest kupiony.',
  '',
  '/analiza — lista ocen wszystkich aktywów z ostatnich notatek (bez nowego researchu).',
  '/analiza xtb — świeży research jednej pozycji i pełna notatka. Działa też dla aktywa spoza portfela.',
  '',
  '/obligacje — obligacje skarbowe po inflacji: ile dostałbyś na rękę przy wykupie dziś '
    + 'i ile to warte w pieniądzu z dnia zakupu. Kilka sekund, bez AI. Sam przychodzi w niedzielę o 18:00.',
  '',
  '/help — ta lista.',
].join('\n');

// Menu po wpisaniu „/” w Telegramie (opisy do 256 znaków, bez HTML).
const MENU = [
  { command: 'portfel', description: 'Gdzie wpłacić miesięczny budżet IKE (kilkanaście minut)' },
  { command: 'analiza', description: 'Oceny aktywów; /analiza xtb — research jednej pozycji' },
  { command: 'obligacje', description: 'Obligacje po inflacji: wykup na rękę i wartość realna' },
  { command: 'help', description: 'Lista komend z opisem' },
];

async function ustawMenu(token: string): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: MENU }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error('[Telegram] Nie udało się ustawić menu komend:', res.status, await res.text());
  } catch (err) {
    console.error('[Telegram] Nie udało się ustawić menu komend:', (err as Error).message);
  }
}

interface Update {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
}

async function getUpdates(token: string, offset: number, timeout: number): Promise<Update[]> {
  const res = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=${timeout}&allowed_updates=%5B%22message%22%5D`,
    { signal: AbortSignal.timeout((timeout + 15) * 1000) },
  );
  if (!res.ok) throw new Error(`getUpdates HTTP ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { result?: Update[] };
  return body.result ?? [];
}

/** Raport obligacji na Telegram. Błąd (portfel albo GUS niedostępne) idzie na Telegram, nie w próżnię. */
export async function sendBondsReport(reason: string): Promise<void> {
  console.log(`[Obligacje] ${reason}`);
  try {
    const messages = formatBondsReport(await buildBondsReport());
    let ok = 0;
    for (const m of messages) if (await sendTelegramMessage(m)) ok++;
    if (ok < messages.length) {
      await sendTelegramMessage(`⚠️ Obligacje: Telegram przyjął ${ok} z ${messages.length} wiadomości. Logi: docker compose logs backend`);
    }
  } catch (err) {
    console.error('[Obligacje] Raport nieudany:', err);
    const msg = String((err as Error).message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await sendTelegramMessage(`⚠️ Raport obligacji się nie udał: ${msg}`);
  }
}

async function obsluz(text: string): Promise<void> {
  const [pierwsze, ...reszta] = text.trim().split(/\s+/);
  const komenda = pierwsze.replace(/@.*$/, '').toLowerCase();
  const arg = reszta.join(' ');
  if (komenda === '/obligacje') {
    await sendBondsReport('Komenda /obligacje');
  } else if (komenda === '/portfel' || komenda === '/analiza') {
    if (!isAgentConfigured()) {
      await sendTelegramMessage('⚠️ Agent Claude nie jest skonfigurowany (brak CLAUDE_CODE_OAUTH_TOKEN w .env).');
    } else if (komenda === '/portfel') {
      await runPortfel('na żądanie');
    } else {
      await runAnaliza(arg);
    }
  } else if (komenda === '/start' || komenda === '/pomoc' || komenda === '/help') {
    await sendTelegramMessage(POMOC);
  }
}

export function startTelegramCommands(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  (async () => {
    await ustawMenu(token);
    let offset = 0;
    // Komendy wysłane, gdy backend nie działał, pomijamy — po restarcie nie chcemy serii raportów.
    try {
      const zalegle = await getUpdates(token, -1, 0);
      if (zalegle.length) offset = zalegle[zalegle.length - 1].update_id + 1;
    } catch (err) {
      console.error('[Telegram] Nie udało się pominąć zaległych komend:', (err as Error).message);
    }
    console.log('[Telegram] Nasłuch komend aktywny (/portfel, /analiza, /obligacje).');
    let przerwa = 5;
    for (;;) {
      try {
        const updates = await getUpdates(token, offset, POLL_TIMEOUT_S);
        przerwa = 5;
        for (const u of updates) {
          offset = u.update_id + 1;
          const msg = u.message;
          if (!msg?.text || String(msg.chat.id) !== String(chatId)) continue;
          await obsluz(msg.text).catch((err) => console.error('[Telegram] Błąd komendy:', err));
        }
      } catch (err) {
        // 409 = ktoś inny czyta tego bota (webhook albo drugi proces) — głośno w logu, z coraz dłuższą przerwą.
        console.error(`[Telegram] Odbiór komend nieudany, ponowię za ${przerwa} s:`, (err as Error).message);
        await new Promise((r) => setTimeout(r, przerwa * 1000));
        przerwa = Math.min(przerwa * 2, 600);
      }
    }
  })();
}
