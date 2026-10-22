import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const Svg = ({ children, className = "h-4 w-4", ...rest }: P) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const ChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const Plus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const Search = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Svg>
);
export const X = (p: P) => (
  <Svg {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);
export const Filter = (p: P) => (
  <Svg {...p}>
    <path d="M3 5h18l-7 8v6l-4 2v-8Z" />
  </Svg>
);
export const ExpandAll = (p: P) => (
  <Svg {...p}>
    <path d="m7 9 5-5 5 5M7 15l5 5 5-5" />
  </Svg>
);
export const CollapseAll = (p: P) => (
  <Svg {...p}>
    <path d="m7 4 5 5 5-5M7 20l5-5 5 5" />
  </Svg>
);
export const Kebab = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);
export const Pencil = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14.5 6.5 3 3" />
  </Svg>
);
export const Ban = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6.2 6.2 11.6 11.6" />
  </Svg>
);
export const Power = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v8" />
    <path d="M7.5 6.8a7 7 0 1 0 9 0" />
  </Svg>
);
export const MoveIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 9V6.5A1.5 1.5 0 0 1 6.5 5H9M15 5h2.5A1.5 1.5 0 0 1 19 6.5V9M19 15v2.5a1.5 1.5 0 0 1-1.5 1.5H15M9 19H6.5A1.5 1.5 0 0 1 5 17.5V15" />
    <path d="M12 9v6M9.5 11.5 12 9l2.5 2.5" />
  </Svg>
);
export const Eye = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);
export const InsertBefore = (p: P) => (
  <Svg {...p}>
    <path d="M4 6h16" />
    <path d="M12 20v-8" />
    <path d="m8.5 15.5 3.5 3.5 3.5-3.5" />
  </Svg>
);
export const InsertAfter = (p: P) => (
  <Svg {...p}>
    <path d="M4 18h16" />
    <path d="M12 4v8" />
    <path d="M8.5 8.5 12 5l3.5 3.5" />
  </Svg>
);
export const ChildPlus = (p: P) => (
  <Svg {...p}>
    <path d="M5 4v9a3 3 0 0 0 3 3h3" />
    <circle cx="5" cy="4" r="1.4" fill="currentColor" stroke="none" />
    <path d="M14.5 16h6M17.5 13v6" />
  </Svg>
);
export const Check = (p: P) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
);
export const AlertTriangle = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5 21 19.5H3L12 4.5Z" />
    <path d="M12 10v4.2M12 17.2v.2" />
  </Svg>
);
export const Info = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 11v5.4M12 7.9v.2" />
  </Svg>
);
export const ArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M20 12H4M10 6l-6 6 6 6" />
  </Svg>
);
export const Refresh = (p: P) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 1 0-.9 4.6" />
    <path d="M20 4.5V11h-6.2" />
  </Svg>
);
export const Grip = (p: P) => (
  <Svg {...p} strokeWidth={0}>
    <circle cx="9" cy="6" r="1.5" fill="currentColor" />
    <circle cx="15" cy="6" r="1.5" fill="currentColor" />
    <circle cx="9" cy="12" r="1.5" fill="currentColor" />
    <circle cx="15" cy="12" r="1.5" fill="currentColor" />
    <circle cx="9" cy="18" r="1.5" fill="currentColor" />
    <circle cx="15" cy="18" r="1.5" fill="currentColor" />
  </Svg>
);
export const Ledger = (p: P) => (
  <Svg {...p}>
    <path d="M5 3.8h11.5A2.5 2.5 0 0 1 19 6.3v13.9H7.5A2.5 2.5 0 0 1 5 17.7Z" />
    <path d="M5 17.7h14" />
    <path d="M9 7.6h6M9 11h6" />
  </Svg>
);
export const Building = (p: P) => (
  <Svg {...p}>
    <path d="M4 20.5h16M6.5 20.5V5.2A1.7 1.7 0 0 1 8.2 3.5h5.1a1.7 1.7 0 0 1 1.7 1.7v15.3" />
    <path d="M15 9.5h2.3a1.7 1.7 0 0 1 1.7 1.7v9.3" />
    <path d="M9.3 7.4h2.4M9.3 11h2.4M9.3 14.6h2.4" />
  </Svg>
);
export const Sliders = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);
export const Keyboard = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M6 13h.01M18 13h.01M9 15.5h6" />
    <path d="M9.5 13h5" />
  </Svg>
);
export const CloudOff = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 18.5h9.8a3.7 3.7 0 0 0 1.2-7.2 5.2 5.2 0 0 0-2.4-3.4" />
    <path d="M8.9 6.6A4.6 4.6 0 0 0 6.6 11a3.8 3.8 0 0 0-.4 7.5" />
    <path d="m3.5 3.5 17 17" />
  </Svg>
);
export const CornerDownRight = (p: P) => (
  <Svg {...p}>
    <path d="M5 5v6a3 3 0 0 0 3 3h11" />
    <path d="m15.5 10.5 3.5 3.5-3.5 3.5" />
  </Svg>
);
export const Sparkle = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9-5.7-1.8L10.2 9Z" />
  </Svg>
);
