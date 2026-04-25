import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  fetchMarketIntelligenceFast,
  fetchMarketIntelligenceDeep,
  validateAndFetchTickerDetails,
} from './geminiService';
import { getInfluencersOnServer } from './stateManager';

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

// ─── Health ───────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Sentinel IKE Backend listening on 0.0.0.0:${port}`);
});

export default app;

