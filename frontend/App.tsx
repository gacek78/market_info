
import React, { useState, useEffect, useCallback } from 'react';
import { ETF, MarketSignal, GlobalMacroData, Influencer, SignalFilter, LoadingPhase, CacheInfo } from './types';
import { MarketCard } from './components/MarketCard';
import { SignalFeed } from './components/SignalFeed';
import {
  fetchMarketIntelligenceFast,
  fetchMarketIntelligenceDeep,
  validateAndFetchTickerDetails,
  getCacheTimestamp,
  invalidateCache,
  getEtfs,
  saveEtf,
  deleteEtf as deleteEtfApi,
  getInfluencers,
  saveInfluencer,
  deleteInfluencer as deleteInfluencerApi,
  resetInfluencers as resetInfluencersApi,
} from './services/apiService';
import { DEFAULT_INFLUENCERS, TRACKED_ETFS } from './constants';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio: AIStudio;
  }
}

// ─── Cache info helper ────────────────────────────────────────────────────────
function buildCacheInfo(ts: Date | null): CacheInfo | null {
  if (!ts) return null;
  return {
    timeLabel: ts.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    ageMs: Date.now() - ts.getTime(),
  };
}

// ─── App ─────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [selectedEtf, setSelectedEtf] = useState<ETF | 'GLOBAL'>('GLOBAL');
  const [signals, setSignals] = useState<MarketSignal[]>([]);
  const [globalData, setGlobalData] = useState<GlobalMacroData | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [activeFilter, setActiveFilter] = useState<SignalFilter>('ALL');

  // Form states
  const [tickerInput, setTickerInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [infName, setInfName] = useState('');
  const [infHandle, setInfHandle] = useState('');
  const [showInfForm, setShowInfForm] = useState(false);

  // ─── Init: load ETFs + influencers from backend ──────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [serverEtfs, serverInfs] = await Promise.all([getEtfs(), getInfluencers()]);
        setEtfs(serverEtfs.length ? serverEtfs : TRACKED_ETFS);
        setInfluencers(serverInfs.length ? serverInfs : DEFAULT_INFLUENCERS);
      } catch {
        setEtfs(TRACKED_ETFS);
        setInfluencers(DEFAULT_INFLUENCERS);
      } finally {
        setInitialLoading(false);
      }
    };
    init();
  }, []);

  // ─── AI Studio auth check ─────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) setIsAuthRequired(true);
      }
    };
    checkAuth();
  }, []);

  // ─── Two-phase fetch ──────────────────────────────────────────────────────
  const runTwoPhase = useCallback(
    async (target: ETF | 'GLOBAL', forceRefresh = false) => {
      if (isAuthRequired) return;
      setActiveFilter('ALL');

      try {
        // FAZA 1 — Fast
        setLoadingPhase('fast');
        setSignals([]);

        // Check cache first (only for non-force)
        if (!forceRefresh) {
          const cachedTs = getCacheTimestamp(target);
          if (cachedTs) {
            const fastData = await fetchMarketIntelligenceFast(target, false);
            setSignals(fastData.signals);
            if (fastData.globalData) setGlobalData(fastData.globalData);
            setCacheInfo(buildCacheInfo(cachedTs));
            setLoadingPhase(null);
            return; // Served from cache — skip deep
          }
        } else {
          invalidateCache(target);
        }

        const fast = await fetchMarketIntelligenceFast(target, true);
        setSignals(fast.signals);
        if (fast.globalData) setGlobalData(fast.globalData);
        setCacheInfo(null);

        // FAZA 2 — Deep (does not reset signals, updates in-place)
        setLoadingPhase('deep');
        const deep = await fetchMarketIntelligenceDeep(target, forceRefresh);
        setSignals(deep.signals);
        if (deep.globalData) setGlobalData(deep.globalData);
        setLastUpdate(new Date());
        setCacheInfo(buildCacheInfo(new Date()));
      } catch (err: any) {
        if (err.message === 'AUTH_REQUIRED') setIsAuthRequired(true);
      } finally {
        setLoadingPhase(null);
      }
    },
    [isAuthRequired]
  );

  // Auto-run when selectedEtf changes or on init
  useEffect(() => {
    if (!initialLoading && !isAuthRequired) {
      runTwoPhase(selectedEtf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEtf, initialLoading, isAuthRequired]);

  // ─── ETF actions ──────────────────────────────────────────────────────────
  const addTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tickerInput) return;
    setVerifying(true);
    try {
      const details = await validateAndFetchTickerDetails(tickerInput.toUpperCase());
      if (details) {
        await saveEtf(details);
        setEtfs((prev) => [...prev, details]);
        setTickerInput('');
        setShowAddForm(false);
      } else {
        alert('Instrument niedostępny w XTB IKE lub nie znaleziono danych.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteEtf = async (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteEtfApi(ticker);
    setEtfs((prev) => prev.filter((etf) => etf.ticker !== ticker));
    if (typeof selectedEtf !== 'string' && selectedEtf.ticker === ticker) setSelectedEtf('GLOBAL');
  };

  // ─── Influencer actions ───────────────────────────────────────────────────
  const addInfluencer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!infName || !infHandle) return;
    const newInf: Influencer = { name: infName, handle: infHandle, impact: 'Monitorowany' };
    await saveInfluencer(newInf);
    setInfluencers((prev) => [...prev, newInf]);
    setInfName(''); setInfHandle(''); setShowInfForm(false);
  };

  const handleDeleteInfluencer = async (handle: string) => {
    await deleteInfluencerApi(handle);
    setInfluencers((prev) => prev.filter((i) => i.handle !== handle));
  };

  const handleResetInfluencers = async () => {
    if (confirm('Resetuj listę do domyślnych?')) {
      const defaults = await resetInfluencersApi();
      setInfluencers(defaults.length ? defaults : DEFAULT_INFLUENCERS);
    }
  };

  // ─── Auth gate ────────────────────────────────────────────────────────────
  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsAuthRequired(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-200">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">
            Synchronizacja z serwerem...
          </p>
        </div>
      </div>
    );
  }

  if (isAuthRequired) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-10 shadow-2xl">
          <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Wymagana Autoryzacja</h2>
          <p className="text-slate-400 text-sm mb-8">
            Połącz klucz API Google Cloud z aktywowanym bilingiem, aby korzystać z Gemini Intelligence.
          </p>
          <button
            onClick={handleConnectKey}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20"
          >
            POŁĄCZ KLUCZ API
          </button>
        </div>
      </div>
    );
  }

  // ─── Main layout ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#020617] text-slate-200 pb-10">

      {/* LEFT SIDEBAR */}
      <aside className="w-full lg:w-80 border-r border-slate-800/50 p-6 flex flex-col bg-slate-900/20">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40 font-black text-white">
            M
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Market Info</h1>
            <p className="text-[10px] text-blue-400 uppercase font-black tracking-widest italic">
              v3.2 · Two-Phase AI
            </p>
          </div>
        </div>

        {/* Global button */}
        <button
          onClick={() => setSelectedEtf('GLOBAL')}
          className={`w-full p-4 mb-8 rounded-2xl border transition-all flex items-center gap-4 ${
            selectedEtf === 'GLOBAL'
              ? 'bg-blue-600 border-blue-400 shadow-xl'
              : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
          }`}
        >
          <div className="p-2 bg-white/10 rounded-lg">🌍</div>
          <span className="font-bold text-sm">Przegląd Globalny</span>
        </button>

        {/* ETF list header */}
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Twoje Instrumenty
          </h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-blue-400 hover:text-white transition-colors text-lg"
          >
            +
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <form onSubmit={addTicker} className="mb-6">
            <div className="flex gap-2">
              <input
                autoFocus
                placeholder="Ticker (np. VOO.US)"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs uppercase focus:border-blue-500 outline-none"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
              />
              <button
                disabled={verifying}
                className="bg-blue-600 px-3 rounded-lg text-xs font-bold disabled:opacity-50"
              >
                {verifying ? '...' : 'Dodaj'}
              </button>
            </div>
          </form>
        )}

        {/* ETF cards */}
        <div className="space-y-3 overflow-y-auto pr-1 flex-1">
          {etfs.map((etf) => (
            <MarketCard
              key={etf.ticker}
              etf={etf}
              isActive={typeof selectedEtf !== 'string' && selectedEtf.ticker === etf.ticker}
              onClick={() => setSelectedEtf(etf)}
              onDelete={(e) => handleDeleteEtf(etf.ticker, e)}
            />
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 lg:p-12 overflow-y-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-3xl font-black text-white">
                {selectedEtf === 'GLOBAL' ? 'Analiza Globalna' : (selectedEtf as ETF).name}
              </h2>
              <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-[10px] font-bold border border-blue-500/30 uppercase">
                {selectedEtf === 'GLOBAL' ? 'Macro' : (selectedEtf as ETF).ticker}
              </span>
            </div>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed italic">
              {selectedEtf === 'GLOBAL'
                ? 'Analiza głównych silników rynkowych (waluty, stopy, inflacja).'
                : `Analiza dedykowana: ${(selectedEtf as ETF).ticker}. AI monitoruje sektor ${(selectedEtf as ETF).category}.`}
            </p>
          </div>
          <button
            onClick={() => runTwoPhase(selectedEtf, true)}
            disabled={loadingPhase !== null}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs"
          >
            {loadingPhase !== null ? 'Analizuję...' : 'Odśwież Dane'}
          </button>
        </header>

        <section className="space-y-10">
          {/* Global macro bar */}
          {selectedEtf === 'GLOBAL' && globalData && (
            <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-blue-500 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
                  <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">
                    Status Rynku (GLOBAL)
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Waluty</span>
                    <div className="text-xl font-mono font-bold text-white">
                      {globalData.usdPln} <span className="text-[10px] opacity-40">USD/PLN</span>
                    </div>
                    <div className="text-xl font-mono font-bold text-white">
                      {globalData.eurPln} <span className="text-[10px] opacity-40">EUR/PLN</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Inflacja</span>
                    <div className="text-xl font-mono font-bold text-red-400">
                      {globalData.cpiPl} <span className="text-[10px] opacity-40">PL</span>
                    </div>
                    <div className="text-xl font-mono font-bold text-red-400">
                      {globalData.cpiUs} <span className="text-[10px] opacity-40">US</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Stopy</span>
                    <div className="text-xl font-mono font-bold text-blue-400">
                      {globalData.ratesPl} <span className="text-[10px] opacity-40">NBP</span>
                    </div>
                    <div className="text-xl font-mono font-bold text-blue-400">
                      {globalData.ratesUs} <span className="text-[10px] opacity-40">FED</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Ryzyko (VIX)</span>
                    <div className="text-xl font-mono font-bold text-amber-500">{globalData.vix}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Intelligence Feed */}
          <SignalFeed
            signals={signals}
            loadingPhase={loadingPhase}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            cacheInfo={cacheInfo}
          />
        </section>
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="w-full lg:w-80 border-l border-slate-800/50 p-6 bg-slate-900/10 flex flex-col gap-8 overflow-y-auto">

        {/* Sentiment radar */}
        <div className="p-6 bg-blue-900/10 border border-blue-500/20 border-l-4 border-l-blue-500 rounded-3xl shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
              Radar Sentymentu
            </h4>
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2">
                <span>Byki (Greed)</span>
                <span>{globalData?.sentiment ?? 50}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-1000"
                  style={{ width: `${globalData?.sentiment ?? 50}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2">
                <span>Niedźwiedzie (Fear)</span>
                <span>{globalData?.risk ?? 50}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-1000"
                  style={{ width: `${globalData?.risk ?? 50}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Social radar */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
              <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                Radar Społeczny
              </h4>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInfForm(!showInfForm)}
                className="text-blue-400 hover:text-white"
                title="Dodaj osobę"
              >
                +
              </button>
              <button
                onClick={handleResetInfluencers}
                className="text-slate-600 hover:text-red-400"
                title="Resetuj do domyślnych"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
          </div>

          {showInfForm && (
            <form onSubmit={addInfluencer} className="mb-6 p-4 bg-slate-800 border border-slate-700 rounded-2xl">
              <input
                placeholder="Imię"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-[10px] mb-2 focus:border-blue-500 outline-none"
                value={infName}
                onChange={(e) => setInfName(e.target.value)}
              />
              <input
                placeholder="@handle"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-[10px] mb-3 focus:border-blue-500 outline-none"
                value={infHandle}
                onChange={(e) => setInfHandle(e.target.value)}
              />
              <button className="w-full bg-blue-600 py-2 rounded-lg text-[10px] font-bold">
                Dodaj
              </button>
            </form>
          )}

          <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-2">
            {influencers.map((inf) => (
              <div
                key={inf.handle}
                className="group flex items-center justify-between gap-3 p-2 hover:bg-slate-800/40 rounded-xl transition-all"
              >
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
                  onClick={() => handleDeleteInfluencer(inf.handle)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-500 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* IKE Rule */}
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl opacity-60 mt-auto">
          <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">IKE Rule #1</h4>
          <p className="text-[10px] text-slate-400 italic">
            "Gdy wszyscy kupują w euforii — ostrożnie. Gdy krew się leje — szukaj okazji."
          </p>
        </div>
      </aside>

      {/* FOOTER STATUS BAR */}
      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-black/80 backdrop-blur-md border-t border-slate-800/50 flex items-center justify-between px-6 z-50">
        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          Market Info v3.2
          {loadingPhase === 'fast' && (
            <span className="text-amber-400 ml-2">⚡ Fast</span>
          )}
          {loadingPhase === 'deep' && (
            <span className="text-blue-400 ml-2">🔍 Deep</span>
          )}
        </div>
        <div className="text-[9px] font-bold text-slate-500 uppercase">
          Zsynchronizowano: {lastUpdate.toLocaleTimeString('pl-PL')}
        </div>
      </footer>
    </div>
  );
};

export default App;
