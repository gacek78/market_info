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

import { fetchMarketIntelligenceDeep, generatePortfolioSummary } from './geminiService';
import {
  getEtfsOnServer,
  getInfluencersOnServer,
  getStrategy,
  saveLastSummary,
  saveLastScan,
  wasAlertSent,
  markAlertsSent,
  recordSignals,
} from './stateManager';
import { ETF, EconomicEvent, GlobalMacroData, MarketSignal, PortfolioSummary } from './types';

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

const STANCE_EMOJI: Record<string, string> = {
  ACCUMULATE: '🟢 Dokupuj',
  HOLD: '⚪ Trzymaj',
  WATCH: '👀 Obserwuj',
  REDUCE: '🔻 Redukuj',
};
const OVERALL_EMOJI: Record<string, string> = { BULLISH: '📈', NEUTRAL: '➖', BEARISH: '📉' };

/** Składa sekcję "Podsumowanie dla Ciebie" do wiadomości Telegram (HTML). */
export function formatPortfolioSummary(s: PortfolioSummary): string {
  const head = `🧭 <b>Podsumowanie dla Ciebie</b> ${OVERALL_EMOJI[s.overall] ?? ''}`;
  const headline = s.headline ? `\n<b>${escapeHtml(s.headline)}</b>` : '';
  const narrative = s.narrative ? `\n${escapeHtml(s.narrative)}` : '';
  const perAsset = s.perAsset?.length
    ? '\n\n' +
      s.perAsset
        .map(
          (a) =>
            `• <b>${escapeHtml(a.ticker)}</b> — ${STANCE_EMOJI[a.stance] ?? escapeHtml(a.stance)}: ${escapeHtml(a.note || '')}`,
        )
        .join('\n')
    : '';
  const actions = s.actions?.length
    ? '\n\n<i>Sugestie:</i>\n' + s.actions.map((a) => `– ${escapeHtml(a)}`).join('\n')
    : '';
  const upcoming = s.upcoming?.length
    ? '\n\n📅 <b>Nadchodzące wydarzenia:</b>\n' +
      s.upcoming
        .map((u) => `• <b>${escapeHtml(u.date)}</b> ${escapeHtml(u.event)}\n<i>${escapeHtml(u.expectation)}</i>`)
        .join('\n')
    : '';
  return `${head}${headline}${narrative}${perAsset}${upcoming}${actions}`;
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
/** Dzieli pojedynczy długi tekst na fragmenty < limitu Telegrama (po liniach). */
export function chunkText(text: string, limit = 3800): string[] {
  if (text.length <= limit) return text ? [text] : [];
  const out: string[] = [];
  let buffer = '';
  for (const line of text.split('\n')) {
    if (buffer && (buffer + '\n' + line).length > limit) {
      out.push(buffer);
      buffer = line;
    } else {
      buffer = buffer ? `${buffer}\n${line}` : line;
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

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

export interface FullScan {
  /** WSZYSTKIE sygnały ze wszystkich celów (bez filtrowania severity). */
  signals: MarketSignal[];
  /** Dane makro z celu GLOBAL (FX/VIX/CPI/stopy). */
  globalData?: GlobalMacroData;
  /** Nadchodzące wydarzenia makro (zdeduplikowane ze wszystkich celów). */
  calendar: EconomicEvent[];
  scanned: number;
}

/**
 * Głęboki skan makro + wszystkich ETF-ów. Zwraca KOMPLET sygnałów (bez filtra) i
 * dane makro — jeden skan obsługuje zarówno digest alertów, jak i podsumowanie.
 */
export async function scanAllTargets(): Promise<FullScan> {
  const [etfs, influencers] = await Promise.all([getEtfsOnServer(), getInfluencersOnServer()]);
  const targets: (ETF | 'GLOBAL')[] = ['GLOBAL', ...etfs];

  const signals: MarketSignal[] = [];
  const calendarMap = new Map<string, EconomicEvent>();
  let globalData: GlobalMacroData | undefined;
  let scanned = 0;

  for (const target of targets) {
    scanned++;
    try {
      const result = await fetchMarketIntelligenceDeep(target, influencers);
      signals.push(...result.signals);
      if (target === 'GLOBAL' && result.globalData) globalData = result.globalData;
      // Dedup kalendarza po dacie + nazwie (te same wydarzenia wracają z wielu celów).
      for (const ev of result.calendar ?? []) {
        calendarMap.set(`${ev.date}|${ev.event.trim().toLowerCase()}`, ev);
      }
    } catch (err) {
      console.error(`[Notifier] Skan ${typeof target === 'string' ? target : target.ticker} nie powiódł się:`, err);
    }
  }

  const calendar = [...calendarMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Utrwal wynik — POST /api/summary reużyje świeżego skanu zamiast skanować od zera.
  if (signals.length) {
    await saveLastScan({ signals, globalData, calendar, timestamp: new Date().toISOString() });
  }

  return { signals, globalData, calendar, scanned };
}

/** Czy generować podsumowanie portfelowe w cyklu (env PORTFOLIO_SUMMARY, domyślnie on). */
function isPortfolioSummaryEnabled(): boolean {
  const v = (process.env.PORTFOLIO_SUMMARY ?? '').toLowerCase();
  return v !== 'false' && v !== '0';
}

/**
 * Skanuje makro + wszystkie ETF-y, wybiera sygnały >= ALERT_SEVERITY,
 * odfiltrowuje już wysłane i publikuje resztę na Telegram. Dodatkowo (gdy włączone)
 * generuje i wysyła spersonalizowane "Podsumowanie dla Ciebie" na bazie WSZYSTKICH sygnałów.
 */
export async function runAlertScan(): Promise<ScanResult & { summary?: PortfolioSummary }> {
  const minRank = SEVERITY_RANK[(process.env.ALERT_SEVERITY || 'high').toLowerCase()] ?? 2;
  const { signals: allSignals, globalData, calendar, scanned } = await scanAllTargets();

  // Filtr alertów: severity >= próg, potwierdzone, jeszcze nie wysłane.
  const fresh: MarketSignal[] = [];
  for (const sig of allSignals) {
    const rank = SEVERITY_RANK[sig.severity] ?? 0;
    if (rank < minRank) continue;
    if (sig.verified === false) {
      console.log(`[Notifier] Pomijam niepotwierdzony sygnał: ${sig.title}`);
      continue;
    }
    if (await wasAlertSent(alertKey(sig))) continue;
    fresh.push(sig);
  }

  // Podsumowanie portfelowe (na bazie wszystkich sygnałów, niezależnie od dedup/filtra).
  let summary: PortfolioSummary | undefined;
  if (isPortfolioSummaryEnabled()) {
    try {
      const strategy = await getStrategy();
      summary = await generatePortfolioSummary(strategy, allSignals, globalData, calendar);
      await saveLastSummary(summary);
    } catch (err) {
      console.error('[Notifier] Generowanie podsumowania nie powiodło się:', err);
    }
  }

  // Składamy wiadomości: najpierw podsumowanie, potem digest sygnałów.
  const messages: string[] = [];
  if (summary) messages.push(...chunkText(formatPortfolioSummary(summary)));
  messages.push(...buildDigestMessages(fresh));

  if (messages.length === 0) {
    console.log('[Notifier] Skan zakończony — brak treści do wysłania.');
    return { scanned, matched: 0, sent: 0, summary };
  }

  let sentOk = false;
  for (const message of messages) {
    sentOk = (await sendTelegramMessage(message)) || sentOk;
  }

  if (sentOk && fresh.length) {
    await markAlertsSent(fresh.map(alertKey));
    await recordSignals(fresh);
  }

  console.log(`[Notifier] Skan: ${scanned} celów, ${fresh.length} nowych sygnałów, podsumowanie=${!!summary}, wysłano=${sentOk}.`);
  return { scanned, matched: fresh.length, sent: sentOk ? fresh.length : 0, summary };
}
