
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

  return (
    <div className={`p-5 border rounded-2xl mb-4 bg-slate-800/50 border-slate-700`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold ${getSeverityColor(signal.severity)}`}>
            {signal.type}
          </span>
        </div>
      </div>
      <h4 className="font-bold text-slate-100 text-lg mb-2 leading-tight">{signal.title}</h4>
      <p className="text-sm text-slate-300 leading-relaxed mb-4">{signal.summary}</p>
      {signal.longTermImpact && (
        <div className="mb-4 p-4 bg-blue-500/10 border-l-4 border-blue-500 rounded-r-xl">
          <p className="text-xs text-blue-100 italic">{signal.longTermImpact}</p>
        </div>
      )}
    </div>
  );
};
