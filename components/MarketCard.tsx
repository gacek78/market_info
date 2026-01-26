
import React from 'react';
import { ETF } from '../types';

interface MarketCardProps {
  etf: ETF;
  isActive: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const MarketCard: React.FC<MarketCardProps> = ({ etf, isActive, onClick, onDelete }) => {
  return (
    <div 
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all cursor-pointer group relative overflow-hidden ${
        isActive 
          ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/10' 
          : 'bg-slate-800 border-slate-700 hover:border-slate-500'
      }`}
    >
      <button 
        onClick={onDelete}
        className="absolute top-2 right-2 p-1.5 bg-red-500/10 text-red-500 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all z-20"
        title="Usuń instrument"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      <div className="flex items-center justify-between gap-2 mb-3 pr-6">
        <span className="font-bold text-base text-blue-400 whitespace-nowrap overflow-hidden text-ellipsis shrink">
          {etf.ticker}
        </span>
        <span className="text-[8px] px-1.5 py-0.5 bg-slate-900/50 rounded text-slate-500 uppercase font-black tracking-tighter shrink-0 border border-slate-700/50">
          {etf.category}
        </span>
      </div>
      
      <h3 className="text-[13px] font-bold text-slate-100 mb-1.5 break-words leading-snug">
        {etf.name}
      </h3>
      
      <p className="text-[11px] text-slate-400 break-words whitespace-normal leading-relaxed opacity-80">
        {etf.description}
      </p>
    </div>
  );
};
