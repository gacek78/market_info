
import React from 'react';
import { MarketSignal } from '../types';

interface SignalItemProps {
  signal: MarketSignal;
}

export const SignalItem: React.FC<SignalItemProps> = ({ signal }) => {
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
      default: return 'ℹ️';
    }
  };

  // Formatowanie daty i godziny
  const formattedDate = signal.timestamp.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const formattedTime = signal.timestamp.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={`p-5 border rounded-2xl mb-4 transition-all ${signal.type === 'THESIS' ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getTypeIcon(signal.type)}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold ${getSeverityColor(signal.severity)}`}>
            {signal.type === 'THESIS' ? 'STRATEGIA DŁUGOTERMINOWA' : signal.severity}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-tighter">
            {formattedDate}
          </span>
          <span className="text-xs text-slate-400 font-mono font-bold">
            {formattedTime}
          </span>
        </div>
      </div>
      
      <h4 className="font-bold text-slate-100 text-lg mb-2 leading-tight">{signal.title}</h4>
      <p className="text-sm text-slate-300 leading-relaxed mb-4">{signal.summary}</p>
      
      {signal.longTermImpact && (
        <div className="mb-4 p-4 bg-blue-500/10 border-l-4 border-blue-500 rounded-r-xl">
          <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Perspektywa IKE:</h5>
          <p className="text-xs text-blue-100 italic leading-relaxed">{signal.longTermImpact}</p>
        </div>
      )}

      {signal.sources.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-700/50">
          {signal.sources.slice(0, 5).map((source, idx) => (
            <a 
              key={idx}
              href={source.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-bold text-slate-400 hover:text-blue-400 flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-700/50 transition-colors"
            >
              <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
              {source.title.length > 30 ? source.title.substring(0, 30) + '...' : source.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
