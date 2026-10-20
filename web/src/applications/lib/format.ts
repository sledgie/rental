export const currency = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);

export const currencyExact = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const isoDay = (d: Date = new Date()) => d.toISOString().slice(0, 10);

export const addDays = (days: number, from: Date = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return isoDay(d);
};

export const fileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

export const truncate = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

export const fileExt = (name: string) => {
  const i = name.lastIndexOf(".");
  return i === -1 ? "file" : name.slice(i + 1).toUpperCase();
};

export const relativeDays = (iso?: string | null) => {
  if (!iso) return "";
  const diff = Math.round(
    (new Date(`${iso.slice(0, 10)}T12:00:00`).getTime() - new Date().getTime()) / 86400000,
  );
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${Math.abs(diff)} days ago`;
};
