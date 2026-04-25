import React from 'react';

export const SkeletonSignal: React.FC = () => (
  <div className="p-5 border border-slate-800 rounded-2xl bg-slate-900/40 animate-pulse">
    <div className="flex justify-between items-start mb-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-slate-800" />
        <div className="w-16 h-4 rounded-full bg-slate-800" />
      </div>
      <div className="w-24 h-4 rounded-full bg-slate-800" />
    </div>
    <div className="w-3/4 h-5 rounded-full bg-slate-800 mb-3" />
    <div className="w-full h-4 rounded-full bg-slate-800/60 mb-2" />
    <div className="w-5/6 h-4 rounded-full bg-slate-800/40 mb-4" />
    <div className="w-full h-12 rounded-xl bg-blue-900/10 border-l-4 border-blue-800/30" />
  </div>
);

export const SkeletonFeed: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonSignal key={i} />
    ))}
  </div>
);
