import React, { useState } from 'react';
import { PortfolioSummary as PortfolioSummaryType, PortfolioStance } from '../types';

interface PortfolioSummaryProps {
  summary: PortfolioSummaryType | null;
  strategy: string;
  loading: boolean;
  onGenerate: () => void;
  onSaveStrategy: (strategy: string) => void;
}

const OVERALL: Record<string, { label: string; cls: string }> = {
  BULLISH: { label: '📈 Sprzyjająco', cls: 'bg-green-600/20 text-green-400 border-green-500/30' },
  NEUTRAL: { label: '➖ Neutralnie', cls: 'bg-slate-600/20 text-slate-300 border-slate-500/30' },
  BEARISH: { label: '📉 Ostrożnie', cls: 'bg-red-600/20 text-red-400 border-red-500/30' },
};

const STANCE: Record<PortfolioStance, { label: string; cls: string }> = {
  ACCUMULATE: { label: 'Dokupuj', cls: 'bg-green-600/20 text-green-400 border-green-500/30' },
  HOLD: { label: 'Trzymaj', cls: 'bg-blue-600/20 text-blue-300 border-blue-500/30' },
  WATCH: { label: 'Obserwuj', cls: 'bg-amber-600/20 text-amber-400 border-amber-500/30' },
  REDUCE: { label: 'Redukuj', cls: 'bg-red-600/20 text-red-400 border-red-500/30' },
};

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  summary,
  strategy,
  loading,
  onGenerate,
  onSaveStrategy,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(strategy);

  // Synchronizuj draft, gdy strategia dojdzie z backendu po renderze.
  React.useEffect(() => setDraft(strategy), [strategy]);

  const overall = summary ? OVERALL[summary.overall] ?? OVERALL.NEUTRAL : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
            <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">
              🧭 Podsumowanie dla mnie
            </h3>
            {overall && (
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase ${overall.cls}`}>
                {overall.label}
              </span>
            )}
          </div>
          <button
            onClick={onGenerate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-[10px] whitespace-nowrap"
          >
            {loading ? 'Generuję...' : 'Generuj'}
          </button>
        </div>

        {/* Strategia (edytowalna) */}
        <div className="mb-6 p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Twoja strategia
            </span>
            <button
              onClick={() => {
                if (editing) onSaveStrategy(draft);
                setEditing(!editing);
              }}
              className="text-[10px] font-bold text-blue-400 hover:text-white transition-colors uppercase"
            >
              {editing ? 'Zapisz' : 'Edytuj'}
            </button>
          </div>
          {editing ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:border-blue-500 outline-none resize-y"
              placeholder="np. buy-and-hold 15 lat, akumulacja, IKE, ostrożnie z tech..."
            />
          ) : (
            <p className="text-xs text-slate-400 italic leading-relaxed">
              {strategy || 'Brak opisu strategii — kliknij „Edytuj", aby dopasować rekomendacje.'}
            </p>
          )}
        </div>

        {/* Treść podsumowania */}
        {loading ? (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-blue-300 font-bold">
              Analizuję wszystkie aktywa i składam podsumowanie...
            </p>
          </div>
        ) : summary ? (
          <div className="space-y-5">
            {summary.headline && (
              <p className="text-base font-bold text-white leading-snug">{summary.headline}</p>
            )}
            {summary.narrative && (
              <p className="text-sm text-slate-300 leading-relaxed">{summary.narrative}</p>
            )}

            {/* Per aktyw */}
            {summary.perAsset.length > 0 && (
              <div className="space-y-2">
                {summary.perAsset.map((a, i) => {
                  const st = STANCE[a.stance] ?? STANCE.HOLD;
                  return (
                    <div
                      key={`${a.ticker}-${i}`}
                      className="flex items-start gap-3 p-3 bg-slate-800/30 border border-slate-700/40 rounded-xl"
                    >
                      <span className="font-mono font-bold text-xs text-white whitespace-nowrap min-w-[5rem]">
                        {a.ticker}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase whitespace-nowrap ${st.cls}`}>
                        {st.label}
                      </span>
                      <span className="text-xs text-slate-400 leading-relaxed">{a.note}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Nadchodzące wydarzenia — czego się spodziewać po wynikach */}
            {summary.upcoming && summary.upcoming.length > 0 && (
              <div className="p-4 bg-slate-800/30 border border-slate-700/40 rounded-2xl">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-3">
                  📅 Nadchodzące wydarzenia — czego się spodziewać
                </span>
                <div className="space-y-3">
                  {summary.upcoming.map((u, i) => (
                    <div key={`${u.date}-${i}`} className="flex gap-3 items-start">
                      <span className="font-mono font-bold text-xs text-white whitespace-nowrap min-w-[5.5rem] pt-0.5">
                        {u.date}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-slate-200 mb-0.5">{u.event}</div>
                        <div className="text-xs text-slate-400 leading-relaxed">{u.expectation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sugestie działań */}
            {summary.actions.length > 0 && (
              <div className="p-4 bg-blue-900/15 border border-blue-500/20 rounded-2xl">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">
                  Sugestie
                </span>
                <ul className="space-y-1.5">
                  {summary.actions.map((act, i) => (
                    <li key={i} className="text-xs text-slate-300 flex gap-2">
                      <span className="text-blue-400 flex-shrink-0">→</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[9px] text-slate-500 font-mono pt-1">
              Wygenerowano: {summary.timestamp.toLocaleString('pl-PL')}
            </p>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm">
            Brak podsumowania. Kliknij „Generuj", aby przeanalizować wszystkie śledzone aktywa
            pod kątem Twojej strategii.
          </div>
        )}
      </div>
    </div>
  );
};
