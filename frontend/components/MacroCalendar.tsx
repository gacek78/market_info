import React from 'react';
import { EconomicEvent } from '../types';

/**
 * Kalendarz makro — nadchodzące wydarzenia (decyzje RPP/Fed, publikacje CPI itd.)
 * zebrane przez fazę Deep. Backend gwarantuje tylko daty przyszłe, posortowane.
 */

const IMPACT_CLS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/50',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
};

const REGION_FLAG: Record<string, string> = { PL: '🇵🇱', USA: '🇺🇸', EU: '🇪🇺' };

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

/** "dziś" / "jutro" / "za N dni" — szybka orientacja, jak blisko wydarzenie. */
function relDays(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000,
  );
  if (diff <= 0) return 'dziś';
  if (diff === 1) return 'jutro';
  return `za ${diff} dni`;
}

export const MacroCalendar: React.FC<{ events: EconomicEvent[] }> = ({ events }) => {
  if (events.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
          <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">
            📅 Nadchodzące wydarzenia
          </h3>
        </div>

        <div className="space-y-2">
          {events.map((ev, i) => (
            <div
              key={`${ev.date}-${i}`}
              className="flex flex-wrap items-center gap-3 p-3 bg-slate-800/30 border border-slate-700/40 rounded-xl"
            >
              <span className="font-mono font-bold text-sm text-white whitespace-nowrap min-w-[6.5rem]">
                {fmtDate(ev.date)}
              </span>
              <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap min-w-[3.5rem]">
                {relDays(ev.date)}
              </span>
              <span className="text-base" title={ev.region}>
                {REGION_FLAG[ev.region] ?? '🌐'}
              </span>
              <span className="text-sm text-slate-200 flex-1 min-w-[10rem]">{ev.event}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase whitespace-nowrap ${
                  IMPACT_CLS[ev.impact] ?? IMPACT_CLS.low
                }`}
              >
                {ev.impact}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-500 font-mono pt-4">
          Daty ustalone przez AI (Google Search) podczas ostatniej głębokiej analizy — zweryfikuj przed ważną decyzją.
        </p>
      </div>
    </div>
  );
};
