import Link from "../shim/link";
import { useState, type FormEvent } from "react";
import { buildHash, useRoute } from "../shim/store";
import type { ReactNode } from "react";
import { formatCurrency, formatNumber } from "../lib/money";
import { STATUS_TONE, statusLabel, type Tone } from "../lib/deposits/domain";

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  meta?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="between" style={{ alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
          {description && <p className="muted" style={{ margin: "4px 0 0", fontSize: 12.5, maxWidth: 900, lineHeight: 1.5 }}>{description}</p>}
          {meta && <div className="row small muted" style={{ marginTop: 8, gap: 10 }}>{meta}</div>}
        </div>
        {actions && <div className="btn-row no-print">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  padded = true,
  className,
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`card ${className ?? ""}`} id={id}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <div className="card-sub">{subtitle}</div>}
          </div>
          {actions && <div className="btn-row">{actions}</div>}
        </header>
      )}
      <div className={padded ? "card-body" : ""}>{children}</div>
    </section>
  );
}

export function Badge({ tone = "neutral", children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" aria-hidden />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status as keyof typeof STATUS_TONE] ?? "neutral";
  return (
    <Badge tone={tone} dot>
      {statusLabel(status)}
    </Badge>
  );
}

export function Money({
  cents,
  tone,
  signed = false,
  className,
  compact = false,
}: {
  cents: number;
  tone?: "positive" | "negative" | "muted";
  signed?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const color = tone === "positive" ? "var(--dp-success)" : tone === "negative" ? "var(--dp-danger)" : tone === "muted" ? "var(--dp-muted)" : undefined;
  return (
    <span className={`tabular ${className ?? ""}`} style={{ color, whiteSpace: "nowrap" }}>
      {formatCurrency(cents, { signed, compact })}
    </span>
  );
}

export function Count({ value, label }: { value: number; label?: string }) {
  return (
    <span className="tabular">
      {formatNumber(value)}
      {label ? <span className="muted small"> {label}</span> : null}
    </span>
  );
}

export function KpiCard({
  label,
  valueCents,
  count,
  isCount,
  hint,
  href,
  tone = "neutral",
}: {
  label: string;
  valueCents?: number;
  count?: number;
  isCount?: boolean;
  hint: string;
  href: string;
  tone?: Tone;
}) {
  const colors: Record<Tone, string> = {
    neutral: "var(--muted)",
    info: "var(--blue)",
    success: "var(--ok)",
    warning: "var(--warn)",
    danger: "var(--danger)",
    accent: "var(--dp-accent)",
  };
  return (
    <Link href={href} className="kpi" style={{ ["--kpi-color" as string]: colors[tone] }}>
      <div className="between" style={{ alignItems: "flex-start" }}>
        <span className="kpi-label">{label}</span>
        <span aria-hidden className="muted" style={{ fontSize: 13 }}>›</span>
      </div>
      <div className="kpi-value tabular">{isCount ? formatNumber(count ?? 0) : formatCurrency(valueCents ?? 0)}</div>
      <div className="kpi-hint">{hint}</div>
      <div className="kpi-foot">
        <span>{isCount ? "Record count" : count != null ? `${formatNumber(count)} record${count === 1 ? "" : "s"}` : "View records"}</span>
        <span aria-hidden>Drill down</span>
      </div>
    </Link>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "positive" | "negative" | "warning";
}) {
  const color = tone === "positive" ? "var(--dp-success)" : tone === "negative" ? "var(--dp-danger)" : tone === "warning" ? "var(--dp-warning)" : undefined;
  return (
    <div>
      <div className="small muted" style={{ marginBottom: 2 }}>{label}</div>
      <div className="strong tabular" style={{ fontSize: 16, color }}>{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Callout({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  title?: string;
  children: ReactNode;
}) {
  const icon = tone === "danger" ? "!" : tone === "warning" ? "!" : tone === "success" ? "✓" : "i";
  return (
    <div className={`callout callout-${tone}`} role={tone === "danger" || tone === "warning" ? "alert" : undefined}>
      <span aria-hidden className="strong" style={{ flex: "0 0 auto" }}>{icon}</span>
      <div>
        {title && <div className="callout-title">{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div style={{ padding: "32px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 26, marginBottom: 6 }} aria-hidden>◇</div>
      <div className="strong">{title}</div>
      {description && <div className="muted small" style={{ marginTop: 4, maxWidth: 520, marginInline: "auto", lineHeight: 1.5 }}>{description}</div>}
      {action && <div className="btn-row" style={{ justifyContent: "center", marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function Progress({ value, total, tone = "var(--dp-brand)" }: { value: number; total: number; tone?: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
  return (
    <div className="bar-track" title={`${pct}%`}>
      <div className="bar-fill" style={{ width: `${pct}%`, background: tone }} />
    </div>
  );
}

export function TableShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="table-wrap">
      {children}
      {footer}
    </div>
  );
}

export function DemoNote({ children }: { children?: ReactNode }) {
  return (
    <Callout tone="info" title="Demonstration environment">
      {children ?? (
        <>
          All tenants, leases, deposits, payments and journal entries are deterministic demo data. Financial actions are simulated:
          no real money moves and no production ledger is posted. Collections, refunds and interest postings are clearly labelled
          as simulated in the ledger.
        </>
      )}
    </Callout>
  );
}

export function Tabs({
  tabs,
  current,
  basePath,
}: {
  tabs: { key: string; label: string }[];
  current: string;
  basePath: string;
}) {
  return (
    <nav className="subnav no-print" aria-label="Section">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`${basePath}${tab.key === tabs[0].key ? "" : `?report=${tab.key}`}`}
          className={current === tab.key ? "active" : ""}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function DefinitionList({ items }: { items: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="definition">
      {items.map((item) => (
        <div key={item.term} style={{ display: "contents" }}>
          <dt>{item.term}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const NON_FILTER_KEYS = new Set(["page", "sort", "dir", "selected", "report", "tab"]);

/** Collapsible filter card: replaces the original always-open GET form card. */
export function FilterCard({ title, subtitle, children }: { title?: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  const route = useRoute();
  const active = Object.entries(route.query).filter(([k, v]) => v && !NON_FILTER_KEYS.has(k)).length;
  const [open, setOpen] = useState(active > 0);
  return (
    <section className="card no-print">
      <header className="card-head">
        <div>
          <h2 className="card-title">{title}{active > 0 && <span className="badge badge-accent" style={{ marginLeft: 8 }}>{active} active</span>}</h2>
          {open && subtitle && <div className="card-sub">{subtitle}</div>}
        </div>
        <button type="button" className="btn btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? "Hide filters" : "Show filters"}</button>
      </header>
      {open && <div className="card-body">{children}</div>}
    </section>
  );
}

/** Replaces <form method="get">: submitting navigates to the same view with the filled-in fields as the query string. */
export function GetForm({ children, className }: { children: ReactNode; className?: string }) {
  const route = useRoute();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      if (typeof v === "string" && v !== "") query[k] = v;
    });
    window.location.hash = buildHash(route.view, query);
  };
  return <form key={JSON.stringify(route.query)} className={className} onSubmit={onSubmit}>{children}</form>;
}
