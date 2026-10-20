import { useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Ban,
  Banknote,
  Bell,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  DoorOpen,
  FileDiff,
  FileSignature,
  FileText,
  Flag,
  FolderOpen,
  Hammer,
  HardHat,
  History,
  Info,
  LayoutDashboard,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useStore } from "../lib/store";
import {
  canCompleteProject,
  currentApprovedBudget,
  dateLong,
  daysBetween,
  money,
  nextStatuses,
  projectFinancials,
  projectProgress,
  TODAY,
} from "../lib/finance";
import type { Priority, Project, ProjectStatus } from "../lib/types";
import { exportProjectsCsv } from "../lib/export";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, InfoNote, Input, Modal, ProgressBar, ProgressRing, Select, SectionHeader, StatusBadge, Textarea } from "../components/ui";
import { TasksTab, ContractorsTab } from "./project/TasksContractors";
import { BudgetTab, InvoicesTab } from "./project/BudgetInvoices";
import { ActivityTab, ChangeOrdersTab, CommercialTab, DocumentsTab, InspectionsTab, ScheduleTab } from "./project/MoreTabs";
import { cn } from "../utils/cn";

type DetailTab = "overview" | "tasks" | "contractors" | "budget" | "invoices" | "commercial" | "changes" | "schedule" | "inspections" | "documents" | "activity";

const tabs: { id: DetailTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "tasks", label: "Scope & tasks", icon: ClipboardList },
  { id: "contractors", label: "Contractors", icon: HardHat },
  { id: "budget", label: "Budget & expenses", icon: Wallet },
  { id: "invoices", label: "Invoices & payments", icon: ReceiptText },
  { id: "commercial", label: "Quotes & POs", icon: FileSignature },
  { id: "changes", label: "Change orders", icon: FileDiff },
  { id: "schedule", label: "Schedule", icon: CalendarRange },
  { id: "inspections", label: "Inspections", icon: ShieldCheck },
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "activity", label: "Activity", icon: History },
];

export function ProjectDetailPage({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { projects, properties, contractors, toggleArchive, transitionProject, notify, user } = useStore();
  const project = projects.find((p) => p.id === projectId);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (!project) {
    return (
      <div className="py-16">
        <EmptyState icon={Hammer} title="Project not found" description="This project may have been removed or you do not have permission to view it." action={<Button variant="primary" size="sm" icon={ArrowLeft} onClick={onBack}>Back to projects</Button>} />
      </div>
    );
  }

  const fin = projectFinancials(project);
  const progress = projectProgress(project);
  const property = properties.find((p) => p.id === project.propertyId);
  const openDeficiencies = project.deficiencies.filter((d) => d.status === "Open" || d.status === "In Progress").length;
  const pendingChanges = project.changeOrders.filter((c) => c.approval === "Pending Approval").length;
  const overdueTasks = project.tasks.filter((t) => t.status !== "Completed" && t.plannedFinish < TODAY);
  const isClosed = project.status === "Completed" || project.status === "Cancelled";

  const counts: Partial<Record<DetailTab, number>> = {
    tasks: project.tasks.length,
    invoices: project.invoices.length,
    changes: pendingChanges,
    inspections: openDeficiencies,
    documents: project.documents.length,
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      notify("Reason required", "warning", "Record why this project is being cancelled.");
      return;
    }
    const result = transitionProject(project.id, "Cancelled", cancelReason);
    if (result.ok) { setCancelOpen(false); setCancelReason(""); }
    else notify("Unable to cancel", "error", result.error);
  };

  return (
    <div className="animate-ap-slide-up">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-1 text-[11px] text-u-muted transition hover:text-u-accent"><ArrowLeft className="h-3.5 w-3.5" /> All projects</button>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditOpen(true)} disabled={isClosed}>Edit project</Button>
          {project.status === "On Hold" && (
            <Button variant="primary" size="sm" icon={CheckCircle2} onClick={() => setStatusOpen(true)}>Resume project</Button>
          )}
          <Button variant="secondary" size="sm" icon={CalendarCheck} onClick={() => setStatusOpen(true)} disabled={isClosed}>Change status</Button>
          <div className="relative">
            <IconButton icon={MoreHorizontal} label="More project actions" onClick={() => setMenuOpen((open) => !open)} />
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="animate-ap-slide-up absolute right-0 top-9 z-40 w-[215px] rounded-xl border border-u-ink/10 bg-u-s2 p-1 shadow-2xl">
                  <button onClick={() => { exportProjectsCsv([project], contractors); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-u-ink2 hover:bg-u-ink/[0.06]"><Download className="h-3.5 w-3.5" /> Export project CSV</button>
                  <button onClick={() => { setTab("activity"); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-u-ink2 hover:bg-u-ink/[0.06]"><History className="h-3.5 w-3.5" /> View audit history</button>
                  <button onClick={() => { setArchiveOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-u-ink2 hover:bg-u-ink/[0.06]"><Archive className="h-3.5 w-3.5" /> {project.archived ? "Restore project" : "Archive project"}</button>
                  <div className="my-1 h-px bg-u-ink/[0.07]" />
                  <button disabled={isClosed} onClick={() => { setCancelOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-u-danger hover:bg-u-danger/10 disabled:opacity-40"><Ban className="h-3.5 w-3.5" /> Cancel project</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Card className="relative overflow-hidden">
        <div className="absolute inset-0">
          {property?.image && <img src={property.image} alt="" className="h-full w-full object-cover opacity-[0.16]" />}
          <div className="absolute inset-0 bg-gradient-to-r from-u-bg via-u-bg/95 to-u-card/80" />
          <div className="pj-blueprint absolute inset-0 opacity-35" />
          <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-u-accent/[0.09] blur-3xl" />
        </div>
        <div className="relative p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded border border-u-accent/25 bg-u-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-u-accent">{project.id}</span>
                <StatusBadge status={project.status} />
                <StatusBadge status={project.priority === "Emergency" ? "Emergency" : project.priority === "High" ? "High" : project.priority === "Low" ? "Low" : "Normal"} />
                <Badge tone="slate" icon={Hammer}>{project.type}</Badge>
                {project.archived && <Badge tone="slate" icon={Archive}>Archived</Badge>}
                {project.readinessApproved && <Badge tone="aqua" icon={DoorOpen}>Unit ready</Badge>}
              </div>
              <h1 className="text-balance text-[21px] font-semibold leading-tight tracking-[-0.015em] text-u-ink sm:text-[26px]">{project.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-u-muted">
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-u-muted" /> {project.propertyName}</span>
                <span className="flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5 text-u-muted" /> Unit {project.unitNumber}</span>
                <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5 text-u-muted" /> {project.manager}</span>
                <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 text-u-muted" /> {dateLong(project.plannedStart)} → {dateLong(project.estimatedCompletion)}</span>
                <span className={cn("flex items-center gap-1", project.estimatedCompletion < TODAY && project.status !== "Completed" ? "text-u-warn" : "")}><Timer className="h-3.5 w-3.5" /> {project.estimatedCompletion < TODAY && project.status !== "Completed" ? `${daysBetween(project.estimatedCompletion, TODAY)}d overdue` : `${daysBetween(TODAY, project.estimatedCompletion)}d remaining`}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge tone={fin.budgetHealth === "Over budget" ? "rose" : fin.budgetHealth === "At risk" ? "amber" : "acid"} dot>{fin.budgetHealth}</Badge>
                <span className="text-[10px] text-u-muted">{money(fin.incurred)} incurred of {money(fin.currentBudget)} approved</span>
                <span className="text-u-muted">·</span>
                <span className="text-[10px] text-u-muted">{openDeficiencies} open deficiencies</span>
                <span className="text-u-muted">·</span>
                <span className="text-[10px] text-u-muted">{overdueTasks.length} overdue tasks</span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-u-ink/[0.08] bg-u-bg/40 p-3 backdrop-blur">
              <ProgressRing value={progress} size={68} stroke={6} tone={project.status === "On Hold" ? "amber" : project.status === "Completed" ? "aqua" : "acid"}>
                <span className="font-mono text-[15px] font-semibold text-u-ink">{progress}%</span>
                <span className="text-[7px] uppercase tracking-wide text-u-muted">complete</span>
              </ProgressRing>
              <div className="pr-1">
                <p className="text-[8.5px] uppercase tracking-[0.1em] text-u-muted">Forecast final</p>
                <p className={cn("font-mono text-[15px]", fin.overBudget ? "text-u-danger" : "text-u-ink")}>{money(fin.forecastFinal)}</p>
                <p className="text-[9px] text-u-muted">{fin.variance >= 0 ? `${money(fin.variance)} under` : `${money(Math.abs(fin.variance))} over`} budget</p>
                <div className="mt-1 flex items-center gap-1 text-[8.5px] text-u-muted"><span className="h-1.5 w-1.5 rounded-full bg-u-accent" /> {project.tasks.filter((t) => t.status === "Completed").length}/{project.tasks.length} tasks</div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative grid grid-cols-2 divide-x divide-y divide-u-ink/[0.06] border-t border-u-ink/[0.06] bg-u-bg/30 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          {[
            { label: "Original budget", value: money(fin.originalBudget) },
            { label: "Approved changes", value: `${fin.budgetChanges >= 0 ? "+" : "−"}${money(Math.abs(fin.budgetChanges))}`, tone: fin.budgetChanges > 0 ? "amber" : undefined },
            { label: "Current approved", value: money(currentApprovedBudget(project)), accent: true },
            { label: "Committed", value: money(fin.committed) },
            { label: "Incurred", value: money(fin.incurred) },
            { label: "Outstanding payables", value: money(fin.outstanding), tone: fin.outstanding > 0 ? "amber" : undefined },
          ].map((item) => (
            <div key={item.label} className="px-3 py-2">
              <p className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">{item.label}</p>
              <p className={cn("mt-0.5 font-mono text-[12px]", item.accent ? "text-u-accent" : item.tone === "amber" ? "text-u-warn" : "text-u-ink")}>{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="-mx-3 mt-3 border-b border-u-ink/[0.06] bg-u-bg/85 px-3 backdrop-blur-xl sm:-mx-5 sm:px-5">
        <div className="flex flex-wrap items-center gap-0.5 py-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            const count = counts[item.id];
            return (
              <button key={item.id} onClick={() => setTab(item.id)} className={cn("relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium transition", isActive ? "bg-u-ink/[0.07] text-u-ink" : "text-u-muted hover:bg-u-ink/[0.03] hover:text-u-ink2")}>
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-u-accent" : "text-u-muted")} strokeWidth={1.9} />
                {item.label}
                {count !== undefined && count > 0 && <span className={cn("rounded px-1 font-mono text-[8.5px]", item.id === "inspections" ? "bg-u-danger/15 text-u-danger" : item.id === "changes" ? "bg-u-warn/15 text-u-warn" : isActive ? "bg-u-ink/[0.1] text-u-ink2" : "bg-u-ink/[0.05] text-u-muted")}>{count}</span>}
                {isActive && <span className="absolute inset-x-2 -bottom-1 h-[2px] rounded-full bg-u-accent" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 animate-ap-slide-up">
        {tab === "overview" && <OverviewTab project={project} setTab={setTab} onStatus={() => setStatusOpen(true)} />}
        {tab === "tasks" && <TasksTab project={project} />}
        {tab === "contractors" && <ContractorsTab project={project} />}
        {tab === "budget" && <BudgetTab project={project} />}
        {tab === "invoices" && <InvoicesTab project={project} />}
        {tab === "commercial" && <CommercialTab project={project} />}
        {tab === "changes" && <ChangeOrdersTab project={project} />}
        {tab === "schedule" && <ScheduleTab project={project} />}
        {tab === "inspections" && <InspectionsTab project={project} />}
        {tab === "documents" && <DocumentsTab project={project} />}
        {tab === "activity" && <ActivityTab project={project} />}
      </div>

      <StatusModal open={statusOpen} onClose={() => setStatusOpen(false)} project={project} />
      <EditProjectModal open={editOpen} onClose={() => setEditOpen(false)} projectId={project.id} />
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => { toggleArchive(project.id, !project.archived); setArchiveOpen(false); }}
        title={project.archived ? "Restore this project?" : "Archive this project?"}
        description={`${project.id} — ${project.name}`}
        confirmLabel={project.archived ? "Restore project" : "Archive project"}
        tone={project.archived ? "primary" : "danger"}
      >
        <div className="rounded-xl border border-u-ink/[0.07] bg-u-ink/[0.025] p-3 text-[11.5px] leading-relaxed text-u-muted">Archiving preserves the complete project record: scope, financials, inspection results, documents and audit history. The project is hidden from default lists and can be restored.</div>
      </ConfirmDialog>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel project" description="Cancellation is a terminal status. History and financial records are preserved." icon={Ban} size="sm"
        footer={<><Button variant="ghost" size="md" onClick={() => setCancelOpen(false)}>Keep project</Button><Button variant="danger" size="md" icon={Ban} onClick={handleCancel}>Cancel project</Button></>}>
        <div className="space-y-3">
          <InfoNote tone="warning">All tasks, invoices, payments and documents remain available after cancellation. This action is recorded by {user.name} with {dateLong(TODAY)}.</InfoNote>
          <Field label="Cancellation reason" required><Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Owner accepted insurer settlement and deferred works to the 2027 capital plan." /></Field>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------------------------- Overview ------------------------------- */

function OverviewTab({ project, setTab, onStatus }: { project: Project; setTab: (tab: DetailTab) => void; onStatus: () => void }) {
  const { contractors, approveReadiness, notify } = useStore();
  const fin = projectFinancials(project);
  const progress = projectProgress(project);
  const upcoming = project.milestones.filter((m) => m.status !== "Completed").slice(0, 4);
  const nextDeadlines = [
    ...project.tasks.filter((t) => t.status !== "Completed").map((t) => ({ name: t.name, date: t.plannedFinish, type: "Task", id: t.id })),
    ...project.milestones.filter((m) => m.status !== "Completed").map((m) => ({ name: m.name, date: m.plannedDate, type: "Milestone", id: m.id })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const checks = canCompleteProject(project);
  const readinessChecks = [
    { label: "Project completed", passed: project.status === "Completed" },
    { label: "Final inspection passed", passed: !checks.finalInspectionOutstanding && !checks.failedInspectionOutstanding },
    { label: "Deficiencies verified", passed: checks.openDeficiencyCount === 0 },
    { label: "Readiness approved", passed: project.readinessApproved },
  ];

  const handleReadiness = () => {
    const result = approveReadiness(project.id);
    if (!result.ok) notify("Readiness not approved", "warning", result.error);
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[1.62fr_1fr]">
      <div className="space-y-3">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={ClipboardList} title="Scope delivery" subtitle={`${project.tasks.filter((t) => t.status === "Completed").length} of ${project.tasks.length} work packages complete`} /><Button size="xs" variant="ghost" iconRight={ArrowRight} onClick={() => setTab("tasks")}>View tasks</Button></div>
          <div className="grid gap-3 p-4 sm:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-3">
              <ProgressRing value={progress} size={84} stroke={7} tone={project.status === "On Hold" ? "amber" : "acid"}>
                <span className="font-mono text-[19px] font-semibold text-u-ink">{progress}%</span>
                <span className="text-[7.5px] uppercase tracking-wide text-u-muted">delivered</span>
              </ProgressRing>
              <div className="space-y-1 text-[10px]">
                {[
                  { label: "Completed", value: project.tasks.filter((t) => t.status === "Completed").length, tone: "bg-u-ok" },
                  { label: "In progress", value: project.tasks.filter((t) => t.status === "In Progress").length, tone: "bg-u-accent" },
                  { label: "Blocked", value: project.tasks.filter((t) => t.status === "Blocked").length, tone: "bg-u-danger" },
                  { label: "Not started", value: project.tasks.filter((t) => t.status === "Not Started").length, tone: "bg-u-ink/20" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-1.5 text-u-muted"><span className={cn("h-1.5 w-1.5 rounded-full", row.tone)} /> {row.label} <span className="ml-auto font-mono text-u-ink">{row.value}</span></div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {Array.from(new Set(project.tasks.map((t) => t.category))).map((category) => {
                const categoryTasks = project.tasks.filter((t) => t.category === category);
                const pct = Math.round((categoryTasks.filter((t) => t.status === "Completed").length / Math.max(1, categoryTasks.length)) * 100);
                return (
                  <div key={category}>
                    <div className="mb-0.5 flex items-center justify-between text-[9.5px]"><span className="text-u-muted">{category}</span><span className="font-mono text-u-muted">{pct}%</span></div>
                    <ProgressBar value={pct} height="h-1" tone={categoryTasks.some((t) => t.status === "Blocked") ? "rose" : "acid"} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-u-ink/[0.06] bg-u-ink/[0.012] px-4 py-2 text-[9.5px] text-u-muted">
            <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {project.tasks.filter((t) => t.status === "Blocked").length} blocked work packages need attention</span>
            <button onClick={() => setTab("schedule")} className="flex items-center gap-1 text-u-accent/90 hover:text-u-accent">Schedule & milestones <ArrowRight className="h-3 w-3" /></button>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={CalendarRange} title="Milestones" subtitle="Next checkpoints" /><Badge tone="slate">{project.milestones.filter((m) => m.status === "Completed").length}/{project.milestones.length}</Badge></div>
            <div className="divide-y divide-u-ink/[0.045]">
              {upcoming.map((milestone) => {
                const missed = milestone.plannedDate < TODAY;
                return (
                  <button key={milestone.id} onClick={() => setTab("schedule")} className="flex w-full items-start gap-2 px-4 py-2 text-left transition hover:bg-u-ink/[0.02]">
                    <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", missed ? "border-u-danger/25 bg-u-danger/10 text-u-danger" : "border-u-ink/12 bg-u-ink/[0.03] text-u-muted")}>{missed ? <AlertTriangle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[10.5px] font-medium text-u-ink">{milestone.name}</span><span className="block text-[9px] text-u-muted">{milestone.responsible}</span></span>
                    <span className={cn("shrink-0 font-mono text-[9px]", missed ? "text-u-danger" : "text-u-muted")}>{dateLong(milestone.plannedDate)}</span>
                  </button>
                );
              })}
              {upcoming.length === 0 && <div className="p-3"><EmptyState compact icon={CheckCircle2} title="All milestones complete" description="The project team has cleared every checkpoint." /></div>}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={Timer} title="Upcoming deadlines" subtitle="Tasks and milestones due next" /><Badge tone="amber">{nextDeadlines.filter((d) => d.date < TODAY).length} overdue</Badge></div>
            <div className="divide-y divide-u-ink/[0.045]">
              {nextDeadlines.map((deadline) => {
                const missed = deadline.date < TODAY;
                return (
                  <button key={`${deadline.type}-${deadline.id}`} onClick={() => setTab(deadline.type === "Task" ? "tasks" : "schedule")} className="flex w-full items-center gap-2 px-4 py-2 text-left transition hover:bg-u-ink/[0.02]">
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", deadline.type === "Task" ? "border-u-blue/20 bg-u-blue/[0.07] text-u-blue" : "border-u-violet/20 bg-u-violet/[0.07] text-u-violet")}>{deadline.type === "Task" ? <ClipboardList className="h-3 w-3" /> : <Flag className="h-3 w-3" />}</span>
                    <span className="min-w-0 flex-1 truncate text-[10.5px] text-u-ink2">{deadline.name}</span>
                    <span className={cn("shrink-0 font-mono text-[9px]", missed ? "text-u-danger" : "text-u-muted")}>{dateLong(deadline.date)}</span>
                  </button>
                );
              })}
              {nextDeadlines.length === 0 && <div className="p-3"><EmptyState compact icon={CalendarCheck} title="No upcoming deadlines" description="Nothing is due in the current plan." /></div>}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={CameraIcon} title="Site photos" subtitle="Before and progress evidence" /><Button size="xs" variant="ghost" iconRight={ArrowRight} onClick={() => setTab("documents")}>All documents</Button></div>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            {project.documents.filter((d) => d.url).slice(0, 4).map((document) => (
              <button key={document.id} onClick={() => setTab("documents")} className="group relative h-24 overflow-hidden rounded-lg border border-u-ink/[0.07]">
                <img src={document.url} alt={document.name} className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-u-bg/90 to-transparent" />
                <span className="absolute left-1 top-1"><Badge tone={document.stage === "Before" ? "amber" : document.stage === "After" ? "aqua" : "sky"}>{document.stage}</Badge></span>
                <span className="absolute inset-x-1 bottom-1 truncate text-left text-[8.5px] text-u-ink">{document.name}</span>
              </button>
            ))}
            {project.documents.filter((d) => d.url).length === 0 && <div className="col-span-full"><EmptyState compact icon={CameraIcon} title="No photos uploaded" description="Add before, during and after photos from the Documents tab." /></div>}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={History} title="Latest activity" subtitle="Audited project history" /><Button size="xs" variant="ghost" iconRight={ArrowRight} onClick={() => setTab("activity")}>Full history</Button></div>
          <div className="divide-y divide-u-ink/[0.045]">
            {project.activity.slice(0, 4).map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 px-4 py-2">
                <Avatar name={entry.actor} size="xs" />
                <div className="min-w-0 flex-1"><p className="text-[10.5px] text-u-ink2"><span className="font-medium text-u-ink">{entry.actor}</span> {entry.action.toLowerCase()}</p><p className="truncate text-[9.5px] text-u-muted">{entry.detail}</p></div>
                <span className="shrink-0 font-mono text-[8.5px] text-u-muted">{dateLong(entry.at.slice(0, 10))}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={Wallet} title="Financial snapshot" subtitle="Consistent, derived definitions" /><Badge tone={fin.overBudget ? "rose" : fin.budgetHealth === "At risk" ? "amber" : "acid"} dot>{fin.budgetHealth}</Badge></div>
          <div className="p-3">
            <div className="flex items-end justify-between">
              <div><p className="text-[9px] uppercase tracking-[0.1em] text-u-muted">Current approved</p><p className="font-mono text-[20px] font-medium text-u-ink">{money(fin.currentBudget)}</p></div>
              <div className="text-right"><p className="text-[9px] uppercase tracking-[0.1em] text-u-muted">Forecast</p><p className={cn("font-mono text-[13px]", fin.overBudget ? "text-u-danger" : "text-u-accent")}>{money(fin.forecastFinal)}</p></div>
            </div>
            <ProgressBar value={fin.utilisation} tone={fin.overBudget ? "rose" : fin.utilisation > 80 ? "amber" : "acid"} className="mt-2" height="h-2" />
            <div className="mt-1 flex justify-between text-[9px] text-u-muted"><span>{fin.utilisation}% incurred</span><span>{money(fin.remaining)} remaining</span></div>
            <div className="mt-2.5 space-y-1.5">
              {[
                { label: "Committed", value: fin.committed, icon: HardHat },
                { label: "Incurred", value: fin.incurred, icon: ReceiptText },
                { label: "Invoiced", value: fin.invoiced, icon: FileText },
                { label: "Paid", value: fin.paid, icon: Banknote },
                { label: "Outstanding payables", value: fin.outstanding, icon: Wallet },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-[10px]"><span className="flex items-center gap-1 text-u-muted"><row.icon className="h-3 w-3 text-u-muted" /> {row.label}</span><span className={cn("font-mono", row.label === "Outstanding payables" && fin.outstanding > 0 ? "text-u-warn" : "text-u-ink")}>{money(row.value)}</span></div>
              ))}
              <div className="flex items-center justify-between border-t border-u-ink/[0.07] pt-1.5 text-[10px]"><span className="text-u-muted">Budget variance</span><span className={cn("font-mono", fin.variance >= 0 ? "text-u-accent" : "text-u-danger")}>{fin.variance >= 0 ? "+" : "−"}{money(Math.abs(fin.variance))}</span></div>
            </div>
            <button onClick={() => setTab("budget")} className="mt-2.5 flex w-full items-center justify-between rounded-lg border border-u-ink/[0.07] bg-u-ink/[0.025] px-2.5 py-1.5 text-[10px] text-u-ink2 transition hover:border-u-ink/15 hover:text-u-ink">Budget & expenses <ArrowUpRight className="h-3 w-3" /></button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={DoorOpen} title="Unit readiness" subtitle="Separate from project completion" /></div>
          <div className="space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={project.readinessApproved ? "aqua" : "amber"} dot>{project.readinessApproved ? "Ready for rent" : "Not ready"}</Badge>
              <Badge tone="slate">{project.occupancyStatus}</Badge>
              {project.mustVacate && <Badge tone="amber" icon={DoorOpen}>Vacate required</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[9.5px]">
              <div className="rounded bg-u-ink/[0.025] px-2 py-1"><p className="text-[8px] uppercase tracking-wide text-u-muted">Tenant</p><p className="truncate text-u-ink2">{project.tenantName ?? "None · vacant"}</p></div>
              <div className="rounded bg-u-ink/[0.025] px-2 py-1"><p className="text-[8px] uppercase tracking-wide text-u-muted">Move-out</p><p className="text-u-ink2">{project.moveOutDate ? dateLong(project.moveOutDate) : "—"}</p></div>
              <div className="rounded bg-u-ink/[0.025] px-2 py-1"><p className="text-[8px] uppercase tracking-wide text-u-muted">Expected ready</p><p className="text-u-ink2">{dateLong(project.expectedReadyDate)}</p></div>
              <div className="rounded bg-u-ink/[0.025] px-2 py-1"><p className="text-[8px] uppercase tracking-wide text-u-muted">Actual ready</p><p className="text-u-ink2">{dateLong(project.actualReadyDate)}</p></div>
              <div className="rounded bg-u-ink/[0.025] px-2 py-1"><p className="text-[8px] uppercase tracking-wide text-u-muted">Lost rental income</p><p className={cn("font-mono", project.lostRentCents > 0 ? "text-u-warn" : "text-u-muted")}>{money(project.lostRentCents)}</p></div>
              <div className="rounded bg-u-ink/[0.025] px-2 py-1"><p className="text-[8px] uppercase tracking-wide text-u-muted">Tenant notices</p><p className="flex items-center gap-1 text-u-ink2"><Bell className="h-2.5 w-2.5" /> {project.tenantNotifications.length} sent</p></div>
            </div>
            {project.tenantNotifications.length > 0 && (
              <p className="rounded border border-u-ink/[0.055] bg-u-ink/[0.018] px-2 py-1 text-[8.5px] leading-relaxed text-u-muted">
                Latest: {dateLong(project.tenantNotifications[project.tenantNotifications.length - 1].date)} via {project.tenantNotifications[project.tenantNotifications.length - 1].channel} — {project.tenantNotifications[project.tenantNotifications.length - 1].note}
              </p>
            )}
            <div className="space-y-1">
              {readinessChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-1.5 text-[9.5px]">{check.passed ? <CheckCircle2 className="h-3 w-3 text-u-ok" /> : <X className="h-3 w-3 text-u-muted" />}<span className={check.passed ? "text-u-ink2" : "text-u-muted"}>{check.label}</span></div>
              ))}
            </div>
            {!project.readinessApproved ? (
              <Button variant="secondary" size="sm" icon={DoorOpen} onClick={handleReadiness} className="w-full">Confirm readiness & availability</Button>
            ) : (
              <p className="rounded border border-u-ok/20 bg-u-ok/[0.05] px-2 py-1 text-[9px] text-u-ok/80">Readiness approved by {project.readinessApprovedBy} on {dateLong(project.actualReadyDate)}.</p>
            )}
            <p className="text-[8.5px] leading-relaxed text-u-muted">Completion never marks a unit available automatically. Requires passed inspections, verified deficiencies and this readiness confirmation.</p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={HardHat} title="Project team" subtitle={`${project.team.length} assignments`} /><Button size="xs" variant="ghost" iconRight={ArrowRight} onClick={() => setTab("contractors")}>Manage</Button></div>
          <div className="divide-y divide-u-ink/[0.045]">
            {project.team.slice(0, 4).map((member) => {
              const contractor = contractors.find((c) => c.id === member.contractorId);
              return (
                <div key={member.id} className="flex items-center gap-2 px-4 py-2">
                  <Avatar name={contractor?.name ?? member.contractorId} size="sm" />
                  <div className="min-w-0 flex-1"><p className="truncate text-[10.5px] font-medium text-u-ink">{contractor?.name ?? member.contractorId}</p><p className="truncate text-[9px] text-u-muted">{member.role}</p></div>
                  <div className="text-right"><p className="font-mono text-[9.5px] text-u-ink2">{money(member.contractAmountCents, { compact: true })}</p><StatusBadge status={member.status} dot={false} /></div>
                </div>
              );
            })}
            {project.team.length === 0 && <div className="p-3"><EmptyState compact icon={HardHat} title="No contractors assigned" description="Assign licensed contractors from the directory." /></div>}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={Info} title="Project details" subtitle="Scope, reason and access" /></div>
          <div className="space-y-2 p-3">
            <div><p className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">Scope of work</p><p className="mt-0.5 text-[10.5px] leading-relaxed text-u-ink2">{project.description}</p></div>
            <div><p className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">Reason for renovation</p><p className="mt-0.5 text-[10.5px] leading-relaxed text-u-ink2">{project.reason}</p></div>
            <div><p className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">Access requirements</p><p className="mt-0.5 text-[10.5px] leading-relaxed text-u-ink2">{project.accessRequirements || "—"}</p></div>
            {project.utilityShutdowns && <div><p className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">Utility shutdowns</p><p className="mt-0.5 text-[10.5px] leading-relaxed text-u-ink2">{project.utilityShutdowns}</p></div>}
            <div className="rounded-lg border border-u-ink/[0.06] bg-u-ink/[0.02] p-2 text-[9.5px] text-u-muted"><LockKeyhole className="mr-1 inline h-3 w-3" /> Internal: {project.internalNotes}</div>
            <div className="grid grid-cols-2 gap-1.5 text-[9px] text-u-muted"><span>Created by {project.createdBy} · {dateLong(project.createdAt.slice(0, 10))}</span><span className="text-right">Modified by {project.modifiedBy} · {dateLong(project.modifiedAt.slice(0, 10))}</span></div>
          </div>
          {project.status === "On Hold" && (
            <div className="border-t border-u-warn/20 bg-u-warn/[0.05] px-3 py-2">
              <p className="flex items-center gap-1 text-[10px] font-medium text-u-warn"><AlertTriangle className="h-3 w-3" /> On hold — {project.internalNotes.slice(0, 120)}</p>
              <Button size="xs" variant="primary" icon={CheckCircle2} onClick={onStatus} className="mt-1.5">Review & resume</Button>
            </div>
          )}
        </Card>
        <p className="px-1 text-[9px] leading-relaxed text-u-muted"><ShieldAlert className="mr-1 inline h-2.5 w-2.5" /> {checks.allowed ? "Completion requirements satisfied." : `Completion blocked: ${checks.reasons.join("; ")}.`} Financial totals are derived from approved records.</p>
      </div>
    </div>
  );
}

const CameraIcon = Sparkles;

/* ------------------------------- Status modal ------------------------------ */

const statusDescriptions: Record<ProjectStatus, string> = {
  Draft: "Working record. Not yet submitted for approval.",
  Planned: "Scope and budget drafted, awaiting capital approval.",
  Approved: "Approved to proceed. Ready for contractor mobilization.",
  "In Progress": "Works underway. Actual start is captured.",
  "On Hold": "Temporarily paused. A reason is required and all history retained.",
  Completed: "Works complete. Requires inspections and deficiency checks.",
  Cancelled: "Terminal. Financial and audit history remain available.",
};

function StatusModal({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const { transitionProject } = useStore();
  const options = nextStatuses[project.status];
  const [target, setTarget] = useState<ProjectStatus | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const checks = canCompleteProject(project);

  const submit = () => {
    if (!target) return;
    const result = transitionProject(project.id, target, reason || `Status changed to ${target} from ${project.status}.`);
    if (result.ok) { onClose(); setTarget(""); setReason(""); setError(""); }
    else setError(result.error ?? "Unable to change status.");
  };

  return (
    <Modal open={open} onClose={onClose} title="Change project status" description={`Current status: ${project.status}. Valid transitions are controlled by the project lifecycle.`} icon={CalendarCheck} size="md"
      footer={<><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button variant="primary" size="md" icon={Check} disabled={!target} onClick={submit}>Confirm status change</Button></>}>
      <div className="space-y-3">
        {open && project.status === "On Hold" && <InfoNote>Resuming returns the project to In Progress. Record what unblocked the works.</InfoNote>}
        {!target ? (
          options.length === 0 ? (
            <EmptyState icon={LockKeyhole} title="No further transitions" description={`${project.status} is a closed lifecycle state. Create a new project to continue the work.`} />
          ) : (
            <div className="space-y-1.5">
              {options.map((status) => (
                <button key={status} onClick={() => setTarget(status)} className="flex w-full items-center gap-2.5 rounded-lg border border-u-ink/[0.07] bg-u-ink/[0.02] px-3 py-2.5 text-left transition hover:border-u-accent/30 hover:bg-u-accent/[0.04]">
                  <StatusBadge status={status} />
                  <span className="min-w-0 flex-1 text-[10.5px] text-u-muted">{statusDescriptions[status]}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-u-muted" />
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-u-ink/[0.07] bg-u-ink/[0.025] px-3 py-2"><StatusBadge status={project.status} /><ArrowRight className="h-3.5 w-3.5 text-u-muted" /><StatusBadge status={target} /><span className="ml-auto text-[10px] text-u-muted">Req. permission: {target === "Completed" || target === "Cancelled" ? "project.close" : "project.edit"}</span></div>
            {target === "Completed" && (
              <div className="rounded-lg border border-u-ink/[0.07] bg-u-ink/[0.02] p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-u-muted">Completion checks</p>
                <div className="mt-1 space-y-1">
                  <CompletionRow label="Failed inspections corrected & passed" passed={!checks.failedInspectionOutstanding} />
                  <CompletionRow label="Deficiencies resolved & verified" passed={checks.openDeficiencyCount === 0} />
                  <CompletionRow label="Final inspection recorded and passed" passed={!checks.finalInspectionOutstanding} />
                </div>
                {!checks.allowed && <p className="mt-1.5 flex items-start gap-1 text-[9.5px] text-u-warn"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {checks.reasons.join("; ")}</p>}
              </div>
            )}
            <Field label="Reason for change" required={target === "Cancelled" || target === "On Hold"} hint="Recorded with your name and timestamp in the audit trail.">
              <Textarea rows={3} value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder={target === "On Hold" ? "What is blocking the project?" : target === "Completed" ? "Final inspection passed, deficiencies verified…" : "Reason for this transition…"} />
            </Field>
            {error && <InfoNote tone="warning">{error}</InfoNote>}
            <button onClick={() => { setTarget(""); setError(""); }} className="text-[10px] text-u-muted hover:text-u-ink2">← Choose a different status</button>
          </>
        )}
      </div>
    </Modal>
  );
}

function CompletionRow({ label, passed }: { label: string; passed: boolean }) {
  return <div className="flex items-center gap-1.5 text-[10px]">{passed ? <CheckCircle2 className="h-3 w-3 text-u-ok" /> : <X className="h-3 w-3 text-u-danger" />}<span className={passed ? "text-u-ink2" : "text-u-danger/80"}>{label}</span></div>;
}

/* ------------------------------- Edit project ------------------------------ */

function EditProjectModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const { projectById, updateProject, properties } = useStore();
  const project = projectById(projectId);
  const [form, setForm] = useState(() => ({
    name: project?.name ?? "",
    priority: (project?.priority ?? "Normal") as Priority,
    manager: project?.manager ?? "",
    description: project?.description ?? "",
    reason: project?.reason ?? "",
    plannedStart: project?.plannedStart ?? TODAY,
    estimatedCompletion: project?.estimatedCompletion ?? TODAY,
    occupancyStatus: project?.occupancyStatus ?? "Vacant",
    mustVacate: project?.mustVacate ?? false,
    accessRequirements: project?.accessRequirements ?? "",
    internalNotes: project?.internalNotes ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!project) return null;

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Project name is required.";
    if (!form.description.trim()) nextErrors.description = "Scope of work is required.";
    if (form.estimatedCompletion < form.plannedStart) nextErrors.estimatedCompletion = "Completion cannot precede start.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = updateProject(project.id, {
      ...form,
      occupancyStatus: form.occupancyStatus as typeof project.occupancyStatus,
    }, "Project details, schedule and scope updated.");
    if (result.ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit project details" description="Changes are recorded in the audit trail with your name and the current timestamp." icon={Pencil} size="lg"
      footer={<><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button variant="primary" size="md" icon={Check} onClick={submit}>Save changes</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr_1fr]">
          <Field label="Project name" required error={errors.name}><Input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} /></Field>
          <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm((c) => ({ ...c, priority: e.target.value as Priority }))}>{["Low", "Normal", "High", "Emergency"].map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Responsible person"><Select value={form.manager} onChange={(e) => setForm((c) => ({ ...c, manager: e.target.value }))}>{["Avery Chen", "Marcus Reed", "Priya Nair", "Jordan Ellis"].map((m) => <option key={m}>{m}</option>)}</Select></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Property"><Input value={`${project.propertyName} · Unit ${project.unitNumber}`} disabled /></Field>
          <Field label="Planned start"><Input type="date" value={form.plannedStart} onChange={(e) => setForm((c) => ({ ...c, plannedStart: e.target.value }))} /></Field>
          <Field label="Estimated completion" error={errors.estimatedCompletion}><Input type="date" value={form.estimatedCompletion} onChange={(e) => setForm((c) => ({ ...c, estimatedCompletion: e.target.value }))} /></Field>
        </div>
        <Field label="Scope of work" required error={errors.description}><Textarea rows={3} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} /></Field>
        <Field label="Reason for renovation"><Input value={form.reason} onChange={(e) => setForm((c) => ({ ...c, reason: e.target.value }))} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Occupancy status"><Select value={form.occupancyStatus} onChange={(e) => setForm((c) => ({ ...c, occupancyStatus: e.target.value as typeof form.occupancyStatus }))}>{["Vacant", "Occupied", "Vacating", "Ready for rent"].map((o) => <option key={o}>{o}</option>)}</Select></Field>
          <Field label="Access requirements"><Input value={form.accessRequirements} onChange={(e) => setForm((c) => ({ ...c, accessRequirements: e.target.value }))} /></Field>
        </div>
        <Field label="Internal notes"><Textarea rows={2} value={form.internalNotes} onChange={(e) => setForm((c) => ({ ...c, internalNotes: e.target.value }))} /></Field>
        <p className="flex items-start gap-1 text-[9.5px] text-u-muted"><Info className="mt-0.5 h-3 w-3 shrink-0" /> Property and unit records cannot be changed after creation; financial fields are managed through change orders. Reported against {properties.length} property records.</p>
      </div>
    </Modal>
  );
}
