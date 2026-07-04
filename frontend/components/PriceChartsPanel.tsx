import React, { useEffect, useMemo, useState } from 'react';
import { ChartResponse } from '../types';
import { CHART_INSTRUMENTS, CHART_INTERVALS, XTB_FX_FEE } from '../constants';
import { getChart } from '../services/apiService';

// ─── Formatery ────────────────────────────────────────────────────────────────
const plnFmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fxFmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

function fmtDate(epochSec: number, interval: string): string {
  const d = new Date(epochSec * 1000);
  if (interval === '1d') return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Wykres liniowy (inline SVG, bez biblioteki) ──────────────────────────────
const W = 800;
const H = 300;
const PAD = { top: 16, right: 12, bottom: 28, left: 56 };

interface LineChartProps {
  values: number[];
  times: number[];
  interval: string;
  up: boolean;
}

const LineChart: React.FC<LineChartProps> = ({ values, times, interval, up }) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1; // unikamy dzielenia przez 0 (płaska seria)
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - min) / span) * innerH;

  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const stroke = up ? '#22c55e' : '#ef4444';
  const fill = up ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
  // Obszar pod linią (do delikatnego gradientu wypełnienia).
  const area = `${PAD.left},${(PAD.top + innerH).toFixed(1)} ${line} ${(PAD.left + innerW).toFixed(1)},${(PAD.top + innerH).toFixed(1)}`;

  // 4 poziome linie siatki + etykiety osi Y.
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = min + f * span;
    return { yPix: y(v), label: plnFmt.format(v) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none" role="img">
      {/* siatka pozioma */}
      {gridY.map((g, i) => (
        <g key={i}>
          <line
            x1={PAD.left} x2={W - PAD.right} y1={g.yPix} y2={g.yPix}
            stroke="#1e293b" strokeWidth={1} vectorEffect="non-scaling-stroke"
          />
          <text x={PAD.left - 8} y={g.yPix + 3} textAnchor="end" fill="#64748b" fontSize={11} fontFamily="monospace">
            {g.label}
          </text>
        </g>
      ))}

      {/* obszar + linia */}
      <polygon points={area} fill={fill} stroke="none" />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />

      {/* etykiety osi X (pierwsza / ostatnia) */}
      <text x={PAD.left} y={H - 8} textAnchor="start" fill="#64748b" fontSize={11} fontFamily="monospace">
        {fmtDate(times[0], interval)}
      </text>
      <text x={W - PAD.right} y={H - 8} textAnchor="end" fill="#64748b" fontSize={11} fontFamily="monospace">
        {fmtDate(times[times.length - 1], interval)}
      </text>
    </svg>
  );
};

// ─── Panel ────────────────────────────────────────────────────────────────────
export const PriceChartsPanel: React.FC = () => {
  const [ticker, setTicker] = useState<string>(CHART_INSTRUMENTS[0].ticker);
  const [interval, setIntervalId] = useState<string>('1d');
  const [withFee, setWithFee] = useState<boolean>(true);
  const [data, setData] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getChart(ticker, interval)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) { setData(null); setError('Nie udało się pobrać danych.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, interval]);

  const feeMult = withFee ? 1 + XTB_FX_FEE : 1;

  // Seria kosztu zakupu w PLN.
  const series = useMemo(() => {
    const pts = data?.points ?? [];
    return {
      values: pts.map((p) => p.eur * p.fx * feeMult),
      times: pts.map((p) => p.t),
      last: pts.length ? pts[pts.length - 1] : null,
    };
  }, [data, feeMult]);

  const hasData = series.values.length > 0;
  const up = hasData && series.values[series.values.length - 1] >= series.values[0];
  const lastPln = series.last ? series.last.eur * series.last.fx * feeMult : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
          <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">
            📈 Koszt zakupu (PLN)
          </h3>
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

        {/* Selektor interwału + przełącznik opłaty */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex gap-1.5">
            {CHART_INTERVALS.map((iv) => (
              <button
                key={iv.id}
                onClick={() => setIntervalId(iv.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  interval === iv.id
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={withFee}
              onChange={(e) => setWithFee(e.target.checked)}
              className="accent-blue-600 w-4 h-4"
            />
            Uwzględnij 0,5% przewalutowania XTB
          </label>
        </div>

        {/* Aktualny koszt zakupu */}
        {lastPln != null && series.last && (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2 mb-6">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                Koszt zakupu {withFee ? '(z opłatą 0,5%)' : '(bez opłaty)'}
              </span>
              <span className="text-3xl font-mono font-black text-white">{plnFmt.format(lastPln)} zł</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Cena EUR</span>
              <span className="text-lg font-mono font-bold text-slate-300">{plnFmt.format(series.last.eur)} €</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Kurs EUR/PLN</span>
              <span className="text-lg font-mono font-bold text-slate-300">{fxFmt.format(series.last.fx)}</span>
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
          <LineChart values={series.values} times={series.times} interval={interval} up={up} />
        ) : (
          <div className="text-center py-16 text-slate-500 text-sm">
            Brak danych z Yahoo — spróbuj innego interwału lub później (Xetra bywa zamknięta poza sesją).
          </div>
        )}

        {data?.asOf && (
          <p className="text-[9px] text-slate-500 font-mono pt-4">
            Ostatnia świeca: {new Date(data.asOf).toLocaleString('pl-PL')} · źródło: Yahoo Finance
          </p>
        )}
      </div>
    </div>
  );
};
