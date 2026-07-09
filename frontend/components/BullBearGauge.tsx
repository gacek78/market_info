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

export const BullBearGauge: React.FC<BullBearGaugeProps> = ({ sentiment, risk }) => {
  const s = clamp(sentiment ?? 50, 0, 100);
  const r = clamp(risk ?? 50, 0, 100);
  // Byki (Greed) vs Niedźwiedzie (Fear) sprowadzone do jednej osi: 0 = pełny niedźwiedź, 100 = pełny byk.
  const score = clamp((s - r + 100) / 2, 0, 100);
  const needleAngle = -90 + (score / 100) * 180;

  const cx = 120;
  const cy = 120;
  const trackR = 100;
  const needleR = 84;
  const tip = polarToCartesian(cx, cy, needleR, needleAngle);

  return (
    <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 240 155" className="w-full">
          {/* Tor: niedźwiedzie (czerwień) → neutralnie (bursztyn) → byki (zieleń) */}
          <path d={describeArc(cx, cy, trackR, -90, -30)} stroke="#ef4444" strokeWidth={16} fill="none" strokeLinecap="round" />
          <path d={describeArc(cx, cy, trackR, -30, 30)} stroke="#f59e0b" strokeWidth={16} fill="none" />
          <path d={describeArc(cx, cy, trackR, 30, 90)} stroke="#22c55e" strokeWidth={16} fill="none" strokeLinecap="round" />

          {/* Wskazówka */}
          <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke="#e2e8f0" strokeWidth={3} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={7} fill="#e2e8f0" stroke="#020617" strokeWidth={2} />

          {/* Etykiety końców skali */}
          <text x={20} y={148} className="fill-slate-500" fontSize={9} fontWeight={700} textAnchor="start">NIEDŹWIEDZIE</text>
          <text x={220} y={148} className="fill-slate-500" fontSize={9} fontWeight={700} textAnchor="end">BYKI</text>
        </svg>

        <div className="text-2xl font-black text-white -mt-3">{Math.round(score)}</div>
      </div>
    </div>
  );
};
