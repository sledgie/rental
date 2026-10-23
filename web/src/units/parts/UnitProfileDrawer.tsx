import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import type { Database } from "../data/types";
import type { UnitRow } from "../data/selectors";
import { daysLabel, formatDate, money, pct } from "../lib/format";
import { Icon } from "../components/ui/Icon";
import { Avatar, Button, Pill, Progress, Thumb, Tip, Tabs } from "../components/ui/primitives";
import { Callout, Drawer } from "../components/ui/Modal";
import { UnitOverview } from "./sections/Overview";
import { TenantsSection } from "./sections/Tenants";
import { LeaseComposer, LeaseSection } from "./sections/Lease";
import { FinancialSection } from "./sections/Financial";
import { MaintenanceSection } from "./sections/Maintenance";
import { ActivitySection, DocumentsSection, RegisterStatePill } from "./sections/Records";
import { LeaseStatusPill, UnitStatusPill, financeTone } from "./status";

type TabId =
  | "overview"
  | "information"
  | "tenants"
  | "leases"
  | "financial"
  | "maintenance"
  | "documents"
  | "activity";

function MetricTile({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "jade" | "amber" | "rose" | "azure" | "cyan";
  icon: Parameters<typeof Icon>[0]["name"];
}) {
  const toneText = {
    neutral: "text-u-ink",
    jade: "text-u-ok",
    amber: "text-u-warn",
    rose: "text-u-danger",
    azure: "text-u-accent",
    cyan: "text-u-blue",
  }[tone];
  return (
    <div className="group rounded-lg border border-u-line2 bg-u-card/70 p-3 transition-all duration-200 hover:-translate-y-px hover:border-u-line2 hover:bg-u-s2/70">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-u-muted">
        <Icon name={icon} size={11} />
        {label}
      </p>
      <p className={cn("u-num mt-1.5 text-[17px] font-600 leading-none", toneText)}>{value}</p>
      {sub && <p className="mt-1.5 text-[11px] leading-snug text-u-muted">{sub}</p>}
    </div>
  );
}

const AVATAR_TONES = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const avatarTone = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return AVATAR_TONES[h % AVATAR_TONES.length];
};
const archivedOr = (u: { archived: boolean; unitStatus: string }) =>
  u.archived ? "status-former" : ({ Occupied: "status-occupied", Vacant: "status-pending", Reserved: "status-draft", "Under Maintenance": "status-expiring", Inactive: "status-former" } as Record<string, string>)[u.unitStatus] ?? "status-draft";

export function UnitProfileDrawer({
  row,
  db,
  onClose,
  onEdit,
}: {
  row: UnitRow | null;
  db: Database;
  onClose: () => void;
  onEdit: (unitId: string) => void;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    setTab("overview");
  }, [row?.unit.id]);

  if (!row) return null;
  const { unit, property, ctx, financials, maintenance, occupants } = row;
  const days = ctx.daysToExpiry;

  const tabs: Array<{ id: TabId; label: string; count?: number; icon: Parameters<typeof Icon>[0]["name"] }> = [
    { id: "overview", label: "Overview", icon: "grid" },
    { id: "information", label: "Details", icon: "door" },
    { id: "tenants", label: "Tenants", icon: "users", count: occupants.length },
    { id: "leases", label: "Leases", icon: "key", count: ctx.all.length },
    { id: "financial", label: "Financials", icon: "wallet" },
    { id: "maintenance", label: "Maintenance", icon: "wrench", count: maintenance.openCount },
    { id: "documents", label: "Documents", icon: "file", count: row.documents.length },
    { id: "activity", label: "Activity", icon: "activity", count: row.activity.length },
  ];

  return (
    <Drawer
      open={!!row}
      onClose={onClose}
      labelledBy="unit-profile-title"
      title="Unit profile"
      subtitle="Everything about this unit, in one place."
      heading={
        <div className="profile-heading">
          <span className={`avatar avatar-xl avatar-${avatarTone(unit.id)}`} aria-hidden="true">{unit.unitNumber.slice(0, 3)}</span>
          <div className="profile-identity">
            <h2>Unit {unit.unitNumber}</h2>
            <div>
              <span>{unit.code ?? unit.id}</span>
              <span className={`status-badge ${archivedOr(unit)}`}><span className="status-dot" />{unit.archived ? "Archived" : unit.unitStatus}</span>
              {ctx.derivedStatus !== "None" && <span className="status-badge status-draft"><span className="status-dot" />Lease {ctx.derivedStatus}</span>}
            </div>
            <p style={{ marginTop: 6, fontSize: 11, opacity: 0.8 }}>
              {property?.propertyName ?? "Unassigned property"}{property ? ` · ${property.address}, ${property.city}` : ""}
            </p>
          </div>
          <button type="button" className="button button-secondary profile-edit-button" onClick={() => onEdit(unit.id)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            Edit unit
          </button>
        </div>
      }
      tabs={
        <nav className="profile-tabs" aria-label="Unit profile sections">
          {tabs.map((t) => (
            <button key={t.id} className={t.id === tab ? "selected" : ""} aria-current={t.id === tab ? "page" : undefined} onClick={() => setTab(t.id)}>
              {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
            </button>
          ))}
        </nav>
      }
    >

      <div className="animate-u-fade-up space-y-3 p-3 sm:p-4">
        {row.conflicts.length > 0 && tab === "overview" && (
          <div className="space-y-1.5">
            {row.conflicts.map((c) => (
              <Callout key={c} tone="amber" icon="alert" title="Flagged for review">
                {c}
              </Callout>
            ))}
          </div>
        )}

        {tab === "overview" && (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                icon="users"
                label="Current tenant"
                value={
                  row.mainTenantName ? (
                    <span className="font-display text-[15px]">{row.mainTenantName}</span>
                  ) : (
                    <span className="text-[15px] text-u-muted">No current tenant</span>
                  )
                }
                sub={
                  occupants.length > 1
                    ? `${occupants.length} people linked · ${occupants.filter((o) => o.party.isSignatory).length} signatories`
                    : occupants.length === 1
                      ? `${occupants[0].party.role}${occupants[0].party.isSignatory ? " · signatory" : " · non-signatory"}`
                      : "Link people through a lease"
                }
                tone={row.mainTenantName ? "azure" : "neutral"}
              />
              <MetricTile
                icon="dollar"
                label="Monthly contractual rent"
                value={ctx.currentRent !== null ? money(ctx.currentRent) : "—"}
                sub={
                  ctx.currentRent !== null
                    ? ctx.rentBasis === "allocation"
                      ? `${pct(ctx.currentRent, ctx.leaseTotalRent ?? 0)} of ${money(ctx.leaseTotalRent)} lease total`
                      : ctx.rentBasis === "holdover"
                        ? "Holdover rate — not in the rent roll"
                        : "Single-unit lease"
                    : ctx.rentBasis === "unallocated"
                      ? "Shared lease without allocation"
                      : ctx.pending
                        ? `Pending lease at ${money(ctx.pending.lease.totalContractRent)}`
                        : "No applicable lease"
                }
                tone={ctx.currentRent !== null ? "jade" : "neutral"}
              />
              <MetricTile
                icon="clock"
                label="Lease expiry"
                value={days !== null ? formatDate(ctx.current?.lease.endDate ?? ctx.holdover?.lease.endDate ?? "") : "—"}
                sub={
                  days !== null
                    ? days < 0
                      ? `${daysLabel(days)} ago — ${ctx.holdover ? "holdover in place" : "expired"}`
                      : `${daysLabel(days)} remaining${ctx.derivedStatus === "Expiring" ? " · inside warning window" : ""}`
                    : "No lease end date"
                }
                tone={days !== null && days < 0 ? "rose" : days !== null && days <= 60 ? "amber" : "neutral"}
              />
              <MetricTile
                icon="wallet"
                label="Outstanding balance"
                value={money(financials.outstandingNet)}
                sub={
                  financials.overdueNet > 0
                    ? `${money(financials.overdueNet)} overdue · ${money(financials.credits)} credits applied`
                    : financials.outstandingNet > 0
                      ? "Not yet past due"
                      : "Account clear"
                }
                tone={financials.overdueNet > 0 ? "rose" : financials.outstandingNet > 0 ? "amber" : "jade"}
              />
              <MetricTile
                icon="clipboard"
                label="Billed this month"
                value={money(financials.billedThisMonth)}
                sub={`Collected ${money(financials.collectedThisMonth)}${
                  financials.collectionRate !== null ? ` · ${financials.collectionRate.toFixed(0)}% trailing` : ""
                }`}
              />
              <MetricTile
                icon="wrench"
                label="Open work orders"
                value={maintenance.openCount}
                sub={
                  maintenance.active.length
                    ? maintenance.active.map((r) => r.refNumber).join(", ")
                    : "Nothing open"
                }
                tone={maintenance.openCount ? "amber" : "jade"}
              />
              <MetricTile
                icon="hammer"
                label="Active projects"
                value={maintenance.activeProjects.length}
                sub={
                  maintenance.activeProjects.length
                    ? `${money(maintenance.activeProjects.reduce((s, p) => s + p.costToDate, 0))} committed of ${money(
                        maintenance.activeProjects.reduce((s, p) => s + p.budget, 0),
                      )}`
                    : maintenance.projects.length
                      ? `${maintenance.projects.length} on file (completed)`
                      : "No capital work"
                }
                tone={maintenance.activeProjects.length ? "cyan" : "neutral"}
              />
              <MetricTile
                icon="gauge"
                label="Occupancy & condition"
                value={<span className="text-[15px]">{unit.unitStatus}</span>}
                sub={`Condition ${unit.unitCondition}${
                  unit.inspection ? ` · inspection ${unit.inspection.status}` : ""
                }`}
              />
            </div>

            {/* occupancy at a glance */}
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
              <div className="rounded-lg border border-u-line2 bg-u-card/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-[12px] font-600 uppercase tracking-[0.11em] text-u-ink2">
                    Who is here now
                  </h3>
                  <Button size="xs" variant="ghost" icon="users" onClick={() => setTab("tenants")}>
                    Manage
                  </Button>
                </div>
                {occupants.length === 0 ? (
                  <p className="mt-2 text-[12px] text-u-muted">
                    No occupancy relationship. People are linked to units through lease parties.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {occupants.map((o) => (
                      <li key={o.party.id} className="flex items-center gap-2.5 rounded-md border border-u-line2 bg-u-bg/45 px-2.5 py-2">
                        <Avatar first={o.tenant.firstName} last={o.tenant.lastName} hue={o.tenant.avatarHue} size={28} />
                        <div className="min-w-0 flex-1">
                          <a
                            href={`#/tenants/${o.tenant.id}`}
                            onClick={onClose}
                            className="block truncate text-[12.5px] font-500 text-u-ink hover:text-u-accent hover:underline"
                          >
                            {o.tenant.firstName} {o.tenant.lastName}
                          </a>
                          <span className="u-num block truncate text-[10.5px] text-u-muted">
                            {o.tenant.id} · {o.tenant.phone || "no phone"} · {o.tenant.email || "no email"}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Pill tone={o.party.role === "Main Tenant" ? "azure" : o.party.role === "Co-Tenant" ? "cyan" : "muted"}>
                            {o.party.role}
                          </Pill>
                          <span className="text-[10px] text-u-muted">
                            {o.party.isSignatory ? "Signatory" : "Non-signatory"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-u-line2 bg-u-card/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-[12px] font-600 uppercase tracking-[0.11em] text-u-ink2">
                    Collections trend
                  </h3>
                  <Pill tone={financeTone[financials.status]} dot>
                    {financials.status}
                  </Pill>
                </div>
                <div className="mt-3 space-y-2">
                  {financials.series.map((p) => {
                    const rate = p.billed ? (p.collected / p.billed) * 100 : 0;
                    return (
                      <div key={p.key}>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="u-num text-u-muted">{p.label}</span>
                          <Tip content={`Billed ${money(p.billed)} · collected ${money(p.collected)}`}>
                            <span className={cn("u-num", rate >= 99 ? "text-u-ok" : rate > 0 ? "text-u-warn" : "text-u-muted")}>
                              {p.billed ? `${rate.toFixed(0)}%` : "—"}
                            </span>
                          </Tip>
                        </div>
                        <Progress value={rate} tone={rate >= 99 ? "jade" : rate > 0 ? "amber" : "muted"} height={3} />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 border-t border-u-line2 pt-2 text-[11px] text-u-muted">
                  {financials.excluded.draft + financials.excluded.voided + financials.excluded.scheduled > 0 ? (
                    <>
                      Excluded from balances: {financials.excluded.draft} draft, {financials.excluded.voided} voided,{" "}
                      {financials.excluded.scheduled} scheduled.
                    </>
                  ) : (
                    "All transactions on this account are posted."
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <LeaseSection row={row} db={db} onComposeLease={() => setComposerOpen(true)} />
              <MaintenanceSection row={row} db={db} />
            </div>
          </>
        )}

        {tab === "information" && <UnitOverview row={row} db={db} variant="full" onEdit={() => onEdit(unit.id)} />}
        {tab === "tenants" && <TenantsSection row={row} db={db} onStartLease={() => setComposerOpen(true)} />}
        {tab === "leases" && <LeaseSection row={row} db={db} onComposeLease={() => setComposerOpen(true)} />}
        {tab === "financial" && <FinancialSection row={row} db={db} />}
        {tab === "maintenance" && <MaintenanceSection row={row} db={db} />}
        {tab === "documents" && <DocumentsSection row={row} db={db} />}
        {tab === "activity" && <ActivitySection row={row} db={db} />}
      </div>

      <LeaseComposer open={composerOpen} onClose={() => setComposerOpen(false)} db={db} unitId={unit.id} />
    </Drawer>
  );
}
