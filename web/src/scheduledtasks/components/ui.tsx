import type { ReactNode } from "react";
import { isOpen, priorityLabel, statusLabel, type Task } from "../types";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

const STATUS_TONE: Record<string, string> = {
  not_started: "bg-u-s3 text-u-ink2",
  in_progress: "bg-u-blue-soft text-u-blue",
  blocked: "bg-u-warn-soft text-u-warn",
  completed: "bg-u-ok-soft text-u-ok",
  cancelled: "bg-u-s3 text-u-muted line-through",
};
const PRIORITY_TONE: Record<string, string> = {
  low: "bg-u-s3 text-u-muted",
  normal: "bg-u-accent-soft text-u-accent",
  high: "bg-u-warn-soft text-u-warn",
  urgent: "bg-u-danger-soft text-u-danger",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold", STATUS_TONE[status] ?? STATUS_TONE.not_started)}>{statusLabel(status)}</span>;
}
export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold", PRIORITY_TONE[priority] ?? PRIORITY_TONE.normal)}>{priorityLabel(priority)}</span>;
}

export function Initials({ name, size = 24 }: { name: string; size?: number }) {
  const text = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  return <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-u-accent-soft font-semibold text-u-accent" style={{ width: size, height: size, fontSize: size * 0.4 }}>{text}</span>;
}

export function Field({ label, htmlFor, required, hint, error, children, className }: { label: string; htmlFor?: string; required?: boolean; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-semibold text-u-ink2">{label}{required ? <span className="ml-0.5 text-u-danger">*</span> : null}</label>
      {children}
      {error ? <p className="mt-1 text-[11px] text-u-danger">{error}</p> : hint ? <p className="mt-1 text-[11px] text-u-muted">{hint}</p> : null}
    </div>
  );
}

export function Empty({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      {icon ? <div className="mx-auto mb-3 flex justify-center text-u-s3">{icon}</div> : null}
      <h2 className="text-sm font-semibold text-u-ink">{title}</h2>
      {hint ? <p className="mx-auto mt-1 max-w-md text-xs text-u-muted">{hint}</p> : null}
    </div>
  );
}

export const today = () => new Date().toLocaleDateString("en-CA");
export const isOverdue = (t: Pick<Task, "dueDate" | "status">) => !!t.dueDate && t.dueDate < today() && isOpen(t.status);

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
/** The calendar date of a timestamp in the viewer's own time zone. */
export const localDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
export function timeAgo(value: string): string {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : formatDate(localDate(value));
}
export function formatDays(n: number): string {
  return n === 0 ? "on the due date" : n === 1 ? "1 day before" : `${n} days before`;
}
