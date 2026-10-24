// Decorative neighbourhood skyline (houses, apartment blocks, trees) drawn as inline SVG, used behind the sign-in screens.
// "light" tints it with forest green for the ivory page; "dark" uses translucent white for the evergreen brand panel.
type Tone = "light" | "dark";

const W = 1600;
const H = 340;

// [x, width, height] of the distant towers
const BACK: [number, number, number][] = [
  [0, 90, 150], [100, 70, 205], [180, 110, 130], [300, 80, 245], [390, 100, 170], [500, 70, 215], [580, 120, 140], [710, 90, 265],
  [810, 80, 180], [900, 110, 150], [1020, 70, 235], [1100, 100, 170], [1210, 80, 205], [1300, 110, 140], [1420, 90, 225], [1520, 80, 160],
];
// [kind, x, width, height] of the nearer buildings
const FRONT: ["house" | "block", number, number, number][] = [
  ["house", 10, 130, 70], ["block", 160, 96, 150], ["house", 280, 120, 80], ["house", 420, 110, 64], ["block", 550, 110, 190],
  ["house", 685, 130, 76], ["block", 840, 90, 130], ["house", 950, 120, 72], ["block", 1090, 104, 170], ["house", 1220, 130, 82],
  ["block", 1370, 92, 140], ["house", 1480, 112, 68],
];
const TREES: [number, number][] = [[148, 34], [262, 28], [408, 30], [533, 26], [668, 32], [826, 28], [938, 30], [1074, 26], [1206, 34], [1356, 28], [1466, 30]];

export function Skyline({ tone = "light", className }: { tone?: Tone; className?: string }) {
  const dark = tone === "dark";
  const back = dark ? "rgba(255,255,255,0.045)" : "rgba(29,102,80,0.07)";
  const front = dark ? "rgba(255,255,255,0.085)" : "rgba(18,61,50,0.12)";
  const ground = dark ? "rgba(255,255,255,0.12)" : "rgba(18,61,50,0.2)";
  const tree = dark ? "rgba(158,214,191,0.14)" : "rgba(29,102,80,0.16)";
  const pane = dark ? "rgba(255,255,255,0.14)" : "rgba(248,247,242,0.85)";
  const lit = dark ? "rgba(236,190,110,0.55)" : "rgba(200,138,50,0.65)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" className={className} aria-hidden="true" focusable="false">
      <g fill={back}>
        {BACK.map(([x, w, h]) => (
          <rect key={x} x={x} y={H - h} width={w} height={h} />
        ))}
      </g>
      <g>
        {TREES.map(([x, r]) => (
          <g key={x}>
            <rect x={x - 2} y={H - 22} width={4} height={22} fill={tree} />
            <circle cx={x} cy={H - 26 - r * 0.6} r={r * 0.75} fill={tree} />
          </g>
        ))}
      </g>
      <g>
        {FRONT.map(([kind, x, w, h]) => {
          if (kind === "house") {
            const top = H - h;
            return (
              <g key={x}>
                <rect x={x} y={top} width={w} height={h} fill={front} />
                <polygon points={`${x - 8},${top + 2} ${x + w / 2},${top - 44} ${x + w + 8},${top + 2}`} fill={front} />
                <rect x={x + w * 0.72} y={top - 40} width={9} height={26} fill={front} />
                <rect x={x + 16} y={top + 16} width={22} height={20} fill={(x * 3) % 2 ? lit : pane} />
                <rect x={x + w - 38} y={top + 16} width={22} height={20} fill={pane} />
                <rect x={x + w / 2 - 9} y={top + h - 34} width={18} height={34} fill={pane} />
              </g>
            );
          }
          const top = H - h;
          const cols = Math.floor((w - 16) / 18);
          const rows = Math.floor((h - 18) / 24);
          return (
            <g key={x}>
              <rect x={x} y={top} width={w} height={h} fill={front} />
              <rect x={x - 4} y={top - 6} width={w + 8} height={6} fill={front} />
              {Array.from({ length: rows * cols }, (_, i) => {
                const r = Math.floor(i / cols);
                const c = i % cols;
                return <rect key={i} x={x + 10 + c * 18} y={top + 14 + r * 24} width={9} height={13} fill={(i * 7 + x) % 6 === 0 ? lit : pane} />;
              })}
            </g>
          );
        })}
      </g>
      <rect x="0" y={H - 6} width={W} height="6" fill={ground} />
    </svg>
  );
}
