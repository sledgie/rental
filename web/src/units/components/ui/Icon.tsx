import type { SVGProps } from "react";

/**
 * One consistent inline SVG icon set (1.6 stroke, 24px grid, currentColor)
 * so iconography never depends on an external package or font.
 */
const paths: Record<string, React.ReactNode> = {
  chevronRight: <polyline points="9 6 15 12 9 18" />,
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  chevronLeft: <polyline points="15 6 9 12 15 18" />,
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.65" y2="16.65" />
    </>
  ),
  filter: <polygon points="3 5 21 5 14 13.5 14 20 10 18 10 13.5 3 5" />,
  refresh: (
    <>
      <polyline points="21 4 21 10 15 10" />
      <polyline points="3 20 3 14 9 14" />
      <path d="M20.5 14a8.5 8.5 0 0 1-16.1 2.6" />
      <path d="M3.5 10A8.5 8.5 0 0 1 19.6 7.4" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <line x1="9" y1="7" x2="9" y2="7.01" />
      <line x1="15" y1="7" x2="15" y2="7.01" />
      <line x1="9" y1="11" x2="9" y2="11.01" />
      <line x1="15" y1="11" x2="15" y2="11.01" />
      <line x1="9" y1="15" x2="9" y2="15.01" />
      <line x1="15" y1="15" x2="15" y2="15.01" />
      <path d="M10 21v-3h4v3" />
    </>
  ),
  door: (
    <>
      <path d="M5 21h14" />
      <path d="M7 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17" />
      <circle cx="13.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  bed: (
    <>
      <path d="M3 18V7" />
      <path d="M3 12h18v6" />
      <path d="M21 18v-3.5a2.5 2.5 0 0 0-2.5-2.5H10V12" />
      <circle cx="6.8" cy="9.5" r="1.8" />
    </>
  ),
  bath: (
    <>
      <path d="M4 12h16v2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-2Z" />
      <path d="M6 12V6a2 2 0 0 1 3.6-1.2" />
      <line x1="7" y1="20" x2="6" y2="22" />
      <line x1="17" y1="20" x2="18" y2="22" />
    </>
  ),
  ruler: (
    <>
      <rect x="2.5" y="8" width="19" height="8" rx="1.5" />
      <line x1="7" y1="8" x2="7" y2="11" />
      <line x1="11" y1="8" x2="11" y2="12" />
      <line x1="15" y1="8" x2="15" y2="11" />
      <line x1="19" y1="8" x2="19" y2="12" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.2" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.85" />
      <path d="M16.5 4.2a3.2 3.2 0 0 1 0 6.1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  dollar: (
    <>
      <line x1="12" y1="2.5" x2="12" y2="21.5" />
      <path d="M17 6.5H9.8a3 3 0 0 0 0 6h4.4a3 3 0 0 1 0 6H7" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3" />
      <rect x="3" y="7.5" width="18" height="12" rx="2.2" />
      <circle cx="16.8" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  wrench: (
    <path d="M15.5 3.5a5.5 5.5 0 0 0-6.9 6.9L3.4 15.6a2 2 0 0 0 0 2.8l2.2 2.2a2 2 0 0 0 2.8 0l5.2-5.2a5.5 5.5 0 0 0 6.9-6.9l-3.2 3.2-3-.7-.7-3 3.2-3.2Z" />
  ),
  hammer: (
    <>
      <path d="M13.5 6.5 17 3l4 4-3.5 3.5" />
      <path d="M14.8 8.2 8 15l-3 6 6-3 6.8-6.8" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 3 14 8 19 8" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <line x1="12" y1="9" x2="12" y2="13.5" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  check: <polyline points="4 12.5 9.5 18 20 6.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8.2 12.4 11 15.2 16 9.6" />
    </>
  ),
  x: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <line x1="14.5" y1="6.5" x2="17.5" y2="9.5" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4.5" rx="1.4" />
      <path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5" />
      <line x1="10" y1="12.5" x2="14" y2="12.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.2 12S5.8 5.5 12 5.5 21.8 12 21.8 12 18.2 18.5 12 18.5 2.2 12 2.2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <line x1="20" y1="4" x2="11" y2="13" />
      <path d="M18 14.5V19a1.8 1.8 0 0 1-1.8 1.8H5A1.8 1.8 0 0 1 3.2 19V7.8A1.8 1.8 0 0 1 5 6h4.4" />
    </>
  ),
  phone: (
    <path d="M6.6 3.5h3l1.5 4-2 1.4a12.5 12.5 0 0 0 6 6l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3.6 6.5 12 13 20.4 6.5" />
    </>
  ),
  layers: (
    <>
      <polygon points="12 3 21 8 12 13 3 8 12 3" />
      <polyline points="3 12.5 12 17.5 21 12.5" />
    </>
  ),
  sort: (
    <>
      <path d="M7 4v16" />
      <polyline points="4 7.5 7 4.2 10 7.5" />
      <path d="M17 20V4" />
      <polyline points="14 16.5 17 19.8 20 16.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4" />
      <path d="M10.5 12.8 20 3.5" />
      <path d="M16.5 7l2.2 2.2" />
      <path d="M14 9.5l2.2 2.2" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 18a9 9 0 1 1 16 0" />
      <line x1="12" y1="14" x2="16" y2="9.5" />
      <circle cx="12" cy="14.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  shield: (
    <path d="M12 3 5 5.8v5.4c0 4.4 2.9 8 7 9.3 4.1-1.3 7-4.9 7-9.3V5.8L12 3Z" />
  ),
  activity: <polyline points="3 12.5 7.5 12.5 10 6 14 18 16.5 12.5 21 12.5" />,
  image: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.6" cy="10" r="1.6" />
      <polyline points="3.6 17.5 9 13 13 16.5 16 14.5 20.4 18" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </>
  ),
  list: (
    <>
      <line x1="8.5" y1="6.5" x2="20.5" y2="6.5" />
      <line x1="8.5" y1="12" x2="20.5" y2="12" />
      <line x1="8.5" y1="17.5" x2="20.5" y2="17.5" />
      <circle cx="4.4" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.4" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.4" cy="17.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  home: (
    <>
      <path d="M4 10.8 12 4l8 6.8V19a1.6 1.6 0 0 1-1.6 1.6h-3.2v-6H8.8v6H5.6A1.6 1.6 0 0 1 4 19Z" />
    </>
  ),
  sliders: (
    <>
      <line x1="5" y1="4" x2="5" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="19" y1="4" x2="19" y2="20" />
      <circle cx="5" cy="9" r="2" />
      <circle cx="12" cy="15" r="2" />
      <circle cx="19" cy="7.5" r="2" />
    </>
  ),
  spark: (
    <path d="M12 3.2l1.9 5.1 5.1 1.9-5.1 1.9L12 17.2l-1.9-5.1L5 10.2l5.1-1.9L12 3.2Z" />
  ),
  inbox: (
    <>
      <path d="M3.5 13.5 6 5.2A2 2 0 0 1 7.9 4h8.2A2 2 0 0 1 18 5.2l2.5 8.3" />
      <path d="M3.5 13.5h4l1.2 2.6h6.6l1.2-2.6h4v4.3a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2Z" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 4.5V3.6A1.6 1.6 0 0 1 10.6 2h2.8A1.6 1.6 0 0 1 15 3.6v.9" />
      <line x1="8.6" y1="11" x2="15.4" y2="11" />
      <line x1="8.6" y1="15" x2="13" y2="15" />
    </>
  ),
};

export type IconName = keyof typeof paths;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, strokeWidth = 1.6, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

/** Ledgerhouse mark — a stacked unit/building glyph used in the sidebar. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="0.6" y="0.6" width="30.8" height="30.8" rx="8" fill="var(--accent-soft)" stroke="var(--accent-strong)" />
      <path d="M8 23V11.5L16 7l8 4.5V23" stroke="var(--accent)" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12.4 23v-5.2h7.2V23" stroke="var(--ok)" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M16 7v4.2M11.2 14.6h2.2M18.6 14.6h2.2" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
