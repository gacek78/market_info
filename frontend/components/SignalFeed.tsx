import React from 'react';
import { MarketSignal, SignalFilter, LoadingPhase, CacheInfo } from '../types';
import { SignalItem } from './SignalItem';
import { SkeletonFeed } from './SkeletonSignal';

interface SignalFeedProps {
  signals: MarketSignal[];
  loadingPhase: LoadingPhase;
  activeFilter: SignalFilter;
  onFilterChange: (f: SignalFilter) => void;
  cacheInfo: CacheInfo | null;
}

const FILTERS: { key: SignalFilter; label: string }[] = [
  { key: 'ALL',     label: 'Wszystko' },
  { key: 'DZIS',    label: 'Dziś' },
  { key: 'TYDZIEN', label: 'Tydzień' },
  { key: 'MIESIAC', label: 'Miesiąc' },
];

function filterSignals(signals: MarketSignal[], filter: SignalFilter): MarketSignal[] {
  if (filter === 'ALL') return signals;
  return signals.filter((s) => s.priority === filter);
}

function countByFilter(signals: MarketSignal[], filter: SignalFilter): number {
  if (filter === 'ALL') return signals.length;
  return signals.filter((s) => s.priority === filter).length;
}

export const SignalFeed: React.FC<SignalFeedProps> = ({
  signals,
  loadingPhase,
  activeFilter,
  onFilterChange,
  cacheInfo,
}) => {
  const isInitialLoad = loadingPhase === 'fast' && signals.length === 0;
  const isDeepLoading = loadingPhase === 'deep';
  const filtered = filterSignals(signals, activeFilter);

  return (
    <div className="space-y-6">
      {/* Header row: phase indicator + cache info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Phase indicator */}
        <div className="flex items-center gap-2">
          {loadingPhase === 'fast' && (
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              ⚡ Szybka analiza...
            </span>
          )}
          {loadingPhase === 'deep' && (
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-400 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              🔍 Weryfikacja źródeł...
            </span>
          )}
          {loadingPhase === null && signals.length > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
              Strumień sygnałów
            </span>
          )}
        </div>

        {/* Cache info */}
        {cacheInfo && loadingPhase === null && (
          <span className="text-[9px] text-slate-500 font-mono">
            Dane z {cacheInfo.timeLabel}
          </span>
        )}
      </div>

      {/* Filter bar */}
      {signals.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(({ key, label }) => {
            const count = countByFilter(signals, key);
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                onClick={() => onFilterChange(key)}
                disabled={count === 0 && key !== 'ALL'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  isActive
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {label}
                <span
                  className={`ml-1 px-1 rounded-full text-[8px] font-black ${
                    isActive ? 'bg-white/20' : 'bg-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {isInitialLoad ? (
        <SkeletonFeed count={3} />
      ) : filtered.length > 0 ? (
        <div className="space-y-4">
          {/* Deep loading overlay on top of fast results */}
          {isDeepLoading && (
            <div className="flex items-center gap-2 p-3 bg-blue-900/20 border border-blue-500/20 rounded-xl">
              <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <p className="text-[10px] text-blue-300 font-bold">
                Aktualizowanie o dane z sieci...
              </p>
            </div>
          )}
          {filtered.map((s) => (
            <SignalItem key={s.id} signal={s} />
          ))}
        </div>
      ) : signals.length > 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          Brak sygnałów dla filtru „{FILTERS.find((f) => f.key === activeFilter)?.label}".
        </div>
      ) : (
        !loadingPhase && (
          <div className="text-center py-20 bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-800/50 text-slate-600 text-sm">
            Brak nowych sygnałów. Kliknij przycisk odświeżania.
          </div>
        )
      )}
    </div>
  );
};
