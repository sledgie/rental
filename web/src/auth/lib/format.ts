import type { Invitation, Role } from "./types";

export function formatCurrency(value: number, currency = "USD", compact = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(value: string, opts?: Intl.DateTimeFormatOptions): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", opts ?? { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function relativeTime(value: string): string {
  const date = new Date(value).getTime();
  const diff = Date.now() - date;
  const minutes = Math.round(diff / 60000);
  if (Number.isNaN(date)) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return formatDate(value, { month: "short", day: "numeric" });
}

export function daysUntil(value: string): number {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

export function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function passwordIsStrong(password: string): boolean {
  return Object.values(passwordChecks(password)).every(Boolean);
}

export function isManagerRole(role: Role | undefined | null): boolean {
  return role === "Owner" || role === "Administrator";
}

export function isOwner(role: Role | undefined | null): boolean {
  return role === "Owner";
}

export function invitationStatus(invitation: Invitation): Invitation["status"] {
  if (invitation.status === "pending" && new Date(invitation.expiresAt).getTime() < Date.now()) {
    return "expired";
  }
  return invitation.status;
}

export const roleDescriptions: Record<Role, string> = {
  Owner: "Full access, including billing and ownership transfer.",
  Administrator: "Manage members, settings, and day-to-day operations.",
  "Property Manager": "Manage properties, units, tenants, and leases.",
  Accountant: "Access accounting, rent collection, and reports.",
  "Maintenance Staff": "View assigned work orders and maintenance requests.",
  "Read-Only / Auditor": "View records and reports without making changes.",
};

export const ASSIGNABLE_ROLES: Role[] = [
  "Administrator",
  "Property Manager",
  "Accountant",
  "Maintenance Staff",
  "Read-Only / Auditor",
];

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}

export function orgGradient(seed: string): string {
  const palettes = [
    "from-u-accent to-u-accent",
    "from-u-blue to-u-accent",
    "from-u-violet to-u-accent",
    "from-u-ok to-u-blue",
    "from-u-warn to-u-warn",
    "from-u-danger to-u-danger",
  ];
  const index = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return palettes[index];
}

export function orgMonogram(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
