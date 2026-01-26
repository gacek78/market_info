
import React, { useState, useEffect, useCallback } from 'react';
import { ETF, MarketSignal, GlobalMacroData, Influencer } from './types';
import { MarketCard } from './components/MarketCard';
import { SignalItem } from './components/SignalItem';
import { fetchMarketIntelligence, validateAndFetchTickerDetails } from '../backend/geminiService';
import { 
  getEtfsOnServer, saveEtfOnServer, deleteEtfOnServer,
  getInfluencersOnServer, saveInfluencerOnServer, deleteInfluencerOnServer, resetInfluencersOnServer
} from '../backend/stateManager';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // Removed readonly modifier to fix declaration conflict across files
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [selectedEtf, setSelectedEtf] = useState<ETF | 'GLOBAL'>('GLOBAL');
  const [signals, setSignals] = useState<MarketSignal[]>([]);
  const [globalData, setGlobalData] = useState<GlobalMacroData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAuthRequired, setIsAuthRequired] = useState<boolean>(false);

  // Form states
  const [tickerInput, setTickerInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [infName, setInfName] = useState('');
  const [infHandle, setInfHandle] = useState('');
  const [showInfForm, setShowInfForm] = useState(false);

  // POBIERANIE DANYCH Z SERWERA NA START
  useEffect(() => {
    const initData = async () => {
      try {
        const [serverEtfs, serverInfs] = await Promise.all([
          getEtfsOnServer(),
          getInfluencersOnServer()
        ]);
        setEtfs(serverEtfs);
        setInfluencers(serverInfs);
      } catch (err) {
        console.error("Failed to load server data", err);
      } finally {
        setInitialLoading(false);
      }
    };
    initData();
  }, []);

  // MANDATORY: Check for API Key selection on mount as per Gemini Pro requirements
  useEffect(() => {
    const checkAuth = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) setIsAuthRequired(true);
      }
    };
    checkAuth();
  }, []);

  const handleRefresh = useCallback(async () => {
    if (initialLoading || isAuthRequired) return;
    setLoading(true);
    try {
      const result = await fetchMarketIntelligence(selectedEtf, influencers);
      setSignals(result.signals);
      if (result.globalData) setGlobalData(result.globalData);
      setLastUpdate(new Date());
    } catch (error: any) {
      if (error.message === 'AUTH_REQUIRED') setIsAuthRequired(true);
    } finally {
      setLoading(false);
    }
  }, [selectedEtf, influencers, initialLoading, isAuthRequired]);

  useEffect(() => {
    if (!isAuthRequired && !initialLoading) {
      handleRefresh();
    }
  }, [selectedEtf, isAuthRequired, handleRefresh, initialLoading]);

  // MANDATORY: Function to trigger API Key selection dialog
  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsAuthRequired(false);
      handleRefresh();
    }
  };

  // AKCJE SERWEROWE - ETFS
  const addTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tickerInput) return;
    setVerifying(true);
    try {
      const details = await validateAndFetchTickerDetails(tickerInput.toUpperCase());
      if (details) {
        await saveEtfOnServer(details);
        setEtfs(prev => [...prev, details]);
        setTickerInput('');
        setShowAddForm(false);
      } else {
        alert("Instrument niedostępny w XTB IKE.");
      }
    } finally {
      setVerifying(false);
    }
  };

  const deleteEtf = async (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteEtfOnServer(ticker);
    setEtfs(prev => prev.filter(etf => etf.ticker !== ticker));
    if (typeof selectedEtf !== 'string' && selectedEtf.ticker === ticker) setSelectedEtf('GLOBAL');
  };

  // AKCJE SERWEROWE - INFLUENCERS
  const addInfluencer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!infName || !infHandle) return;
    const newInf = { name: infName, handle: infHandle, impact: 'Monitorowany' };
    await saveInfluencerOnServer(newInf);
    setInfluencers(prev => [...prev, newInf]);
    setInfName(''); setInfHandle(''); setShowInfForm(false);
  };

  const deleteInfluencer = async (handle: string) => {
    await deleteInfluencerOnServer(handle);
    setInfluencers(prev => prev.filter(inf => inf.handle !== handle));
  };

  const resetInfluencers = async () => {
    if (confirm("Resetuj listę osób na serwerze do domyślnych?")) {
      const defaults = await resetInfluencersOnServer();
      setInfluencers(defaults);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-200">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">Synchronizacja z serwerem...</p>
        </div>
      </div>
    );
  }

  // MANDATORY: Render auth selection screen if API key is not configured or fails
  if (isAuthRequired) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[32px] p-10 shadow-2xl">
          <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Wymagana Autoryzacja</h2>
          <p className="text-slate-400 text-sm mb-8">Połącz klucz API Google Cloud z aktywowanym bilingiem, aby korzystać z Gemini 3 Pro Intelligence. (ai.google.dev/gemini-api/docs/billing)</p>
          <button onClick={handleConnectKey} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20">POŁĄCZ KLUCZ API</button>
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
            <h1 className="font-bold text-lg leading-tight">Sentinel IKE</h1>
            <p className="text-[10px] text-blue-400 uppercase font-black tracking-widest italic text-right">Cloud Persistent</p>
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
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Twoje Instrumenty</h2>
          <button onClick={() => setShowAddForm(!showAddForm)} className="text-blue-400 hover:text-white transition-colors">+</button>
        </div>

        {showAddForm && (
          <form onSubmit={addTicker} className="mb-6 animate-in slide-in-from-top-2">
            <div className="flex gap-2">
              <input 
                autoFocus
                placeholder="Ticker (np. VOO.US)" 
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs uppercase focus:border-blue-500 outline-none"
                value={tickerInput}
                onChange={e => setTickerInput(e.target.value)}
              />
              <button disabled={verifying} className="bg-blue-600 px-3 rounded-lg text-xs font-bold">
                {verifying ? '...' : 'Dodaj'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3 overflow-y-auto pr-1">
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

      {/* ŚRODEK: INTELLIGENCE FEED */}
      <main className="flex-1 p-6 lg:p-12 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-3xl font-black text-white">
                {selectedEtf === 'GLOBAL' ? 'Global Analysis' : selectedEtf.name}
              </h2>
              <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-[10px] font-bold border border-blue-500/30 uppercase">
                {selectedEtf === 'GLOBAL' ? 'Macro' : selectedEtf.ticker}
              </span>
            </div>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed italic">
              {selectedEtf === 'GLOBAL' 
                ? 'Analiza głównych silników rynkowych (waluty, stopy, inflacja).' 
                : `Analiza dedykowana: ${selectedEtf.ticker}. AI monitoruje sektor ${selectedEtf.category}.`}
            </p>
          </div>
          <button 
            onClick={handleRefresh} 
            disabled={loading} 
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs"
          >
            {loading ? 'Generowanie Raportu...' : 'Odśwież Dane'}
          </button>
        </header>

        <section className="space-y-10">
          {selectedEtf === 'GLOBAL' && globalData && (
            <div className="bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl border-b-4 border-b-blue-600 animate-in fade-in zoom-in duration-500">
              <div className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                  <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.3em]">Status Rynku (GLOBAL)</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Waluty</span>
                    <div className="text-xl font-mono font-bold text-white">{globalData.usdPln} <span className="text-[10px] opacity-40">USD</span></div>
                    <div className="text-xl font-mono font-bold text-white">{globalData.eurPln} <span className="text-[10px] opacity-40">EUR</span></div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Inflacja</span>
                    <div className="text-xl font-mono font-bold text-red-400">{globalData.cpiPl} <span className="text-[10px] opacity-40">PL</span></div>
                    <div className="text-xl font-mono font-bold text-red-400">{globalData.cpiUs} <span className="text-[10px] opacity-40">US</span></div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Stopy (NBP/FED)</span>
                    <div className="text-xl font-mono font-bold text-blue-400">{globalData.ratesPl}</div>
                    <div className="text-xl font-mono font-bold text-blue-400">{globalData.ratesUs}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Risk (VIX)</span>
                    <div className="text-xl font-mono font-bold text-amber-500">{globalData.vix}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {typeof selectedEtf !== 'string' && (
            <div className="p-8 bg-blue-900/10 border border-blue-500/20 rounded-[32px] shadow-xl border-l-8 border-l-blue-600 animate-in slide-in-from-left-4">
               <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2 underline decoration-blue-500/50 underline-offset-4">Ticker Insights: {selectedEtf.ticker}</h4>
               <p className="text-slate-300 text-sm leading-relaxed">
                 Analiza sektorowa dla <span className="text-blue-400 font-bold">{selectedEtf.category}</span>.
                 Sygnały są filtrowane pod kątem korelacji z ceną tego aktywa.
               </p>
            </div>
          )}

          <div className="space-y-6">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Intelligence Stream
            </h3>
            {signals.length > 0 ? (
              signals.map(s => <SignalItem key={s.id} signal={s} />)
            ) : !loading && (
              <div className="text-center py-20 bg-slate-900/20 rounded-[40px] border-2 border-dashed border-slate-800/50 text-slate-600 text-sm">
                Brak nowych sygnałów. Kliknij przycisk odświeżania.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* PRAWY PANEL: RADAR I INFLUENCERZY */}
      <aside className="w-full lg:w-80 border-l border-slate-800/50 p-6 bg-slate-900/10 flex flex-col gap-8 overflow-y-auto">
        
        {/* SENTYMENT RYNKOWY */}
        <div className="p-6 bg-blue-900/10 border border-blue-500/20 rounded-3xl shadow-lg animate-in slide-in-from-right-4">
          <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-6">Radar Sentymentu</h4>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2">
                <span>Byki (Greed)</span>
                <span>{globalData?.sentiment || 50}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${globalData?.sentiment || 50}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2">
                <span>Niedźwiedzie (Fear)</span>
                <span>{globalData?.risk || 50}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${globalData?.risk || 50}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* RADAR SPOŁECZNY (INFLUENCERZY) */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Radar Społeczny (X)</h4>
            <div className="flex gap-2">
               <button onClick={() => setShowInfForm(!showInfForm)} className="text-blue-400 hover:text-white" title="Dodaj osobę">+</button>
               <button onClick={resetInfluencers} className="text-slate-600 hover:text-red-400" title="Resetuj na serwerze">
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
               </button>
            </div>
          </div>

          {showInfForm && (
            <form onSubmit={addInfluencer} className="mb-6 p-4 bg-slate-800 border border-slate-700 rounded-2xl animate-in slide-in-from-top-1">
              <input 
                placeholder="Imię" 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-[10px] mb-2 focus:border-blue-500 outline-none"
                value={infName} onChange={e => setInfName(e.target.value)}
              />
              <input 
                placeholder="@handle" 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-[10px] mb-3 focus:border-blue-500 outline-none"
                value={infHandle} onChange={e => setInfHandle(e.target.value)}
              />
              <button className="w-full bg-blue-600 py-2 rounded-lg text-[10px] font-bold">Zapisz na serwerze</button>
            </form>
          )}

          <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-2">
            {influencers.map(inf => (
              <div key={inf.handle} className="group flex items-center justify-between gap-3 p-2 hover:bg-slate-800/40 rounded-xl transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-blue-400">
                    {inf.name[0]}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-[10px] font-bold text-slate-300 truncate">{inf.name}</div>
                    <div className="text-[8px] text-slate-500 truncate">{inf.handle}</div>
                  </div>
                </div>
                <button 
                  onClick={() => deleteInfluencer(inf.handle)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-500 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl opacity-60 mt-auto">
          <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">IKE Rule #1</h4>
          <p className="text-[10px] text-slate-400 italic">"Gdy wszyscy kupują w euforii, Sentinel ostrzega. Gdy krew się leje, Sentinel szuka okazji."</p>
        </div>
      </aside>

      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-black/80 backdrop-blur-md border-t border-slate-800/50 flex items-center justify-between px-6 z-50">
        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
          Sentinel Engine v3.1 • Server Synced
        </div>
        <div className="text-[9px] font-bold text-slate-500 uppercase">
          Synced: {lastUpdate.toLocaleTimeString()}
        </div>
      </footer>
    </div>
  );
};

export default App;
