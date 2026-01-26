import express, { Request, Response } from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Helper function to validate ticker
function isValidTicker(ticker: string): boolean {
  const tickerRegex = /^[A-Z0-9]{1,5}$/;
  return tickerRegex.test(ticker);
}

// Market Intelligence Endpoint
app.post('/api/market-intel', async (req: Request, res: Response) => {
  try {
    const { ticker, marketType } = req.body;

    if (!ticker || !marketType) {
      return res.status(400).json({ error: 'Missing ticker or marketType' });
    }

    if (!isValidTicker(ticker)) {
      return res.status(400).json({ error: 'Invalid ticker format' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(401).json({ error: 'API key not configured' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Analyze ${ticker} in the ${marketType} market. Provide:
1. Current market sentiment (bullish/bearish/neutral)
2. Key technical levels
3. Recent news impact
4. Trading signals
5. Risk assessment

Format as JSON with keys: sentiment, technicalLevels, newsImpact, signals, riskLevel`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON from response (Gemini should return structured data)
    let analysisData;
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[^{}]*\}/);
      analysisData = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: responseText };
    } catch (e) {
      analysisData = { raw: responseText };
    }

    return res.json({
      markets: [
        {
          title: ticker,
          type: marketType,
          data: analysisData,
        },
      ],
      signals: [
        {
          timestamp: new Date().toISOString(),
          ticker,
          signal: analysisData.sentiment || 'neutral',
          confidence: 0.85,
          description: `${ticker} market analysis complete`,
        },
      ],
    });
  } catch (error) {
    console.error('Market Intel Error:', error);
    return res.status(500).json({ error: 'Failed to analyze market' });
  }
});

// Validate Ticker Endpoint
app.post('/api/validate-ticker', async (req: Request, res: Response) => {
  try {
    const { ticker, currentType } = req.body;

    if (!ticker || !currentType) {
      return res.status(400).json({ error: 'Missing ticker or currentType' });
    }

    if (!isValidTicker(ticker)) {
      return res.status(400).json({ error: 'Invalid ticker format' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(401).json({ error: 'API key not configured' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Is "${ticker}" a valid ${currentType} ticker? Provide:
1. Validation result (valid/invalid)
2. Company/Asset name if valid
3. Current price range estimate
4. Market cap estimate

Format as JSON`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let validationData;
    try {
      const jsonMatch = responseText.match(/\{[^{}]*\}/);
      validationData = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: responseText };
    } catch (e) {
      validationData = { raw: responseText };
    }

    return res.json({
      markets: [
        {
          title: ticker,
          type: currentType,
          data: validationData,
        },
      ],
      signals: [
        {
          timestamp: new Date().toISOString(),
          ticker,
          signal: 'info',
          confidence: 0.9,
          description: `${ticker} validation complete`,
        },
      ],
    });
  } catch (error) {
    console.error('Validation Error:', error);
    return res.status(500).json({ error: 'Failed to validate ticker' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
  console.log(`Market Sentiment Backend running on port ${port}`);
});

export default app;
