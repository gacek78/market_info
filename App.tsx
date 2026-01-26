
import React, { useState, useEffect, useCallback } from 'react';
import { TRACKED_ETFS, INFLUENCERS } from './constants';
import { ETF, MarketSignal, EconomicEvent, GlobalMacroData } from './types';
import { MarketCard } from './components/MarketCard';
import { SignalItem } from './components/SignalItem';
import { fetchMarketIntelligence, validateAndFetchTickerDetails } from './services/geminiService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // Removed readonly modifier to satisfy TypeScript compiler requirement for identical modifiers across all declarations.
    aistudio: AIStudio;
  }
}

const STORAGE_KEY = 'xtb_sentinel_etfs';

const App: React.FC = () => {
  const [etfs, setEtfs] = useState<ETF[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : TRACKED_ETFS;
  });

  const [selectedEtf, setSelectedEtf] = useState<ETF | 'GLOBAL'>('GLOBAL');
  const [signals, setSignals] = useState<MarketSignal[]>([]);
  const [globalData, setGlobalData] = useState<GlobalMacroData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAuthRequired, setIsAuthRequired] = useState<boolean>(false);

  // Form states
  const [tickerInput, setTickerInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Inicjalizacja danych
  const handleRefresh = useCallback(async () => {
    if (isAuthRequired) return;
    setLoading(true);
    try {
      const result = await fetchMarketIntelligence(selectedEtf, INFLUENCERS);
      setSignals(result.signals);
      if (result.globalData) setGlobalData(result.globalData);
      setLastUpdate(new Date());
      setIsAuthRequired(false);
    } catch (error: any) {
      if (error.message === 'AUTH_REQUIRED') {
        setIsAuthRequired(true);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedEtf, isAuthRequired]);

  useEffect(() => {
    const checkAuth = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) setIsAuthRequired(true);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    handleRefresh();
  }, [selectedEtf]);

  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsAuthRequired(false);
      handleRefresh();
    }
  };

  const addTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tickerInput) return;
    setVerifying(true);
    const details = await validateAndFetchTickerDetails(tickerInput.toUpperCase());
    if (details) {
      setEtfs(prev => [...prev, details]);
      setTickerInput('');
      setShowAddForm(false);
    } else {
      alert("Nie znaleziono instrumentu w ofercie XTB IKE.");
    }
    setVerifying(false);
  };

  const deleteEtf = (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEtfs(prev => prev.filter(etf => etf.ticker !== ticker));
    if (typeof selectedEtf !== 'string' && selectedEtf.ticker === ticker) setSelectedEtf('GLOBAL');
  };

  if (isAuthRequired) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[32px] p-10 text-center shadow-2xl">
          <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Wymagana Autoryzacja Google</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Aby korzystać z narzędzia <strong>Google Search Grounding</strong> (niezbędnego do pobierania aktualnych kursów), musisz połączyć klucz API z płatnego projektu Google Cloud.
          </p>
          <button onClick={handleConnectKey} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all">
            POŁĄCZ KLUCZ API
          </button>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener" className="block mt-6 text-[10px] text-slate-500 uppercase tracking-widest font-bold hover:text-blue-400">
            Dowiedz się o płatnościach (Billing)
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#020617] text-slate-200">
      
      {/* LEWY PANEL: INSTRUMENTY */}
      <aside className="w-full lg:w-80 border-r border-slate-800/50 p-6 flex flex-col bg-slate-900/20">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40 font-black text-white">X</div>
          <div>
            <h1 className="font-bold text-lg leading-tight">IKE Sentinel</h1>
            <p className="text-[10px] text-blue-400 uppercase font-black tracking-widest">XTB Market Intelligence</p>
          </div>
        </div>

        <button 
          onClick={() => setSelectedEtf('GLOBAL')}
          className={`w-full p-4 mb-8 rounded-2xl border transition-all flex items-center gap-4 ${
            selectedEtf === 'GLOBAL' ? 'bg-blue-600 border-blue-400 shadow-xl' : 'bg-slate-800/50 border-slate-700'
          }`}
        >
          <div className="p-2 bg-white/10 rounded-lg">🌍</div>
          <span className="font-bold text-sm">Przegląd Globalny</span>
        </button>

        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Twoje Portfel</h2>
          <button onClick={() => setShowAddForm(!showAddForm)} className="text-blue-400 hover:text-white">+</button>
        </div>

        {showAddForm && (
          <form onSubmit={addTicker} className="mb-6 animate-in slide-in-from-top-2">
            <div className="flex gap-2">
              <input 
                autoFocus
                placeholder="Ticker (np. VOO.US)" 
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs uppercase"
                value={tickerInput}
                onChange={e => setTickerInput(e.target.value)}
              />
              <button disabled={verifying} className="bg-blue-600 px-3 rounded-lg text-xs font-bold">
                {verifying ? '...' : 'Dodaj'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3 overflow-y-auto max-h-[50vh] lg:max-h-none">
          {etfs.map(etf => (
            <MarketCard 
              key={etf.ticker} 
              etf={etf} 
              isActive={typeof selectedEtf !== 'string' && selectedEtf.ticker === etf.ticker}
              onClick={() => setSelectedEtf(etf)}
              onDelete={(e) => deleteEtf(etf.ticker, e)}
            />
          ))}
        </div>
      </aside>

      {/* ŚRODEK: GŁÓWNY FEED (DANE I ŹRÓDŁA) */}
      <main className="flex-1 p-6 lg:p-12 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-3xl font-black text-white">
                {selectedEtf === 'GLOBAL' ? 'Global Intelligence' : selectedEtf.name}
              </h2>
              <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-[10px] font-bold border border-blue-500/30 uppercase">
                {selectedEtf === 'GLOBAL' ? 'Macro' : selectedEtf.ticker}
              </span>
            </div>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              {selectedEtf === 'GLOBAL' ? 'Kompleksowa analiza czynników wpływających na polskiego inwestora IKE.' : selectedEtf.description}
            </p>
          </div>
          <button onClick={handleRefresh} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-2xl shadow-2xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs">
            {loading ? 'Skanowanie...' : 'Skanuj Rynek'}
          </button>
        </header>

        <section className="space-y-10">
          {/* CENTRALNA KARTA DANYCH MAKRO ZE ŹRÓDŁAMI */}
          {selectedEtf === 'GLOBAL' && globalData && (
            <div className="bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl">
              <div className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                  <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.3em]">Aktualny Status Rynkowy</h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Waluty (PLN)</span>
                    <div className="text-2xl font-mono font-bold text-white">{globalData.usdPln} <span className="text-[10px] text-slate-600">USD</span></div>
                    <div className="text-2xl font-mono font-bold text-white">{globalData.eurPln} <span className="text-[10px] text-slate-600">EUR</span></div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Inflacja (CPI)</span>
                    <div className="text-2xl font-mono font-bold text-red-400">{globalData.cpiPl} <span className="text-[10px] text-slate-600">Polska</span></div>
                    <div className="text-2xl font-mono font-bold text-red-400">{globalData.cpiUs} <span className="text-[10px] text-slate-600">USA</span></div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Stopy Procentowe</span>
                    <div className="text-2xl font-mono font-bold text-blue-400">{globalData.ratesPl} <span className="text-[10px] text-slate-600">NBP</span></div>
                    <div className="text-2xl font-mono font-bold text-blue-400">{globalData.ratesUs} <span className="text-[10px] text-slate-600">FED</span></div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Ryzyko (VIX)</span>
                    <div className="text-2xl font-mono font-bold text-amber-500">{globalData.vix}</div>
                    <span className="text-[9px] text-slate-600 italic">Indeks strachu</span>
                  </div>
                </div>

                {/* ŹRÓDŁA: WYŁĄCZNIE NA ŚRODKU POD DANYMI */}
                <div className="mt-10 pt-8 border-t border-slate-800">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-4">Weryfikowalne źródła danych powyżej:</span>
                  <div className="flex flex-wrap gap-3">
                    {globalData.sources?.map((src, i) => (
                      <a key={i} href={src.uri} target="_blank" rel="noopener" className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all text-[10px] font-bold text-blue-400">
                        <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                        {src.title}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LISTA SYGNAŁÓW */}
          <div className="space-y-6">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Live Intelligence Stream
            </h3>
            {signals.length > 0 ? (
              signals.map(s => <SignalItem key={s.id} signal={s} />)
            ) : !loading && (
              <div className="text-center py-20 bg-slate-900/10 rounded-[40px] border-2 border-dashed border-slate-800/50 text-slate-600 text-sm">
                Kliknij przycisk "Skanuj Rynek", aby pobrać najnowsze sygnały.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* PRAWY PANEL: RADAR (TYLKO WIZUALIZACJA) */}
      <div className="w-full lg:w-80 border-l border-slate-800/50 p-6 bg-slate-900/10 space-y-8">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Market Vibe Check</h4>
          
          <div className="space-y-8">
            <div>
              <div className="flex justify-between text-[10px] font-bold text-green-400 uppercase mb-2">
                <span>Sentyment</span>
                <span>{globalData?.sentiment || 50}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${globalData?.sentiment || 50}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] font-bold text-red-400 uppercase mb-2">
                <span>Ryzyko</span>
                <span>{globalData?.risk || 50}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${globalData?.risk || 50}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-blue-900/10 border border-blue-500/20 rounded-3xl">
          <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4 italic">IKE Strategy Tip</h4>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            W portfelu IKE podatki nie zjadają Twoich zysków. <span className="text-blue-400 font-bold">Skoncentruj się na długim terminie.</span> Nadmiarowa rotacja generuje jedynie koszty transakcyjne.
          </p>
        </div>

        <div className="pt-6 border-t border-slate-800">
           <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-4">Kluczowi Influencerzy (Monitorowani)</span>
           <div className="space-y-4">
             {INFLUENCERS.slice(0, 4).map(inf => (
               <div key={inf.handle} className="flex items-center gap-3 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all">
                 <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold">{inf.name[0]}</div>
                 <div>
                   <div className="text-[10px] font-bold text-slate-300">{inf.name}</div>
                   <div className="text-[8px] text-slate-600">{inf.handle}</div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-black/80 backdrop-blur-md border-t border-slate-800/50 flex items-center justify-between px-6 z-50">
        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          System Operacyjny: Sentinel v2.0
        </div>
        <div className="text-[9px] font-bold text-slate-500 uppercase">
          {lastUpdate.toLocaleTimeString()}
        </div>
      </footer>
    </div>
  );
};

export default App;
