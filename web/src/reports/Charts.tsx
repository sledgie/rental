import type { ChartSpec } from "./lib/types";
import { formatMoney } from "./lib/utils/currency";

const FALLBACK = "var(--accent)";

export function ReportCharts({ charts, onSelect }: { charts?: ChartSpec[]; onSelect?: (label: string) => void }) {
  if (!charts?.length) return null;
  return (
    <div className="fr-charts no-print">
      {charts.map((chart) => (
        <div className="fr-chart" key={chart.id}>
          <h4>{chart.title}</h4>
          {chart.data.every((d) => d.value === 0) ? (
            <p className="fr-empty">No chart data for the current filters.</p>
          ) : chart.type === "pie" ? (
            <PieChart data={chart.data} />
          ) : (
            <BarChart data={chart.data} onSelect={onSelect} line={chart.type === "line"} />
          )}
        </div>
      ))}
    </div>
  );
}

function BarChart({ data, onSelect, line }: { data: ChartSpec["data"]; onSelect?: (label: string) => void; line?: boolean }) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const w = 360;
  const h = 140;
  const gap = 8;
  const barW = Math.max(10, (w - gap * (data.length + 1)) / data.length);
  const points = data.map((d, i) => `${gap + i * (barW + gap) + barW / 2},${h - 18 - (Math.abs(d.value) / max) * (h - 36)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Chart">
      {data.map((d, i) => {
        const bh = (Math.abs(d.value) / max) * (h - 36);
        const x = gap + i * (barW + gap);
        return (
          <g key={d.label} onClick={() => onSelect?.(d.label)} style={{ cursor: onSelect ? "pointer" : "default" }}>
            {!line && <rect x={x} y={h - 18 - bh} width={barW} height={bh} rx="3" fill={d.color ?? FALLBACK} />}
            <text x={x + barW / 2} y={h - 4} textAnchor="middle" fontSize="8">{d.label}</text>
          </g>
        );
      })}
      {line && <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={points.join(" ")} />}
    </svg>
  );
}

function PieChart({ data }: { data: ChartSpec["data"] }) {
  const total = data.reduce((a, b) => a + Math.abs(b.value), 0) || 1;
  let angle = -Math.PI / 2;
  const cx = 70;
  const cy = 70;
  const r = 56;
  return (
    <div className="fr-pie">
      <svg viewBox="0 0 140 140" role="img" aria-label="Pie chart">
        {data.map((d) => {
          const slice = (Math.abs(d.value) / total) * Math.PI * 2;
          const x1 = cx + r * Math.cos(angle);
          const y1 = cy + r * Math.sin(angle);
          angle += slice;
          const x2 = cx + r * Math.cos(angle);
          const y2 = cy + r * Math.sin(angle);
          return <path key={d.label} d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${slice > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`} fill={d.color ?? FALLBACK} />;
        })}
      </svg>
      <ul className="fr-legend">
        {data.map((d) => (
          <li key={d.label}><i style={{ background: d.color ?? FALLBACK }} />{d.label} · {formatMoney(d.value)}</li>
        ))}
      </ul>
    </div>
  );
}
