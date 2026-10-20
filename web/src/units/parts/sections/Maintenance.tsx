import type { Database } from "../../data/types";
import type { UnitRow } from "../../data/selectors";
import { daysLabel, daysUntil, formatDate, money, pct } from "../../lib/format";
import { Icon } from "../../components/ui/Icon";
import { Button, Pill, Progress, Tip } from "../../components/ui/primitives";
import { Callout } from "../../components/ui/Modal";
import { ActionLink, EmptyInline, MiniStat, SectionCard } from "./common";
import { maintenanceTone, priorityTone, projectTone } from "../status";

export function MaintenanceSection({ row }: { row: UnitRow; db: Database }) {
  const m = row.maintenance;
  const unit = row.unit;
  const inspection = unit.inspection;

  const nextInspectionDays = inspection?.nextInspectionDate ? daysUntil(inspection.nextInspectionDate) : null;

  if (m.open.length === 0 && m.projects.length === 0) {
    return (
      <SectionCard icon="wrench" step="E" title="Maintenance & Projects" meta="No activity on record">
        <EmptyInline
          icon="checkCircle"
          title="No maintenance activity"
          body={
            inspection
              ? `Nothing open or recently completed. Last inspection ${formatDate(inspection.lastInspectionDate ?? inspection.nextInspectionDate)} — status ${inspection.status}.`
              : "No work orders, renovations or inspections are recorded against this unit."
          }
          actions={
            <ActionLink href={`/maintenance?unit=${unit.id}`} icon="external">
              Maintenance module
            </ActionLink>
          }
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon="wrench"
      step="E"
      title="Maintenance & Projects"
      meta={`${m.openCount} open work order${m.openCount === 1 ? "" : "s"} · ${m.activeProjects.length} active project${m.activeProjects.length === 1 ? "" : "s"}`}
      actions={
        <>
          <ActionLink href={`/maintenance?unit=${unit.id}`} icon="external">
            Maintenance history
          </ActionLink>
          <ActionLink href={`/projects?unit=${unit.id}`} icon="hammer">
            Projects
          </ActionLink>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MiniStat
          label="Open requests"
          icon="wrench"
          tone={m.openCount ? "amber" : "jade"}
          value={m.openCount}
          hint={m.openCount ? `${m.active.filter((r) => r.priority === "Urgent").length} urgent` : "All clear"}
        />
        <MiniStat
          label="Active projects"
          icon="hammer"
          tone={m.activeProjects.length ? "azure" : "muted"}
          value={m.activeProjects.length}
          hint={m.activeProjects.map((p) => p.refNumber).join(", ") || "None in progress"}
        />
        <MiniStat
          label="Last service"
          icon="clock"
          value={m.lastServiceDate ? formatDate(m.lastServiceDate) : "—"}
          hint={m.lastServiceDate ? daysLabel(-daysUntil(m.lastServiceDate)) + " ago" : "No completed work order"}
        />
        <MiniStat
          label="Expense (90 days)"
          icon="dollar"
          tone={row.financials.maintenanceExpenseRecent > 0 ? "rose" : "muted"}
          value={money(row.financials.maintenanceExpenseRecent)}
          hint="Posted maintenance expense on the unit account"
        />
      </div>

      {inspection && (inspection.status === "Overdue" || (nextInspectionDays !== null && nextInspectionDays <= 30)) && (
        <Callout
          className="mt-3"
          tone={inspection.status === "Overdue" ? "rose" : "cyan"}
          icon="shield"
          title={
            inspection.status === "Overdue"
              ? `Inspection overdue by ${daysLabel(Math.abs(nextInspectionDays ?? 0))}`
              : `Inspection due in ${daysLabel(nextInspectionDays ?? 0)}`
          }
        >
          {inspection.lastInspectionDate ? `Last inspected ${formatDate(inspection.lastInspectionDate)}. ` : ""}
          {inspection.inspector ? `Responsible: ${inspection.inspector}.` : ""}{" "}
          <ActionLink href={`/maintenance?unit=${unit.id}`} icon="calendar">
            Schedule inspection
          </ActionLink>
        </Callout>
      )}

      {/* work orders */}
      {m.open.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-md border border-u-line2">
          <div className="flex items-center justify-between gap-2 bg-u-s2/55 px-2.5 py-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-u-muted">
              Maintenance requests
            </span>
            <span className="u-num text-[10.5px] text-u-muted">{m.open.length} on file</span>
          </div>
          <ul className="divide-y divide-u-line2/60 bg-u-bg/40">
            {m.open.map((r) => (
              <li key={r.id} className="group px-2.5 py-2 transition-colors hover:bg-u-card">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="u-num text-[11px] text-u-muted">{r.refNumber}</span>
                  <a
                    href={`#/maintenance/${r.id}`}
                    className="text-[12.5px] font-500 text-u-ink underline-offset-2 hover:text-u-accent hover:underline"
                  >
                    {r.title}
                  </a>
                  <Pill tone={maintenanceTone[r.status]} dot pulse={r.status === "Overdue"}>
                    {r.status}
                  </Pill>
                  <Pill tone={priorityTone[r.priority]}>{r.priority}</Pill>
                  <Pill tone="neutral">{r.category}</Pill>
                  <span className="ml-auto flex items-center gap-2 text-[11px] text-u-muted">
                    <Tip content={`Raised ${formatDate(r.createdAt)}${r.dueDate ? ` · target ${formatDate(r.dueDate)}` : ""}`}>
                      <span className="u-num inline-flex items-center gap-1">
                        <Icon name="calendar" size={11} />
                        {r.dueDate && daysUntil(r.dueDate) < 0 && r.status !== "Completed" ? (
                          <span className="text-u-danger">{daysLabel(daysUntil(r.dueDate))}</span>
                        ) : (
                          formatDate(r.dueDate ?? r.createdAt)
                        )}
                      </span>
                    </Tip>
                    {r.costToDate > 0 && <span className="u-num">cost {money(r.costToDate)}</span>}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-u-muted">{r.description}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-u-muted">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="user" size={10} />
                    {r.assignedTo ?? "Unassigned"}
                  </span>
                  {r.reportedBy && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="mail" size={10} />
                      Reported by {r.reportedBy}
                    </span>
                  )}
                  {r.completedDate && <span>Completed {formatDate(r.completedDate)}</span>}
                  <a href={`#/maintenance/${r.id}`} className="text-u-accent opacity-0 transition-opacity group-hover:opacity-100 hover:underline">
                    Open work order →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* projects */}
      {m.projects.length > 0 && (
        <div className="mt-3 space-y-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-u-muted">
            Renovation & capital projects
          </span>
          {m.projects.map((p) => {
            const spent = p.budget ? (p.costToDate / p.budget) * 100 : 0;
            return (
              <div
                key={p.id}
                className="rounded-md border border-u-line2 bg-u-bg/45 p-2.5 transition-colors hover:border-u-line2 hover:bg-u-card/70"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="u-num text-[11px] text-u-muted">{p.refNumber}</span>
                  <a
                    href={`#/projects/${p.id}`}
                    className="text-[12.5px] font-500 text-u-ink underline-offset-2 hover:text-u-accent hover:underline"
                  >
                    {p.name}
                  </a>
                  <Pill tone={projectTone[p.status]} dot={p.status === "Active"}>
                    {p.status}
                  </Pill>
                  {p.unitIds.length > 1 && (
                    <Tip content={`This project also touches ${p.unitIds.filter((u) => u !== unit.id).map((u) => u).join(", ")}`}>
                      <Pill tone="cyan" icon="layers">
                        {p.unitIds.length} units
                      </Pill>
                    </Tip>
                  )}
                  <span className="u-num ml-auto text-[11.5px] text-u-ink2">
                    {money(p.costToDate)} <span className="text-u-muted">/ {money(p.budget)}</span>
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={spent} tone={spent > 90 ? "amber" : "azure"} className="flex-1" />
                  <span className="u-num w-10 shrink-0 text-right text-[10.5px] text-u-muted">{pct(p.costToDate, p.budget)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-u-muted">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="calendar" size={10} />
                    {formatDate(p.startDate)} → {p.estimatedCompletionDate ? formatDate(p.estimatedCompletionDate) : "no ETA"}
                  </span>
                  {p.contractor && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="hammer" size={10} />
                      {p.contractor}
                    </span>
                  )}
                  {p.estimatedCompletionDate && p.status === "Active" && (
                    <span className={daysUntil(p.estimatedCompletionDate) < 0 ? "text-u-danger" : ""}>
                      {daysLabel(daysUntil(p.estimatedCompletionDate))}
                    </span>
                  )}
                  <a href={`#/projects/${p.id}`} className="ml-auto text-u-accent hover:underline">
                    View project →
                  </a>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-u-muted">{p.scope}</p>
              </div>
            );
          })}
          <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-u-muted">
            <Icon name="info" size={11} className="mt-px shrink-0" />
            Project invoices, expenses and contractor records stay on the project — the unit shows a summary and links
            to the source record.
          </p>
        </div>
      )}

      {m.recentCompleted.length > 0 && (
        <div className="mt-3">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-u-muted">Recently completed</span>
          <ul className="mt-1 space-y-1">
            {m.recentCompleted.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[11.5px] text-u-muted">
                <Icon name="checkCircle" size={12} className="text-u-ok" />
                <a href={`#/maintenance/${r.id}`} className="truncate hover:text-u-ink2 hover:underline">
                  {r.title}
                </a>
                <span className="u-num ml-auto shrink-0 text-u-muted">
                  {r.completedDate ? formatDate(r.completedDate) : ""}
                  {r.costToDate > 0 ? ` · ${money(r.costToDate)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unit.unitStatus === "Under Maintenance" && (
        <div className="mt-3">
          <Button size="xs" variant="secondary" icon="check" onClick={() => window.location.assign(`#/maintenance?unit=${unit.id}`)}>
            Review work orders before returning unit to service
          </Button>
        </div>
      )}
    </SectionCard>
  );
}


