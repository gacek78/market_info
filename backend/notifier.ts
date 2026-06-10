/**
 * notifier.ts — cykliczne skanowanie rynku i powiadomienia na Telegram.
 *
 * Backend sam, według harmonogramu (cron), uruchamia głęboką analizę dla makro
 * oraz każdego śledzonego ETF-a, wybiera istotne sygnały i wysyła je na Telegram.
 * Dzięki temu aplikacja "zaczepia" użytkownika, zamiast czekać aż sam ją otworzy.
 *
 * Konfiguracja przez zmienne środowiskowe:
 *   TELEGRAM_BOT_TOKEN  — token bota z @BotFather
 *   TELEGRAM_CHAT_ID    — ID czatu/odbiorcy
 *   ALERT_SEVERITY      — minimalny poziom alertu: low|medium|high (domyślnie high)
 *   ALERT_CRON          — harmonogram cron (domyślnie '0 8 * * *' = 8:00 codziennie)
 */

import { fetchMarketIntelligenceDeep } from './geminiService';
import {
  getEtfsOnServer,
  getInfluencersOnServer,
  wasAlertSent,
  markAlertsSent,
  recordSignals,
} from './stateManager';
import { ETF, MarketSignal } from './types';

const SEVERITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Wysyła pojedynczą wiadomość na Telegram (HTML). Nie rzuca — loguje błąd. */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[Notifier] Telegram nie skonfigurowany — pomijam wysyłkę.');
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error('[Notifier] Telegram API error:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Notifier] Wysyłka na Telegram nie powiodła się:', err);
    return false;
  }
}

const SEVERITY_EMOJI: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴' };

function formatSignal(s: MarketSignal): string {
  const head = `${SEVERITY_EMOJI[s.severity] ?? '•'} <b>${escapeHtml(s.title)}</b>`;
  const tag = s.ticker && s.ticker !== 'GLOBAL' ? ` <i>(${escapeHtml(s.ticker)})</i>` : '';
  const body = escapeHtml(s.summary || '');
  const impact = s.longTermImpact ? `\n<i>IKE: ${escapeHtml(s.longTermImpact)}</i>` : '';
  // Klikalny tytuł źródła zamiast surowego (i często brzydkiego) URL-a.
  const s0 = s.sources?.[0];
  const src = s0?.uri && s0.uri !== '#'
    ? `\n🔗 <a href="${escapeHtml(s0.uri)}">${escapeHtml(s0.title || 'Źródło')}</a>`
    : '';
  return `${head}${tag}\n${body}${impact}${src}`;
}

/** Stabilny klucz dedup — ten sam news nie zostanie wysłany dwa razy. */
function alertKey(s: MarketSignal): string {
  return `${s.ticker}|${(s.title || '').trim().toLowerCase().slice(0, 80)}`;
}

/**
 * Składa digest sygnałów w gotowe wiadomości Telegram (HTML).
 * Dzieli na kilka wiadomości, gdyby przekroczyły limit ~4096 znaków Telegrama.
 * Wydzielone, żeby dało się podejrzeć/przetestować bez wysyłki.
 */
export function buildDigestMessages(signals: MarketSignal[], now: Date = new Date()): string[] {
  if (signals.length === 0) return [];
  const header = `📡 <b>Sentinel IKE — sygnały (${signals.length})</b>\n${now.toLocaleString('pl-PL')}`;
  const blocks = [header, ...signals.map(formatSignal)];

  const messages: string[] = [];
  let buffer = '';
  for (const block of blocks) {
    if (buffer && (buffer + '\n\n' + block).length > 3800) {
      messages.push(buffer);
      buffer = block;
    } else {
      buffer = buffer ? `${buffer}\n\n${block}` : block;
    }
  }
  if (buffer) messages.push(buffer);
  return messages;
}

export interface ScanResult {
  scanned: number;
  matched: number;
  sent: number;
}

/**
 * Skanuje makro + wszystkie ETF-y, wybiera sygnały >= ALERT_SEVERITY,
 * odfiltrowuje już wysłane i publikuje resztę na Telegram.
 */
export async function runAlertScan(): Promise<ScanResult> {
  const minRank = SEVERITY_RANK[(process.env.ALERT_SEVERITY || 'high').toLowerCase()] ?? 2;
  const [etfs, influencers] = await Promise.all([getEtfsOnServer(), getInfluencersOnServer()]);
  const targets: (ETF | 'GLOBAL')[] = ['GLOBAL', ...etfs];

  const fresh: MarketSignal[] = [];
  let scanned = 0;

  for (const target of targets) {
    scanned++;
    try {
      const result = await fetchMarketIntelligenceDeep(target, influencers);
      for (const sig of result.signals) {
        const rank = SEVERITY_RANK[sig.severity] ?? 0;
        if (rank < minRank) continue;
        if (await wasAlertSent(alertKey(sig))) continue;
        fresh.push(sig);
      }
    } catch (err) {
      console.error(`[Notifier] Skan ${typeof target === 'string' ? target : target.ticker} nie powiódł się:`, err);
    }
  }

  if (fresh.length === 0) {
    console.log('[Notifier] Skan zakończony — brak nowych istotnych sygnałów.');
    return { scanned, matched: 0, sent: 0 };
  }

  // Składamy czytelny digest (z podziałem, gdyby przekroczył limit Telegrama).
  let sentOk = false;
  for (const message of buildDigestMessages(fresh)) {
    sentOk = (await sendTelegramMessage(message)) || sentOk;
  }

  if (sentOk) {
    await markAlertsSent(fresh.map(alertKey));
    await recordSignals(fresh);
  }

  console.log(`[Notifier] Skan: ${scanned} celów, ${fresh.length} nowych sygnałów, wysłano=${sentOk}.`);
  return { scanned, matched: fresh.length, sent: sentOk ? fresh.length : 0 };
}
