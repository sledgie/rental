import { formatCurrency } from "../lib/money";

const PALETTE = ["var(--accent)", "var(--blue)", "var(--dp-accent)", "var(--ok)", "var(--warn)", "var(--danger)", "var(--muted)", "var(--accent-strong)"];

export function BarList({
  data,
  emptyText = "No data for the selected filters.",
  asCurrency = true,
}: {
  data: { label: string; value: number; secondary?: number; hint?: string }[];
  emptyText?: string;
  asCurrency?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value + (d.secondary ?? 0)));
  if (data.length === 0 || max <= 1) {
    return <p className="muted small" style={{ margin: 0 }}>{emptyText}</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((row, i) => {
        const pct = Math.max(1, Math.round((row.value / max) * 100));
        return (
          <div key={`${row.label}-${i}`}>
            <div className="between" style={{ marginBottom: 3, fontSize: 12 }}>
              <span className="strong" style={{ fontWeight: 550 }}>{row.label}</span>
              <span className="tabular muted">
                {asCurrency ? formatCurrency(row.value) : row.value.toLocaleString("en-CA")}
                {row.hint ? <span className="small"> · {row.hint}</span> : null}
              </span>
            </div>
            <div className="bar-track" style={{ height: 8 }}>
              <div className="bar-fill" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GroupedMonthlyChart({
  labels,
  series,
}: {
  labels: string[];
  series: { name: string; color?: string; values: number[] }[];
}) {
  const width = 660;
  const height = 210;
  const padding = { top: 14, right: 8, bottom: 26, left: 46 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const maxRaw = Math.max(1, ...series.flatMap((s) => s.values));
  const step = maxRaw > 500000 ? 250000 : maxRaw > 100000 ? 50000 : maxRaw > 50000 ? 25000 : 10000;
  const max = Math.ceil(maxRaw / step) * step;
  const groupW = plotW / Math.max(1, labels.length);
  const barW = Math.max(3, (groupW - 10) / Math.max(1, series.length));
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  if (labels.length === 0) {
    return <p className="muted small" style={{ margin: 0 }}>No activity for the selected filters.</p>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Monthly chart: ${series.map((s) => s.name).join(", ")}`} style={{ width: "100%", height: "auto" }}>
        {gridLines.map((g) => {
          const y = padding.top + plotH - plotH * g;
          return (
            <g key={g}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="var(--dp-line)" strokeWidth={1} />
              <text x={padding.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--dp-muted)">
                {formatCurrency(max * g, { compact: true })}
              </text>
            </g>
          );
        })}
        {labels.map((label, li) => (
          <g key={label}>
            {series.map((s, si) => {
              const value = s.values[li] ?? 0;
              const h = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * plotH) : 0;
              const x = padding.left + li * groupW + 5 + si * barW;
              const y = padding.top + plotH - h;
              return (
                <g key={s.name}>
                  <rect x={x} y={y} width={Math.max(2, barW - 2)} height={h} rx={2} fill={s.color ?? PALETTE[si % PALETTE.length]}>
                    <title>{`${label} · ${s.name}: ${formatCurrency(value)}`}</title>
                  </rect>
                </g>
              );
            })}
            <text x={padding.left + li * groupW + groupW / 2} y={height - 8} textAnchor="middle" fontSize={9.5} fill="var(--dp-muted)">
              {label}
            </text>
          </g>
        ))}
      </svg>
      <div className="chart-legend" style={{ marginTop: 6 }}>
        {series.map((s, i) => (
          <span key={s.name}>
            <span className="legend-swatch" style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} aria-hidden />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Donut({
  data,
  centerLabel,
  centerValue,
  asCurrency = true,
}: {
  data: { label: string; value: number }[];
  centerLabel: string;
  centerValue: string;
  asCurrency?: boolean;
}) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="row" style={{ gap: 18, alignItems: "center" }}>
      <svg viewBox="0 0 140 140" width={140} height={140} role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--dp-surface3)" strokeWidth={18} />
        {total > 0 &&
          data.map((d, i) => {
            const fraction = d.value / total;
            const dash = fraction * circumference;
            const el = (
              <circle
                key={d.label}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={18}
                strokeDasharray={`${Math.max(0, dash - 2)} ${circumference - Math.max(0, dash - 2)}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              >
                <title>{`${d.label}: ${asCurrency ? formatCurrency(d.value) : d.value}`}</title>
              </circle>
            );
            offset += dash;
            return el;
          })}
        <text x="70" y="66" textAnchor="middle" fontSize="11" fill="var(--dp-muted)">{centerLabel}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--dp-ink)">{centerValue}</text>
      </svg>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {data.map((d, i) => (
          <li key={d.label} className="row" style={{ justifyContent: "space-between", gap: 8, fontSize: 12 }}>
            <span className="row" style={{ gap: 6 }}>
              <span className="legend-swatch" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden />
              {d.label}
            </span>
            <span className="tabular muted">{asCurrency ? formatCurrency(d.value) : d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ values, color = "var(--accent)" }: { values: number[]; color?: string }) {
  if (values.length === 0) return null;
  const max = Math.max(1, ...values);
  const points = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${28 - (v / max) * 26}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: 30 }} aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.8} />
    </svg>
  );
}
