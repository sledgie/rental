// The host app is always dark and owns the colours, so this stays a constant. Chart colours follow the app palette.
export type Tone = "indigo" | "emerald" | "amber" | "rose" | "slate";

export type ChartPalette = {
  track: string;
  tone: Record<Tone, { stroke: string; fill: string; from: string; to: string }>;
};

const PALETTE: ChartPalette = {
  track: "var(--chart-track)",
  tone: {
    indigo: { stroke: "#5ecba2", fill: "rgba(94,203,162,0.22)", from: "#3f9c80", to: "#5ecba2" },
    emerald: { stroke: "#84a690", fill: "rgba(132,166,144,0.20)", from: "#6f927b", to: "#84a690" },
    amber: { stroke: "#dfb269", fill: "rgba(223,178,105,0.22)", from: "#c79a4a", to: "#dfb269" },
    rose: { stroke: "#f3907f", fill: "rgba(243,144,127,0.22)", from: "#d4766a", to: "#f3907f" },
    slate: { stroke: "#a1a1aa", fill: "rgba(161,161,170,0.18)", from: "#71717a", to: "#a1a1aa" },
  },
};

export const useTheme = () => ({ theme: "dark" as const, dark: true });
export const useChartPalette = (): ChartPalette => PALETTE;
