/** A binder that fills with blue from the bottom as the month's invoices come in. Replaces the old round stamp. */
export default function Binder({ pct, label = "בתיק", w = 64, h = 92, className }: { pct: number; label?: string; w?: number; h?: number; className?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const inner = h - 8;
  const fill = Math.round((p / 100) * inner);
  const done = p === 100;
  const id = `bd${w}${h}${p}`;
  return (
    <svg className={className} width={w} height={h + 20} viewBox={`0 0 ${w} ${h + 20}`} role="img" aria-label={`${p} אחוז ${label}`}>
      <defs>
        <clipPath id={id}>
          <rect x="4" y="4" width={w - 8} height={inner} rx="5" />
        </clipPath>
      </defs>
      <rect x="2" y="2" width={w - 4} height={h - 4} rx="7" fill="#fff" stroke="#12163f" strokeWidth="3" />
      <rect x="0" y={4 + inner - fill} width={w} height={fill} fill="#2e3fe0" clipPath={`url(#${id})`} />
      <rect x={w / 2 - 12} y="12" width="24" height="16" rx="3" fill="#fff" stroke="#12163f" strokeWidth="2" />
      <circle cx={w / 2} cy={h - 22} r="6" fill="#eef0f8" stroke="#12163f" strokeWidth="2" />
      <text x={w / 2} y={h / 2 + 8} textAnchor="middle" fontSize={done ? 24 : 18} fontWeight="600" fill={p >= 55 ? "#fff" : "#12163f"} style={{ fontFamily: "var(--f-head)" }}>
        {done ? "✓" : `${p}%`}
      </text>
      <text x={w / 2} y={h + 16} textAnchor="middle" fontSize="13" fontWeight="600" fill="#12163f" style={{ fontFamily: "var(--f-head)" }}>
        {label}
      </text>
    </svg>
  );
}
