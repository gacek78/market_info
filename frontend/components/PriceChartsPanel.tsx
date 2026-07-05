import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChartResponse } from '../types';
import { CHART_INSTRUMENTS, CHART_INTERVALS, CHART_RANGES, XTB_FX_FEE } from '../constants';
import { getChart } from '../services/apiService';

// ─── Formatery ────────────────────────────────────────────────────────────────
const plnFmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fxFmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

function fmtAxis(epochSec: number, interval: string): string {
  const d = new Date(epochSec * 1000);
  if (interval === '1d') return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtFull(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

interface Row { t: number; pln: number; eur: number; fx: number }

// ─── Wykres liniowy interaktywny (inline SVG, bez biblioteki) ─────────────────
const W = 800;
const H = 300;
// Czcionka osi w jednostkach viewBox — SVG skaluje się do szerokości kontenera,
// więc realny rozmiar = AXIS_FONT × (szerokość_kontenera / 800).
const AXIS_FONT = 15;
const PAD = { top: 16, right: 12, bottom: 34, left: 74 };

const LineChart: React.FC<{ rows: Row[]; interval: string; up: boolean }> = ({ rows, interval, up }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const values = rows.map((r) => r.pln);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - min) / span) * innerH;

  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const stroke = up ? '#22c55e' : '#ef4444';
  const fill = up ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
  const area = `${PAD.left},${(PAD.top + innerH).toFixed(1)} ${line} ${(PAD.left + innerW).toFixed(1)},${(PAD.top + innerH).toFixed(1)}`;

  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = min + f * span;
    return { yPix: y(v), label: plnFmt.format(v) };
  });

  // Mapowanie kursora → najbliższy indeks danych. SVG skaluje się jednorodnie
  // (viewBox 800×300, h-auto), więc skala pozioma = szerokość_kontenera / 800.
  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el || rows.length === 0) return;
    const rect = el.getBoundingClientRect();
    const scale = rect.width / W;
    const plotLeft = rect.left + PAD.left * scale;
    const plotW = innerW * scale;
    const frac = Math.min(1, Math.max(0, (e.clientX - plotLeft) / plotW));
    setHover(Math.round(frac * (rows.length - 1)));
  };

  const hi = hover != null ? Math.min(hover, rows.length - 1) : null;
  const hRow = hi != null ? rows[hi] : null;

  return (
    <div ref={wrapRef} className="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img">
        {/* siatka pozioma + oś Y */}
        {gridY.map((g, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={g.yPix} y2={g.yPix} stroke="#1e293b" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={PAD.left - 8} y={g.yPix + 5} textAnchor="end" fill="#94a3b8" fontSize={AXIS_FONT} fontFamily="monospace">{g.label}</text>
          </g>
        ))}

        {/* obszar + linia */}
        <polygon points={area} fill={fill} stroke="none" />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />

        {/* oś X (pierwsza / ostatnia) */}
        <text x={PAD.left} y={H - 8} textAnchor="start" fill="#94a3b8" fontSize={AXIS_FONT} fontFamily="monospace">{fmtAxis(rows[0].t, interval)}</text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" fill="#94a3b8" fontSize={AXIS_FONT} fontFamily="monospace">{fmtAxis(rows[rows.length - 1].t, interval)}</text>

        {/* crosshair */}
        {hi != null && hRow && (
          <g>
            <line x1={x(hi)} x2={x(hi)} y1={PAD.top} y2={PAD.top + innerH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hi)} cy={y(hRow.pln)} r={4} fill={stroke} stroke="#0f172a" strokeWidth={2} />
          </g>
        )}
      </svg>

      {/* tooltip (pozycjonowany procentowo — SVG skaluje się jednorodnie) */}
      {hi != null && hRow && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full bg-slate-950/95 border border-slate-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap"
          style={{ left: `${(x(hi) / W) * 100}%`, top: `${(y(hRow.pln) / H) * 100}%`, marginTop: '-10px' }}
        >
          <div className="text-xs text-slate-400 font-mono mb-0.5">{fmtFull(hRow.t)}</div>
          <div className="text-base font-mono font-bold text-white">{plnFmt.format(hRow.pln)} zł</div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">
            {plnFmt.format(hRow.eur)} € · kurs {fxFmt.format(hRow.fx)}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Panel ────────────────────────────────────────────────────────────────────
export const PriceChartsPanel: React.FC = () => {
  const [ticker, setTicker] = useState<string>(CHART_INSTRUMENTS[0].ticker);
  const [range, setRange] = useState<string>('month');
  const [interval, setIntervalId] = useState<string>('4h');
  const [withFee, setWithFee] = useState<boolean>(true);
  const [data, setData] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const rangeDef = CHART_RANGES.find((r) => r.id === range) ?? CHART_RANGES[2];

  // Zmiana zakresu: jeśli bieżąca granulacja jest niedozwolona, przełącz na domyślną.
  const selectRange = (id: string) => {
    const r = CHART_RANGES.find((x) => x.id === id);
    if (!r) return;
    setRange(id);
    if (!r.intervals.includes(interval)) setIntervalId(r.def);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getChart(ticker, interval, range)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) { setData(null); setError('Nie udało się pobrać danych.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, interval, range]);

  const feeMult = withFee ? 1 + XTB_FX_FEE : 1;

  const rows: Row[] = useMemo(
    () => (data?.points ?? []).map((p) => ({ t: p.t, eur: p.eur, fx: p.fx, pln: p.eur * p.fx * feeMult })),
    [data, feeMult]
  );

  const hasData = rows.length > 0;
  const up = hasData && rows[rows.length - 1].pln >= rows[0].pln;
  const last = hasData ? rows[rows.length - 1] : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
          <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">📈 Koszt zakupu (PLN)</h3>
        </div>

        {/* Selektor instrumentu */}
        <div className="flex flex-wrap gap-2 mb-4">
          {CHART_INSTRUMENTS.map((ins) => (
            <button
              key={ins.ticker}
              onClick={() => setTicker(ins.ticker)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                ticker === ins.ticker
                  ? 'bg-blue-600 border-blue-400 text-white'
                  : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {ins.label}
            </button>
          ))}
        </div>

        {/* Zakres czasu */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">Zakres</span>
          {CHART_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => selectRange(r.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                range === r.id
                  ? 'bg-blue-600 border-blue-400 text-white'
                  : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Granulacja (interwał) + przełącznik opłaty */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">Świeca</span>
            {CHART_INTERVALS.map((iv) => {
              const allowed = rangeDef.intervals.includes(iv.id);
              return (
                <button
                  key={iv.id}
                  onClick={() => allowed && setIntervalId(iv.id)}
                  disabled={!allowed}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                    !allowed
                      ? 'bg-slate-800/20 border-slate-800 text-slate-600 cursor-not-allowed'
                      : interval === iv.id
                      ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {iv.label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 cursor-pointer select-none">
            <input type="checkbox" checked={withFee} onChange={(e) => setWithFee(e.target.checked)} className="accent-blue-600 w-4 h-4" />
            Uwzględnij 0,5% przewalutowania XTB
          </label>
        </div>

        {/* Aktualny koszt zakupu */}
        {last && (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2 mb-6">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                Koszt zakupu {withFee ? '(z opłatą 0,5%)' : '(bez opłaty)'}
              </span>
              <span className="text-3xl font-mono font-black text-white">{plnFmt.format(last.pln)} zł</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Cena EUR</span>
              <span className="text-lg font-mono font-bold text-slate-300">{plnFmt.format(last.eur)} €</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Kurs EUR/PLN</span>
              <span className="text-lg font-mono font-bold text-slate-300">{fxFmt.format(last.fx)}</span>
            </div>
          </div>
        )}

        {/* Wykres / stany */}
        {loading ? (
          <div className="flex items-center gap-3 py-16 justify-center">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-blue-300 font-bold">Pobieram notowania z Yahoo Finance...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-400/80 text-sm">{error}</div>
        ) : hasData ? (
          <LineChart rows={rows} interval={interval} up={up} />
        ) : (
          <div className="text-center py-16 text-slate-500 text-sm">
            Brak danych z Yahoo — spróbuj innego zakresu lub później (Xetra bywa zamknięta poza sesją).
          </div>
        )}

        {data?.asOf && (
          <p className="text-[11px] text-slate-500 font-mono pt-4">
            Ostatnia świeca: {new Date(data.asOf).toLocaleString('pl-PL')} · źródło: Yahoo Finance
          </p>
        )}
      </div>
    </div>
  );
};
