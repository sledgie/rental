import { ArrowUpRight, Check, CircleAlert, Clock3, Info, ShieldAlert, XCircle } from "lucide-react";
import type { ActivityEventDTO, Outcome, Severity } from "../lib/types";
import { formatActorType } from "../lib/types";
import { initials } from "../lib/format";

export function hashFor(to: string) {
  const record = to.match(/^\/records\/([^/]+)\/([^/?#]+)$/);
  return record ? `#/activity-logs?view=record&entityType=${record[1]}&entityId=${record[2]}` : `#${to}`;
}

export function Link({ href, children, ...rest }: { href: string; children?: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return <a href={hashFor(href)} {...rest}>{children}</a>;
}

export function ResultBadge({ outcome }: { outcome: Outcome }) {
  const config = {
    success: { label: "Success", className: "bg-u-ok-soft text-u-ok ring-u-ok/15", Icon: Check },
    failure: { label: "Failure", className: "bg-u-danger-soft text-u-danger ring-u-danger/15", Icon: XCircle },
    denied: { label: "Denied", className: "bg-u-warn-soft text-u-warn ring-u-warn/15", Icon: ShieldAlert },
    pending: { label: "Pending", className: "bg-u-warn-soft text-u-warn ring-u-warn/15", Icon: Clock3 },
  }[outcome];
  const Icon = config.Icon;
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${config.className}`}><Icon size={12} strokeWidth={2.2} />{config.label}</span>;
}

export function SeverityIndicator({ severity, showLabel = false }: { severity: Severity; showLabel?: boolean }) {
  const config = {
    informational: { label: "Informational", className: "bg-u-line2", text: "text-u-muted", Icon: Info },
    warning: { label: "Warning", className: "bg-u-warn", text: "text-u-warn", Icon: CircleAlert },
    critical: { label: "Critical", className: "bg-u-danger", text: "text-u-danger", Icon: ShieldAlert },
  }[severity];
  return <span title={config.label} className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${config.text}`}><span className={`h-1.5 w-1.5 rounded-full ${config.className}`} />{showLabel && config.label}</span>;
}

export function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    "Properties & Units": "bg-u-accent-soft text-u-accent",
    "Tenants & Leases": "bg-u-violet/15 text-u-violet",
    "Accounting & Finance": "bg-u-ok-soft text-u-ok",
    "Maintenance & Repairs": "bg-u-warn-soft text-u-warn",
    "Projects & Renovations": "bg-u-blue-soft text-u-blue",
    "Documents & eSignatures": "bg-u-accent-soft text-u-accent",
    Communications: "bg-u-danger-soft text-u-danger",
    "Users & Security": "bg-u-s3 text-u-ink2",
  };
  return <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-semibold leading-4 ${colors[category] ?? "bg-u-s3 text-u-ink2"}`}>{category}</span>;
}

export function ActorAvatar({ name, actorType, size = "md" }: { name: string; actorType: string; size?: "sm" | "md" }) {
  const system = actorType !== "user";
  return <div title={`${name} · ${formatActorType(actorType)}`} className={`grid shrink-0 place-items-center rounded-full font-semibold ${size === "sm" ? "h-7 w-7 text-[9px]" : "h-8 w-8 text-[10px]"} ${system ? "bg-u-s3 text-u-ink2 ring-1 ring-u-line" : "bg-u-accent-soft text-u-accent"}`}>{system ? <ActivityTypeIcon type={actorType} /> : initials(name)}</div>;
}

function ActivityTypeIcon({ type }: { type: string }) {
  if (type === "integration") return <ArrowUpRight size={13} />;
  if (type === "scheduled_job") return <Clock3 size={13} />;
  return <ActivityGlyph />;
}
function ActivityGlyph() { return <span className="text-[12px] font-bold">S</span>; }

export function recordHref(event: Pick<ActivityEventDTO, "entityType" | "entityId">) {
  return `/records/${encodeURIComponent(event.entityType)}/${encodeURIComponent(event.entityId)}`;
}

export function RecordLink({ event, label, className = "" }: { event: Pick<ActivityEventDTO, "entityType" | "entityId">; label: string; className?: string }) {
  return <Link href={recordHref(event)} className={`group inline-flex items-center gap-1 text-u-accent hover:text-u-accent hover:underline ${className}`}>{label}<ArrowUpRight size={12} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>;
}
