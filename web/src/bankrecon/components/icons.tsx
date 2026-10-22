import React from "react";

const PATHS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  buildings: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M15 21V9h2a2 2 0 0 1 2 2v10" />
      <path d="M8 7h2M8 11h2M8 15h2" />
    </>
  ),
  ledger: (
    <>
      <path d="M4 4h12a2 2 0 0 1 2 2v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M18 7h2v13a1 1 0 0 1-1 1" />
      <path d="M8 8h5M8 12h5M8 16h3" />
    </>
  ),
  bank: (
    <>
      <path d="M3 9l9-6 9 6" />
      <path d="M4 9v9M9 9v9M15 9v9M20 9v9" />
      <path d="M2 20h20" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8" />
      <path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 19" />
    </>
  ),
  check: <path d="M4 12.5l5 5L20 6.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M4 16v2.5a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18.5V16" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12" />
      <path d="M8 12l4 4 4-4" />
      <path d="M4 17v2.5a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19.5V17" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V4h10v5" />
      <path d="M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="7" y="14" width="10" height="6" rx="1" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5L21 19H3l9-15.5Z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17h.01" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.7 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3 8" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  report: (
    <>
      <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L3 9" />
      <path d="M3 3v6h6" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L21 15" />
      <path d="M21 21v-6h-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7.5-1.9" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </>
  ),
  play: <path d="M8 5.5l11 6.5-11 6.5v-13Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 2.5v5.5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V5.5L12 3Z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  scale: (
    <>
      <path d="M12 3v18" />
      <path d="M7 21h10" />
      <path d="M4 8h16" />
      <path d="M4 8l-2.2 5.5a2.5 2.5 0 0 0 4.4 0L4 8Z" />
      <path d="M20 8l-2.2 5.5a2.5 2.5 0 0 0 4.4 0L20 8Z" />
      <path d="M10 5.5L7.8 8M14 5.5l2.2 2.5" />
    </>
  ),
};

export function Icon({
  name,
  className = "w-4 h-4",
  strokeWidth = 1.8,
}: {
  name: keyof typeof PATHS | string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}
