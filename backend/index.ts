import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import {
  fetchMarketIntelligenceFast,
  fetchMarketIntelligenceDeep,
  validateAndFetchTickerDetails,
} from './geminiService';
import {
  getInfluencersOnServer,
  getRecentSignals,
  getStrategy,
  saveStrategy,
  getLastSummary,
  saveLastSummary,
} from './stateManager';
import { generatePortfolioSummary } from './geminiService';
import { runAlertScan, scanAllTargets, sendTelegramMessage, isTelegramConfigured } from './notifier';
import { fetchPlnCostSeries } from './marketData';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Helper ────────────────────────────────────────────────────────────────
function parseTarget(ticker: string, marketType: string) {
  if (ticker === 'GLOBAL') return 'GLOBAL' as const;
  return {
    ticker,
    name: ticker,
    category: marketType || 'Unknown',
    description: '',
  };
}

// ─── FAST endpoint (Faza 1) ───────────────────────────────────────────────
app.post('/api/market-intel/fast', async (req: Request, res: Response) => {
  try {
    const { ticker, marketType } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Missing ticker' });
    if (!process.env.API_KEY) return res.status(401).json({ error: 'API key not configured' });

    const target = parseTarget(ticker, marketType);
    const result = await fetchMarketIntelligenceFast(target);
    return res.json(result);
  } catch (error: any) {
    if (error.message === 'AUTH_REQUIRED') return res.status(401).json({ error: 'AUTH_REQUIRED' });
    console.error('Fast Intel Error:', error);
    return res.status(500).json({ error: 'Failed to analyze market (fast)' });
  }
});

// ─── DEEP endpoint (Faza 2) ───────────────────────────────────────────────
app.post('/api/market-intel/deep', async (req: Request, res: Response) => {
  try {
    const { ticker, marketType } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Missing ticker' });
    if (!process.env.API_KEY) return res.status(401).json({ error: 'API key not configured' });

    const target = parseTarget(ticker, marketType);
    const influencers = await getInfluencersOnServer();
    const result = await fetchMarketIntelligenceDeep(target, influencers);
    return res.json(result);
  } catch (error: any) {
    if (error.message === 'AUTH_REQUIRED') return res.status(401).json({ error: 'AUTH_REQUIRED' });
    console.error('Deep Intel Error:', error);
    return res.status(500).json({ error: 'Failed to analyze market (deep)' });
  }
});

// ─── Legacy endpoint (backward compat) ──────────────────────────────────
app.post('/api/market-intel', async (req: Request, res: Response) => {
  const { ticker, marketType } = req.body;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });
  if (!process.env.API_KEY) return res.status(401).json({ error: 'API key not configured' });
  try {
    const target = parseTarget(ticker, marketType);
    const influencers = await getInfluencersOnServer();
    const result = await fetchMarketIntelligenceDeep(target, influencers);
    return res.json(result);
  } catch (error: any) {
    console.error('Legacy Intel Error:', error);
    return res.status(500).json({ error: 'Failed to analyze market' });
  }
});

// ─── Validate ticker ───────────────────────────────────────────────────
app.post('/api/validate-ticker', async (req: Request, res: Response) => {
  try {
    const { ticker } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Missing ticker' });
    if (!process.env.API_KEY) return res.status(401).json({ error: 'API key not configured' });

    const result = await validateAndFetchTickerDetails(ticker.toUpperCase());
    return res.json(result);
  } catch (error: any) {
    console.error('Validation Error:', error);
    return res.status(500).json({ error: 'Failed to validate ticker' });
  }
});

// ─── ETF state endpoints ────────────────────────────────────────────────
app.get('/api/etfs', async (_req: Request, res: Response) => {
  const { getEtfsOnServer } = await import('./stateManager');
  const etfs = await getEtfsOnServer();
  return res.json(etfs);
});

app.post('/api/etfs', async (req: Request, res: Response) => {
  const { saveEtfOnServer } = await import('./stateManager');
  await saveEtfOnServer(req.body);
  return res.json({ ok: true });
});

app.delete('/api/etfs/:ticker', async (req: Request, res: Response) => {
  const { deleteEtfOnServer } = await import('./stateManager');
  await deleteEtfOnServer(req.params.ticker);
  return res.json({ ok: true });
});

app.get('/api/influencers', async (_req: Request, res: Response) => {
  const infs = await getInfluencersOnServer();
  return res.json(infs);
});

app.post('/api/influencers', async (req: Request, res: Response) => {
  const { saveInfluencerOnServer } = await import('./stateManager');
  await saveInfluencerOnServer(req.body);
  return res.json({ ok: true });
});

app.delete('/api/influencers/:handle', async (req: Request, res: Response) => {
  const { deleteInfluencerOnServer } = await import('./stateManager');
  await deleteInfluencerOnServer(decodeURIComponent(req.params.handle));
  return res.json({ ok: true });
});

app.post('/api/influencers/reset', async (_req: Request, res: Response) => {
  const { resetInfluencersOnServer } = await import('./stateManager');
  const defaults = await resetInfluencersOnServer();
  return res.json(defaults);
});

// ─── Strategia inwestora ────────────────────────────────────────────────────
app.get('/api/strategy', async (_req: Request, res: Response) => {
  return res.json({ strategy: await getStrategy() });
});

app.put('/api/strategy', async (req: Request, res: Response) => {
  const strategy = typeof req.body?.strategy === 'string' ? req.body.strategy : '';
  await saveStrategy(strategy);
  return res.json({ ok: true, strategy });
});

// ─── Podsumowanie portfelowe ("Podsumowanie dla mnie") ───────────────────────
// Szybki podgląd ostatnio wygenerowanego podsumowania (bez skanu).
app.get('/api/summary', async (_req: Request, res: Response) => {
  return res.json(await getLastSummary());
});

// Pełny skan wszystkich aktywów + synteza. Operacja ciężka (wiele wywołań Deep).
app.post('/api/summary', async (_req: Request, res: Response) => {
  try {
    if (!process.env.API_KEY) return res.status(401).json({ error: 'API key not configured' });
    const [{ signals, globalData }, strategy] = await Promise.all([scanAllTargets(), getStrategy()]);
    const summary = await generatePortfolioSummary(strategy, signals, globalData);
    await saveLastSummary(summary);
    return res.json(summary);
  } catch (error: any) {
    if (error.message === 'AUTH_REQUIRED') return res.status(401).json({ error: 'AUTH_REQUIRED' });
    console.error('Summary Error:', error);
    return res.status(500).json({ error: 'Failed to generate portfolio summary' });
  }
});

// ─── Powiadomienia / historia ──────────────────────────────────────────────
// Lekka historia ostatnio wykrytych sygnałów (z cyklicznych skanów).
app.get('/api/signals/recent', async (_req: Request, res: Response) => {
  res.json(await getRecentSignals());
});

// Ręczne uruchomienie skanu + wysyłki na Telegram (przydatne do konfiguracji).
app.post('/api/alerts/run', async (_req: Request, res: Response) => {
  try {
    const result = await runAlertScan();
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('Alert scan error:', error);
    return res.status(500).json({ error: 'Alert scan failed' });
  }
});

// Wiadomość testowa — sprawdza, czy token/chat_id Telegrama są poprawne.
app.post('/api/alerts/test', async (_req: Request, res: Response) => {
  if (!isTelegramConfigured()) {
    return res.status(400).json({ error: 'Telegram nie jest skonfigurowany (brak TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID)' });
  }
  const ok = await sendTelegramMessage('✅ Sentinel IKE: test połączenia z Telegramem działa.');
  return res.json({ ok });
});

// ─── Wykresy cenowe (koszt zakupu w PLN) ────────────────────────────────────
// Proxy do Yahoo (cena instrumentu + kurs EUR/PLN). Bez Gemini → nie wymaga API_KEY.
app.get('/api/chart', async (req: Request, res: Response) => {
  try {
    const ticker = String(req.query.ticker || '');
    const interval = String(req.query.interval || '1d');
    const range = String(req.query.range || 'month');
    if (!ticker) return res.status(400).json({ error: 'Missing ticker' });
    const result = await fetchPlnCostSeries(ticker, interval, range);
    return res.json(result);
  } catch (error: any) {
    if (String(error?.message).startsWith('Ticker not allowed')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Chart Error:', error);
    return res.status(500).json({ error: 'Failed to fetch chart' });
  }
});

// ─── Health ───────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    telegram: isTelegramConfigured(),
  });
});

// ─── Scheduler powiadomień ──────────────────────────────────────────────────
// ALERT_CRON może zawierać KILKA wyrażeń rozdzielonych ';' — np. "0 5 * * *;15 14 * * *"
// (skan o 5:00 ORAZ 14:15). Jednym wyrażeniem cron nie da się tego zapisać.
const ALERT_CRON = process.env.ALERT_CRON || '0 8 * * *'; // domyślnie 8:00 codziennie
if (isTelegramConfigured()) {
  const expressions = ALERT_CRON.split(';').map((e) => e.trim()).filter(Boolean);
  const scheduled: string[] = [];
  for (const expr of expressions) {
    if (cron.validate(expr)) {
      cron.schedule(expr, () => {
        console.log(`[Scheduler] Uruchamiam cykliczny skan rynku (cron: "${expr}")...`);
        runAlertScan().catch((err) => console.error('[Scheduler] Skan nie powiódł się:', err));
      });
      scheduled.push(expr);
    } else {
      console.error(`[Scheduler] Pomijam nieprawidłowe wyrażenie cron: "${expr}".`);
    }
  }
  if (scheduled.length) {
    console.log(`[Scheduler] Powiadomienia Telegram aktywne (${scheduled.length}× cron: ${scheduled.map((e) => `"${e}"`).join(', ')}).`);
  } else {
    console.error(`[Scheduler] Brak poprawnych wyrażeń w ALERT_CRON ("${ALERT_CRON}") — scheduler wyłączony.`);
  }
} else {
  console.log('[Scheduler] Telegram nie skonfigurowany — powiadomienia wyłączone.');
}

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Sentinel IKE Backend listening on 0.0.0.0:${port}`);
});

export default app;

