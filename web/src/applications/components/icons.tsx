import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 16,
  height: 16,
  ...props,
});

export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconMinus = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const IconFilter = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 5h18M6 12h12M10 19h4" />
  </svg>
);
export const IconSort = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 5v14M8 19l-3-3M8 19l3-3M16 19V5M16 5l-3 3M16 5l3 3" />
  </svg>
);
export const IconChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const IconChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IconChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);
export const IconChevronUp = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 15 6-6 6 6" />
  </svg>
);
export const IconDots = (p: P) => (
  <svg {...base(p)}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconPencil = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v10m0 0 4-4m-4 4-4-4M4 18h16" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
);
export const IconArchive = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
  </svg>
);
export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V6m0 0 4 4m-4-4-4 4M4 18h16" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="m4 12.5 5 5L20 6.5" />
  </svg>
);
export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconUser = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c1.2-3.4 4-5 7.5-5s6.3 1.6 7.5 5" />
  </svg>
);
export const IconUsers = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 19.5c1-3 3.4-4.6 6.5-4.6s5.5 1.6 6.5 4.6" />
    <path d="M16 5.4a3.2 3.2 0 0 1 0 6M18 14.8c1.9.6 3.1 2 3.6 4.2" />
  </svg>
);
export const IconBuilding = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 21V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15M15 10h3a2 2 0 0 1 2 2v9M2 21h20M8 8h3M8 12h3M8 16h3" />
  </svg>
);
export const IconHome = (p: P) => (
  <svg {...base(p)}>
    <path d="m4 10 8-6 8 6v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z" />
    <path d="M10 21v-6h4v6" />
  </svg>
);
export const IconFile = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </svg>
);
export const IconChat = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 15a3 3 0 0 1-3 3H9l-5 3 1.2-3.4A3 3 0 0 1 4 15V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8Z" />
  </svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <rect x="4.5" y="10" width="15" height="10" rx="2" />
    <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
  </svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6L12 3.5ZM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
  </svg>
);
export const IconExternal = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
);
export const IconCalendar = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3.5V6M16 3.5V6" />
  </svg>
);
export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5 19 6v6c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-2.5Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
export const IconLayers = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3ZM4 12l8 4.5 8-4.5M4 16.5 12 21l8-4.5" />
  </svg>
);
export const IconRefresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 11a8 8 0 0 0-13.9-4.6L4 8.5M4 5v3.5H7.5M4 13a8 8 0 0 0 13.9 4.6L20 15.5M20 19v-3.5h-3.5" />
  </svg>
);
export const IconInfo = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const IconWarn = (p: P) => (
  <svg {...base(p)}>
    <path d="M10.6 4.3 3.3 17a1.6 1.6 0 0 0 1.4 2.4h14.6a1.6 1.6 0 0 0 1.4-2.4L13.4 4.3a1.6 1.6 0 0 0-2.8 0Z" />
    <path d="M12 9v4M12 16h.01" />
  </svg>
);
export const IconClipboard = (p: P) => (
  <svg {...base(p)}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9.5 4V3h5v1M9 10h6M9 14h6M9 18h3" />
  </svg>
);
