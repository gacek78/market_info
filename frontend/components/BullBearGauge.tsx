import React from 'react';

interface BullBearGaugeProps {
  sentiment: number; // 0-100, "Byki (Greed)"
  risk: number; // 0-100, "Niedźwiedzie (Fear)"
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Kąt 0° = góra (12:00), rośnie zgodnie z ruchem wskazówek zegara — czytelniejsze niż
// standardowy układ SVG (0° = prawa strona) przy budowaniu półokręgu miernika.
const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

const STATUS = [
  { max: 20, label: 'Silnie niedźwiedzi (Fear)', cls: 'bg-red-600/20 text-red-400 border-red-500/30' },
  { max: 40, label: 'Niedźwiedzi', cls: 'bg-red-600/20 text-red-400 border-red-500/30' },
  { max: 60, label: 'Neutralnie', cls: 'bg-amber-600/20 text-amber-400 border-amber-500/30' },
  { max: 80, label: 'Byczo', cls: 'bg-green-600/20 text-green-400 border-green-500/30' },
  { max: 101, label: 'Silnie byczo (Greed)', cls: 'bg-green-600/20 text-green-400 border-green-500/30' },
];

export const BullBearGauge: React.FC<BullBearGaugeProps> = ({ sentiment, risk }) => {
  const s = clamp(sentiment ?? 50, 0, 100);
  const r = clamp(risk ?? 50, 0, 100);
  // Byki (Greed) vs Niedźwiedzie (Fear) sprowadzone do jednej osi: 0 = pełny niedźwiedź, 100 = pełny byk.
  const score = clamp((s - r + 100) / 2, 0, 100);
  const needleAngle = -90 + (score / 100) * 180;
  const status = STATUS.find((b) => score < b.max) ?? STATUS[STATUS.length - 1];

  const cx = 120;
  const cy = 120;
  const trackR = 100;
  const needleR = 84;
  const tip = polarToCartesian(cx, cy, needleR, needleAngle);

  return (
    <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
          <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
            BullBearGauge — Radar Sentymentu
          </h4>
        </div>
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase ${status.cls}`}>
          {status.label}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <svg viewBox="0 0 240 145" className="w-full max-w-md">
          {/* Tor: niedźwiedzie (czerwień) → neutralnie (bursztyn) → byki (zieleń) */}
          <path d={describeArc(cx, cy, trackR, -90, -30)} stroke="#ef4444" strokeWidth={16} fill="none" strokeLinecap="round" />
          <path d={describeArc(cx, cy, trackR, -30, 30)} stroke="#f59e0b" strokeWidth={16} fill="none" />
          <path d={describeArc(cx, cy, trackR, 30, 90)} stroke="#22c55e" strokeWidth={16} fill="none" strokeLinecap="round" />

          {/* Wskazówka */}
          <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke="#e2e8f0" strokeWidth={3} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={7} fill="#e2e8f0" stroke="#020617" strokeWidth={2} />

          {/* Etykiety końców skali */}
          <text x={20} y={135} className="fill-slate-500" fontSize={9} fontWeight={700} textAnchor="start">NIEDŹWIEDZIE</text>
          <text x={220} y={135} className="fill-slate-500" fontSize={9} fontWeight={700} textAnchor="end">BYKI</text>
        </svg>

        <div className="text-4xl font-black text-white -mt-4 mb-1">{Math.round(score)}</div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Wynik łączny (0–100)</div>

        <div className="grid grid-cols-2 gap-6 w-full max-w-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
            <div>
              <div className="text-[9px] text-slate-500 font-bold uppercase">Byki (Greed)</div>
              <div className="text-sm font-mono font-bold text-slate-200">{s}%</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            <div>
              <div className="text-[9px] text-slate-500 font-bold uppercase">Niedźwiedzie (Fear)</div>
              <div className="text-sm font-mono font-bold text-slate-200">{r}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
