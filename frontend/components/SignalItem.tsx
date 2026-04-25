import React from 'react';
import { MarketSignal } from '../types';
import { getSourceCredibility } from '../services/apiService';

interface SignalItemProps {
  signal: MarketSignal;
}

function getRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffMin < 2) return 'przed chwilą';
  if (diffMin < 60) return `${diffMin} min temu`;
  if (diffH < 24) return `${diffH}h temu`;
  return `${diffD}d temu`;
}

function getCredibilityBadge(uri: string): JSX.Element {
  const cred = getSourceCredibility(uri);
  const domain = (() => {
    try { return new URL(uri).hostname.replace('www.', ''); } catch { return uri.slice(0, 20); }
  })();
  if (cred === 'high') return (
    <span title="Weryfikowane źródło" className="flex items-center gap-1 text-green-400">
      <span>✅</span>
      <span>{domain.split('.')[0]}</span>
    </span>
  );
  if (cred === 'medium') return (
    <span title="Średnia wiarygodność" className="flex items-center gap-1 text-amber-400">
      <span>⚠️</span>
      <span>{domain.split('.')[0]}</span>
    </span>
  );
  return (
    <span title="Źródło niezweryfikowane" className="flex items-center gap-1 text-slate-500">
      <span>❓</span>
      <span>{domain.split('.')[0]}</span>
    </span>
  );
}

const getSeverityColor = (sev: string) => {
  switch (sev) {
    case 'high': return 'bg-red-500/20 text-red-400 border-red-500/50';
    case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
    default: return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'ANOMALY': return '🚨';
    case 'INFLUENCER': return '🐦';
    case 'NEWS': return '📰';
    case 'THESIS': return '🧠';
    case 'MACRO': return '🌍';
    default: return 'ℹ️';
  }
};

export const SignalItem: React.FC<SignalItemProps> = ({ signal }) => {
  const isThesis = signal.type === 'THESIS';
  const isLive = signal.phase === 'deep';
  const relTime = getRelativeTime(signal.timestamp instanceof Date ? signal.timestamp : new Date(signal.timestamp));

  return (
    <div
      className={`p-5 border rounded-2xl transition-all ${
        isThesis
          ? 'bg-indigo-900/20 border-indigo-500/30'
          : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
      }`}
    >
      {/* Top row */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getTypeIcon(signal.type)}</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold ${getSeverityColor(signal.severity)}`}
          >
            {isThesis ? 'STRATEGIA DŁUGOTERMINOWA' : signal.severity}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 text-[9px] font-black text-green-400 uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-400 font-mono">{relTime}</span>
        </div>
      </div>

      {/* Title + summary */}
      <h4 className="font-bold text-slate-100 text-lg mb-2 leading-tight">{signal.title}</h4>
      <p className="text-sm text-slate-300 leading-relaxed mb-4">{signal.summary}</p>

      {/* IKE perspective */}
      {signal.longTermImpact && (
        <div className="mb-4 p-4 bg-blue-500/10 border-l-4 border-blue-500 rounded-r-xl">
          <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">
            Perspektywa IKE:
          </h5>
          <p className="text-xs text-blue-100 italic leading-relaxed">{signal.longTermImpact}</p>
        </div>
      )}

      {/* Sources with credibility badges */}
      {signal.sources && signal.sources.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-700/50">
          {signal.sources.slice(0, 5).map((source, idx) => (
            <a
              key={idx}
              href={source.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-bold text-slate-400 hover:text-blue-400 flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-700/50 transition-colors"
            >
              {getCredibilityBadge(source.uri)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
