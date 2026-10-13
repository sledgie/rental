// Small stroke icons (24px grid) used on the property cards.
const PATHS = {
  building: <><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" /><path d="M14 10h5a1 1 0 0 1 1 1v10" /><path d="M2 21h20" /><path d="M8 8h2M8 12h2M8 16h2M17 14h1M17 18h1" /></>,
  house: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  door: <><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" /><path d="M3 21h18" /><circle cx="15" cy="12.5" r=".8" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" /></>,
  bed: <><path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="1.6" /></>,
  bath: <><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3Z" /><path d="M6 12V6a2 2 0 0 1 3.6-1.2M7 19l-1 2M17 19l1 2" /></>,
  dollar: <><circle cx="12" cy="12" r="9" /><path d="M14.5 9.2c-.4-.9-1.4-1.4-2.5-1.4-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2.1c1.5.4 2.5.9 2.5 2.1s-1.1 2-2.5 2c-1.2 0-2.2-.6-2.6-1.5M12 6v1.8M12 16.2V18" /></>,
  pin: <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: <><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4.5M12 17.5v.1" /></>,
  pencil: <><path d="m4 20 1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1Z" /></>,
};
export function Icon({ name, size = 16, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', ...style }}>{PATHS[name]}</svg>;
}

// A stable pair of colours for a property, so each card keeps its own look.
export function propertyHues(id) {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return [h, (h + 48) % 360];
}
