/**
 * portfelAgent.ts — /portfel i /analiza: agent Claude Code (`claude -p`) uruchamiany w kontenerze.
 *
 * Przeniesione 17.10.2026 z bota news-brief (poller.mjs), żeby wszystkie powiadomienia finansowe
 * szły z bota market_info. Agent sam robi research (Yahoo, Frankfurter, RSS, WebSearch), zapisuje
 * notatki w DATA_DIR/research/ i sam wysyła wiadomości na Telegram (KROK „JAK WYSŁAĆ” w promptach).
 * Nie woła Gemini — nie obciąża budżetu Gemini. Płaci subskrypcja Claude (CLAUDE_CODE_OAUTH_TOKEN).
 *
 * Prompty i skrypty pomocnicze: backend/agent/. Stan portfela: baza aplikacji portfel
 * zamontowana tylko do odczytu w /portfel-data (czyta ją agent/portfel-stan.py).
 */
import { spawn, execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { sendTelegramMessage } from './notifier';

const AGENT_DIR = path.join(__dirname, 'agent');
const TOOLS = 'Bash Edit Write Read Glob Grep WebSearch WebFetch';
// Bezpiecznik: zawieszony agent nie może blokować komend na zawsze. Typowy /portfel trwa
// kilkanaście minut (research kilku aktywów), więc godzina łapie tylko awarię.
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MIN || 60) * 60_000;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tg = (text: string) => sendTelegramMessage(esc(text));

let running = false;

// ─── Stan portfela z bazy aplikacji portfel ──────────────────────────────────

interface PortfelStan {
  ike?: {
    budzet_miesieczny_pln?: number;
    pozycje?: unknown[];
    zakupy_wg_miesiaca?: Record<string, { kwota_pln?: number; pozycje?: Record<string, number> }>;
  };
}

/** JSON z agent/portfel-stan.py albo null, gdy baza niedostępna — agent dostaje o tym informację. */
function portfelStan(): PortfelStan | null {
  try {
    return JSON.parse(execFileSync('python3', [path.join(AGENT_DIR, 'portfel-stan.py')], { encoding: 'utf8', timeout: 30_000 }));
  } catch (e) {
    console.error('[Portfel] Nie udało się odczytać bazy portfela:', (e as Error).message);
    return null;
  }
}

const MIESIACE = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec',
  'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthName = (d: Date) => `${MIESIACE[d.getMonth()]} ${d.getFullYear()}`;
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
function isLastDayOfMonth(d: Date): boolean {
  const t = new Date(d); t.setDate(t.getDate() + 1);
  return t.getDate() === 1;
}
// Ile wydano w IKE w danym miesiącu i ile wynosi budżet (z aplikacji portfel).
const budzet = (stan: PortfelStan | null) => stan?.ike?.budzet_miesieczny_pln || Number(process.env.DCA_BUDGET_PLN || 700);
const wydano = (stan: PortfelStan | null, d: Date) => stan?.ike?.zakupy_wg_miesiaca?.[monthKey(d)]?.kwota_pln || 0;
// Miesiąc jest kupiony, gdy z budżetu zostało mniej niż RESZTA_MIN (drobna reszta z zaokrągleń)
// albo gdy trwa jego ostatni dzień (czas polski — TZ w compose). Jeden zakup to za mało —
// 1.10.2026 kupiono 120 z 700 zł i bot uznał październik za zamknięty, planując od razu listopad.
const RESZTA_MIN = 20;
const kupiony = (stan: PortfelStan | null, d: Date) => budzet(stan) - wydano(stan, d) < RESZTA_MIN;
// Rozpoczęty, niedokończony i nie jest to jego ostatni dzień → dzielimy resztę.
const wTrakcie = (stan: PortfelStan | null, now: Date) => wydano(stan, now) > 0 && !kupiony(stan, now) && !isLastDayOfMonth(now);

// Za który miesiąc planujemy: bieżący, a w ostatnim dniu miesiąca już następny (wtedy trzeba
// wiedzieć, co kupić jutro). Bieżący miesiąc w trakcie — on (dzielimy resztę). Kupione przeskakujemy.
function targetMonth(stan: PortfelStan | null, now: Date): Date {
  if (wTrakcie(stan, now)) return addMonths(now, 0);
  let t = addMonths(now, isLastDayOfMonth(now) ? 1 : 0);
  while (kupiony(stan, t)) t = addMonths(t, 1);
  return t;
}

// ─── Uruchomienie agenta ─────────────────────────────────────────────────────

function spawnClaude(prompt: string, co: string): void {
  running = true;
  const start = Date.now();
  console.log(`[Agent] Start: ${co}`);
  // --allowedTools zamiast --dangerously-skip-permissions (ta druga jest blokowana dla roota).
  const p = spawn('claude', ['-p', prompt, '--allowedTools', TOOLS], {
    cwd: path.join(__dirname, 'data'),
    stdio: ['ignore', 'inherit', 'inherit'],
    env: process.env,
  });
  const timer = setTimeout(() => {
    console.error(`[Agent] ${co}: przekroczony limit ${AGENT_TIMEOUT_MS / 60_000} min — przerywam.`);
    p.kill('SIGTERM');
  }, AGENT_TIMEOUT_MS);
  p.on('exit', (code, signal) => {
    clearTimeout(timer);
    running = false;
    const min = ((Date.now() - start) / 60_000).toFixed(1);
    console.log(`[Agent] Koniec: ${co}, kod ${code}${signal ? `, sygnał ${signal}` : ''}, ${min} min`);
    if (code !== 0) tg(`⚠️ ${co} zakończyło się błędem (kod ${code ?? signal}). Logi: docker compose logs backend`);
  });
  p.on('error', (err) => {
    clearTimeout(timer);
    running = false;
    console.error(`[Agent] Nie udało się uruchomić Claude (${co}):`, err.message);
    tg(`⚠️ Nie udało się uruchomić Claude: ${err.message}`);
  });
}

/** Podsumowanie portfela IKE: gdzie wpłacić miesięczny budżet. */
export async function runPortfel(reason: string, { scheduled = false } = {}): Promise<void> {
  const now = new Date();
  const stan = portfelStan();
  const t = targetMonth(stan, now);
  const naturalny = addMonths(now, isLastDayOfMonth(now) ? 1 : 0);
  // Z harmonogramu nie planujemy z wyprzedzeniem: skoro ten miesiąc już kupiony, codzienna
  // wiadomość o przyszłym miesiącu byłaby szumem. Na /portfel — zawsze.
  if (scheduled && monthKey(t) !== monthKey(naturalny) && !wTrakcie(stan, now)) {
    console.log(`[Portfel] Pomijam harmonogram — ${monthKey(naturalny)} już kupiony.`);
    return;
  }
  if (running) { await tg('⏳ Coś już się liczy, chwila…'); return; }
  const juz = wydano(stan, t);
  const kwota = Math.round(budzet(stan) - juz);
  const kupioneT = stan?.ike?.zakupy_wg_miesiaca?.[monthKey(t)]?.pozycje || {};
  await tg(`⏳ Liczę podsumowanie portfela na ${monthName(t)}${juz ? ` — zostało ${kwota} zł` : ''} (${reason})…`);
  const ctx = '\n\n=== ZA KTÓRY MIESIĄC ===\n'
    + `Dziś: ${now.toLocaleDateString('pl-PL')}. Planujesz zakupy za: ${monthName(t)} (${monthKey(t)}).\n`
    + (juz
      ? `W ${monthName(t)} kupiono już za ${Math.round(juz)} zł: `
        + Object.entries(kupioneT).map(([k, v]) => `${k} ${Math.round(v)} zł`).join(', ') + '.\n'
        + 'Dzielisz tylko RESZTĘ budżetu. Uwzględnij to, co już kupiono w tym miesiącu — '
        + 'nie dubluj bez powodu tych samych pozycji, a w wiadomości napisz krótko, co już jest kupione.\n'
      : kupiony(stan, now)
        ? `Zakupy za ${monthName(now)} są już zrobione (widać je w bazie) — nie planuj ich ponownie.\n`
        : monthKey(t) !== monthKey(now)
          ? 'Dziś ostatni dzień miesiąca — plan dotyczy zakupów, które zrobisz od jutra.\n'
          : 'W tym miesiącu baza nie ma jeszcze żadnych zakupów.\n')
    + `**Kwota do rozdysponowania: ${kwota} zł** — tyle ma wynosić suma podziału i tę kwotę `
    + 'podaj w nagłówku sekcji wpłaty.\n'
    + '\n=== STAN PORTFELA Z APLIKACJI portfel ===\n'
    + (stan ? JSON.stringify(stan, null, 1)
      : 'NIEDOSTĘPNY — baza aplikacji portfel nie dała się odczytać. Napisz to w wiadomości '
        + 'na samej górze i weź pozycje z tabeli w /app/agent/portfel-pozycje.md (stan z 2026-09-20).');
  spawnClaude(readFileSync(path.join(AGENT_DIR, 'portfel-prompt.txt'), 'utf8') + ctx, 'Podsumowanie portfela');
}

/** /analiza — lista notatek z researchu; /analiza <ticker> — świeży research jednego aktywa. */
export async function runAnaliza(arg: string): Promise<void> {
  if (running) { await tg('⏳ Coś już się liczy, chwila…'); return; }
  const pozycje = portfelStan()?.ike?.pozycje || [];
  await tg(arg ? `⏳ Robię research: ${arg}…` : '⏳ Zbieram listę notatek…');
  const zadanie = arg
    ? `Użytkownik pyta o: "${arg}". Pozycje w portfelu (z bazy): ${JSON.stringify(pozycje)}.\n`
      + 'Dopasuj pytanie do tickera (np. „xtb" → XTB.WA, „dino" → DNP.WA, „złoto" → IGLN.L). '
      + 'Jeśli to aktywo spoza portfela — zrób research tak samo, notatkę zapisz pod jego tickerem Yahoo.\n'
    : 'Bez tickera: wyślij LISTĘ notatek — dla każdej ticker, datę pełnego researchu i ocenę '
      + '(jedna linia na aktywo). Nie rób nowego researchu. Jeśli notatek nie ma, napisz, '
      + 'że powstaną przy najbliższym /portfel.\n';
  spawnClaude(readFileSync(path.join(AGENT_DIR, 'analiza-prompt.txt'), 'utf8') + '\n\n=== ZADANIE ===\n' + zadanie, 'Analiza');
}

/** Agent ma sens tylko z tokenem Claude i Telegramem (agent sam wysyła wiadomości). */
export function isAgentConfigured(): boolean {
  return Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}
