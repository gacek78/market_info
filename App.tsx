import React, { useCallback, useEffect, useState } from 'react';
import { MARKETS, ETFs, Cryptocurrencies } from './constants';
import { MarketCard } from './components/MarketCard';
import { SignalItem } from './components/SignalItem';
import { MarketData, Signal } from './types';

interface AttitudeData {
  hasSelectedApiKey: boolean;
  openSelectKey: () => void;
}

const getAIStudio = (): AttitudeData | null => {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    return (window as any).aistudio as AttitudeData;
  }
  return null;
};

export default function App() {
  const [data, setData] = useState<{ markets: MarketData[]; signals: Signal[] }>({ markets: [], signals: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  // Determine API base URL - w buildzie na produkcji będzie to domyślnie /api
  const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';

  const fetchMarketIntelligence = useCallback(async (ticker: string, marketType: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/market-intel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticker, marketType }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
          throw new Error('Unauthorized - please check API configuration');
        }
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  const validateAndFetchTickerDetails = useCallback(
    async (ticker: string, currentType: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/validate-ticker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ticker, currentType }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            setIsAuthenticated(false);
            throw new Error('Unauthorized - please check API configuration');
          }
          throw new Error(`Validation error: ${response.statusText}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Validation failed');
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    },
    [API_BASE]
  );

  // Check if we're in AI Studio (optional)
  const aiStudio = getAIStudio();
  const showAuthError = !isAuthenticated || (aiStudio && !aiStudio.hasSelectedApiKey);

  if (showAuthError) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full bg-slate-800 rounded-lg shadow-xl p-8 border border-slate-700">
          <h1 className="text-2xl font-bold text-white mb-4">Market Sentiment</h1>
          <p className="text-slate-300 mb-6">Unable to initialize API connection. Please ensure:</p>
          <ul className="text-slate-400 text-sm space-y-2 mb-6">
            <li>✓ Backend is running and accessible</li>
            <li>✓ Environment variables are properly configured</li>
            <li>✓ API_KEY or credentials are set</li>
          </ul>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          {aiStudio && !aiStudio.hasSelectedApiKey && (
            <button
              onClick={() => aiStudio.openSelectKey()}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition"
            >
              SELECT API KEY
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-2">Market Sentiment</h1>
          <p className="text-slate-400 text-lg">Real-time market analysis powered by AI</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
            <span className="ml-4 text-slate-300">Analyzing market data...</span>
          </div>
        )}

        {/* Markets Grid */}
        {!loading && data.markets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {data.markets.map((market, index) => (
              <MarketCard
                key={index}
                title={market.title}
                data={market.data}
                onClick={() => {
                  setSelectedMarket(market.title);
                  fetchMarketIntelligence(market.title, market.type);
                }}
              />
            ))}
          </div>
        )}

        {/* Signals Section */}
        {!loading && data.signals.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-4">Trading Signals</h2>
            <div className="space-y-3">
              {data.signals.map((signal, index) => (
                <SignalItem key={index} signal={signal} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && data.markets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg mb-6">Select a market category to analyze</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {Object.entries({
                Markets: MARKETS,
                ETFs: ETFs,
                'Crypto': Cryptocurrencies,
              }).map(([category, items]) => (
                <div key={category} className="text-left">
                  <h3 className="text-white font-semibold mb-2">{category}</h3>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((item) => (
                      <button
                        key={item}
                        onClick={() => validateAndFetchTickerDetails(item, category)}
                        className="block w-full text-left px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded transition text-sm"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
