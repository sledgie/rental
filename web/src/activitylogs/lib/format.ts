export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function formatRelativeTime(value: string | Date) {
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60 * 60 * 1000) return formatter.format(Math.round(diff / 60000), "minute");
  if (abs < 24 * 60 * 60 * 1000) return formatter.format(Math.round(diff / 3600000), "hour");
  return formatter.format(Math.round(diff / 86400000), "day");
}

export function money(value: number | string, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value));
}

export function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}
