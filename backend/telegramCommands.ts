/**
 * telegramCommands.ts — komendy wpisywane do bota market_info na Telegramie.
 *
 * Long polling `getUpdates` (bez webhooka, bez otwierania portu). Reaguje tylko na
 * wiadomości z TELEGRAM_CHAT_ID. Bot market_info jest inny niż bot news-brief
 * (sprawdzone 17.10.2026 po skrótach tokenów), więc nie walczą o te same aktualizacje.
 *
 * Komendy:
 *   /obligacje — raport obligacji po inflacji (bonds.ts)
 */
import { sendBondsReport } from './bonds';
import { sendTelegramMessage } from './notifier';

const POLL_TIMEOUT_S = 50;

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

async function obsluz(text: string): Promise<void> {
  const komenda = text.trim().split(/\s+/)[0].replace(/@.*$/, '').toLowerCase();
  if (komenda === '/obligacje') {
    console.log('[Telegram] Komenda /obligacje');
    await sendBondsReport();
  } else if (komenda === '/start' || komenda === '/pomoc') {
    await sendTelegramMessage('Dostępne komendy:\n/obligacje — obligacje po inflacji (wykup na rękę i wartość realna)');
  }
}

export function startTelegramCommands(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  (async () => {
    let offset = 0;
    // Komendy wysłane, gdy backend nie działał, pomijamy — po restarcie nie chcemy serii raportów.
    try {
      const zalegle = await getUpdates(token, -1, 0);
      if (zalegle.length) offset = zalegle[zalegle.length - 1].update_id + 1;
    } catch (err) {
      console.error('[Telegram] Nie udało się pominąć zaległych komend:', (err as Error).message);
    }
    console.log('[Telegram] Nasłuch komend aktywny (/obligacje).');
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
