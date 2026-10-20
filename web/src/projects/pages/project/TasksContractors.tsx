import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileImage,
  GripVertical,
  HardHat,
  Info,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Star,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { useStore } from "../../lib/store";
import { dateLong, daysBetween, money, parseMoneyToCents, TODAY } from "../../lib/finance";
import type { Contractor, Priority, Project, ProjectTeamMember, TaskStatus, WorkCategory } from "../../lib/types";
import { Avatar, Badge, Button, Card, EmptyState, Field, InfoNote, Input, Modal, ProgressBar, SectionHeader, Select, StatusBadge, Textarea, Switch, ToneIcon } from "../../components/ui";
import { cn } from "../../utils/cn";

const workCategories: WorkCategory[] = ["Demolition", "Electrical", "Plumbing", "Painting", "Flooring", "Kitchen", "Bathroom", "Cleanup", "Inspection", "General"];
const taskStatuses: TaskStatus[] = ["Not Started", "In Progress", "Blocked", "Completed"];
const priorities: Priority[] = ["Low", "Normal", "High", "Emergency"];

const categoryTone: Record<string, string> = {
  Demolition: "text-u-danger border-u-danger/20 bg-u-danger/[0.07]",
  Electrical: "text-u-warn border-u-warn/20 bg-u-warn/[0.07]",
  Plumbing: "text-u-blue border-u-blue/20 bg-u-blue/[0.07]",
  Painting: "text-u-violet border-u-violet/20 bg-u-violet/[0.07]",
  Flooring: "text-u-warn border-u-warn/20 bg-u-warn/[0.07]",
  Kitchen: "text-u-accent border-u-accent/20 bg-u-accent/[0.07]",
  Bathroom: "text-u-ok border-u-ok/20 bg-u-ok/[0.07]",
  Cleanup: "text-u-ink2 border-u-ink/10 bg-u-ink/[0.04]",
  Inspection: "text-u-ok border-u-ok/20 bg-u-ok/[0.07]",
  General: "text-u-ink2 border-u-ink/10 bg-u-ink/[0.04]",
};

export function TasksTab({ project }: { project: Project }) {
  const { setTaskStatus, reorderTask, can } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(project.tasks[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<"All" | TaskStatus>("All");

  const tasks = project.tasks.filter((task) => statusFilter === "All" || task.status === statusFilter);
  const completed = project.tasks.filter((task) => task.status === "Completed").length;
  const inProgress = project.tasks.filter((task) => task.status === "In Progress").length;
  const blocked = project.tasks.filter((task) => task.status === "Blocked").length;
  const est = project.tasks.reduce((sum, task) => sum + task.estimatedCostCents, 0);
  const actual = project.tasks.reduce((sum, task) => sum + task.actualCostCents, 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3 p-3.5">
          <ToneIcon icon={ClipboardList} tone="acid" />
          <div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Tasks complete</p><p className="font-mono text-[17px] text-u-ink">{completed}<span className="text-u-muted">/{project.tasks.length}</span></p><ProgressBar value={project.tasks.length ? (completed / project.tasks.length) * 100 : 0} height="h-1" className="mt-1" /></div>
        </Card>
        <Card className="flex items-center gap-3 p-3.5">
          <ToneIcon icon={Wrench} tone="sky" />
          <div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">In progress</p><p className="font-mono text-[17px] text-u-ink">{inProgress}</p><p className="text-[9.5px] text-u-muted">Active work packages</p></div>
        </Card>
        <Card className="flex items-center gap-3 p-3.5">
          <ToneIcon icon={Ban} tone="rose" />
          <div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Blocked</p><p className="font-mono text-[17px] text-u-danger">{blocked}</p><p className="text-[9.5px] text-u-muted">Needs intervention</p></div>
        </Card>
        <Card className="flex items-center gap-3 p-3.5">
          <ToneIcon icon={CircleDollarSign} tone="amber" />
          <div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Task cost to date</p><p className="font-mono text-[17px] text-u-ink">{money(actual, { compact: true })}</p><p className="text-[9.5px] text-u-muted">of {money(est, { compact: true })} estimated</p></div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3">
          <SectionHeader icon={ClipboardList} title="Scope of work & tasks" subtitle="Work packages, dependencies and completion evidence" />
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="pj-no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-lg border border-u-ink/[0.07] p-0.5">
              {(["All", ...taskStatuses] as const).map((status) => (
                <button key={status} onClick={() => setStatusFilter(status)} className={cn("whitespace-nowrap rounded px-2 py-1 text-[10px] transition", statusFilter === status ? "bg-u-ink/[0.09] text-u-ink" : "text-u-muted hover:text-u-ink2")}>
                  {status}
                </button>
              ))}
            </div>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setAddOpen(true)} disabled={!can("project.edit")}>Add task</Button>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="p-4"><EmptyState icon={ClipboardList} title="No tasks in this view" description="Add the work packages for this renovation, assign a contractor and define dependencies." action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>Add first task</Button>} /></div>
        ) : (
          <div className="divide-y divide-u-ink/[0.05]">
            {tasks.map((task, index) => {
              const contractor = project.team.find((member) => member.contractorId === task.contractorId);
              const dependencies = project.tasks.filter((t) => task.dependencies.includes(t.id));
              const isOpen = expanded === task.id;
              const overdue = task.status !== "Completed" && task.plannedFinish < TODAY;
              return (
                <div key={task.id} className="transition hover:bg-u-ink/[0.015]">
                  <div className="flex flex-wrap items-start gap-2 px-3 py-2.5 sm:px-4">
                    <div className="flex flex-col items-center gap-0.5 pt-0.5">
                      <button onClick={() => reorderTask(project.id, task.id, -1)} disabled={index === 0} aria-label="Move task up" className="text-u-muted transition hover:text-u-ink2 disabled:opacity-25"><ArrowUp className="h-3 w-3" /></button>
                      <GripVertical className="h-3 w-3 text-u-muted" />
                      <button onClick={() => reorderTask(project.id, task.id, 1)} disabled={index === tasks.length - 1} aria-label="Move task down" className="text-u-muted transition hover:text-u-ink2 disabled:opacity-25"><ArrowDown className="h-3 w-3" /></button>
                    </div>
                    <button onClick={() => setExpanded(isOpen ? null : task.id)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                      <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", task.status === "Completed" ? "border-u-accent/30 bg-u-accent/15 text-u-accent" : "border-u-ink/10 bg-u-ink/[0.04] text-u-muted")}>
                        {task.status === "Completed" ? <Check className="h-3.5 w-3.5" /> : <span className="font-mono text-[9px]">{String(index + 1).padStart(2, "0")}</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={cn("text-[12px] font-semibold", task.status === "Completed" ? "text-u-muted line-through decoration-u-line2" : "text-u-ink")}>{task.name}</span>
                          <span className={cn("rounded border px-1 text-[8.5px] font-medium", categoryTone[task.category])}>{task.category}</span>
                          {task.priority === "Emergency" && <Badge tone="rose" dot>Emergency</Badge>}
                          {task.priority === "High" && <Badge tone="amber" dot>High</Badge>}
                          {task.inspectionRequired && <span className="flex items-center gap-0.5 rounded border border-u-ok/20 bg-u-ok/[0.06] px-1 text-[8.5px] text-u-ok"><ShieldCheck className="h-2.5 w-2.5" /> Inspection</span>}
                          {(task.beforePhoto || task.afterPhoto) && <FileImage className="h-3 w-3 text-u-muted" />}
                          {overdue && <span className="flex items-center gap-0.5 text-[9px] text-u-danger"><AlertTriangle className="h-2.5 w-2.5" /> Overdue</span>}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] text-u-muted">
                          <span className="font-mono text-u-muted">{task.id.split("-").slice(-1)}</span>
                          <span className="flex items-center gap-1"><UserRound className="h-2.5 w-2.5" /> {task.assigneeName}</span>
                          <span className="flex items-center gap-1"><CalendarDays className="h-2.5 w-2.5" /> {dateLong(task.plannedStart)} → {dateLong(task.plannedFinish)}</span>
                          {dependencies.length > 0 && <span className="flex items-center gap-1"><Link2 className="h-2.5 w-2.5" /> {dependencies.length} dependenc{dependencies.length > 1 ? "ies" : "y"}</span>}
                        </span>
                      </span>
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="hidden text-right sm:block">
                        <p className="font-mono text-[10px] text-u-ink2">{money(task.actualCostCents, { compact: true })}<span className="text-u-muted"> / {money(task.estimatedCostCents, { compact: true })}</span></p>
                        <p className="text-[8.5px] text-u-muted">{task.plannedFinish < TODAY && task.status !== "Completed" ? "Past due" : "Planned finish"} {dateLong(task.plannedFinish)}</p>
                      </div>
                      <Select
                        value={task.status}
                        onChange={(event) => setTaskStatus(project.id, task.id, event.target.value as TaskStatus)}
                        className={cn("h-7 w-[112px] text-[10px]", task.status === "Blocked" && "border-u-danger/30 text-u-danger", task.status === "Completed" && "border-u-ok/25 text-u-ok")}
                        aria-label={`Status for ${task.name}`}
                      >
                        {taskStatuses.map((status) => <option key={status}>{status}</option>)}
                      </Select>
                      <button onClick={() => setExpanded(isOpen ? null : task.id)} aria-label="Toggle task detail" className="flex h-7 w-7 items-center justify-center rounded-md text-u-muted hover:bg-u-ink/[0.05] hover:text-u-ink">
                        <ChevronDown className={cn("h-3.5 w-3.5 transition", isOpen && "rotate-180")} />
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="animate-ap-slide-up border-t border-u-ink/[0.04] bg-u-ink/[0.012] px-4 py-3 sm:pl-14">
                      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
                        <div className="space-y-2">
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-u-muted">Description</p>
                            <p className="mt-0.5 text-[11.5px] leading-relaxed text-u-ink2">{task.description}</p>
                          </div>
                          {task.completionNotes && (
                            <div className="rounded-lg border border-u-ink/[0.06] bg-u-bg/60 p-2.5">
                              <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-u-muted"><Sparkles className="h-3 w-3 text-u-accent/80" /> Completion notes</p>
                              <p className="mt-1 text-[11px] leading-relaxed text-u-ink2">{task.completionNotes}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <TaskMeta label="Actual start" value={dateLong(task.actualStart)} />
                            <TaskMeta label="Actual finish" value={dateLong(task.actualFinish)} />
                            <TaskMeta label="Contractor" value={contractor ? `${contractor.role}` : task.assigneeName} />
                            <TaskMeta label="Dependencies" value={dependencies.length ? dependencies.map((d) => d.name).join(", ") : "None"} />
                            <TaskMeta label="Created" value={`${task.createdBy} · ${dateLong(task.createdAt.slice(0, 10))}`} />
                            <TaskMeta label="Modified" value={`${task.modifiedBy} · ${dateLong(task.modifiedAt.slice(0, 10))}`} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Before", url: task.beforePhoto, icon: FileImage },
                            { label: "After / reference", url: task.afterPhoto, icon: FileImage },
                          ].map((photo) => (
                            <div key={photo.label} className="overflow-hidden rounded-lg border border-u-ink/[0.07]">
                              {photo.url ? (
                                <img src={photo.url} alt={`${task.name} ${photo.label}`} className="h-[92px] w-full object-cover" loading="lazy" />
                              ) : (
                                <div className="pj-dot-grid flex h-[92px] items-center justify-center bg-u-bg/60"><photo.icon className="h-4 w-4 text-u-muted" /></div>
                              )}
                              <div className="flex items-center justify-between bg-u-bg/80 px-2 py-1">
                                <span className="text-[8.5px] uppercase tracking-wide text-u-muted">{photo.label}</span>
                                <Badge tone={photo.url ? "aqua" : "slate"}>{photo.url ? "1 file" : "None"}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-u-ink/[0.06] bg-u-ink/[0.012] px-4 py-2 text-[9.5px] text-u-muted">
          <span className="flex items-center gap-1"><Info className="h-3 w-3" /> Completed tasks retain their completion dates, notes and photos. Dependencies must be complete before a task can close.</span>
          <span className="font-mono">{project.tasks.length} work packages</span>
        </div>
      </Card>

      <AddTaskModal open={addOpen} onClose={() => setAddOpen(false)} project={project} />
    </div>
  );
}

function TaskMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-u-ink/[0.05] bg-u-ink/[0.02] px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-[0.08em] text-u-muted">{label}</p>
      <p className="mt-0.5 truncate text-[10px] text-u-ink2">{value}</p>
    </div>
  );
}

function AddTaskModal({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const { addTask, contractors } = useStore();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "General" as WorkCategory,
    contractorId: project.team[0]?.contractorId ?? "",
    assigneeName: "",
    plannedStart: project.plannedStart,
    plannedFinish: project.estimatedCompletion,
    estimatedCost: "",
    priority: "Normal" as Priority,
    dependencies: [] as string[],
    inspectionRequired: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Task name is required.";
    if (!form.plannedStart || !form.plannedFinish) nextErrors.plannedFinish = "Planned dates are required.";
    if (form.plannedFinish < form.plannedStart) nextErrors.plannedFinish = "Finish must be on or after start.";
    if (form.estimatedCost && parseMoneyToCents(form.estimatedCost) < 0) nextErrors.estimatedCost = "Cost cannot be negative.";
    if (!form.contractorId && !form.assigneeName.trim()) nextErrors.contractorId = "Assign a contractor or worker.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const contractor = contractors.find((c) => c.id === form.contractorId);
    const result = addTask(project.id, {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      assigneeType: contractor ? "Contractor" : "Internal",
      contractorId: form.contractorId || undefined,
      assigneeName: form.assigneeName.trim() || contractor?.name || "Unassigned",
      plannedStart: form.plannedStart,
      plannedFinish: form.plannedFinish,
      estimatedCostCents: parseMoneyToCents(form.estimatedCost),
      actualCostCents: 0,
      status: "Not Started",
      priority: form.priority,
      dependencies: form.dependencies,
      inspectionRequired: form.inspectionRequired,
    });
    if (result.ok) {
      onClose();
      setForm({ ...form, name: "", description: "", estimatedCost: "", dependencies: [], inspectionRequired: false });
    } else setErrors({ form: result.error ?? "Unable to add task." });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add work package"
      description="Tasks define the scope, assignee, schedule and cost estimate for the project."
      icon={ClipboardList}
      footer={<><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button variant="primary" size="md" icon={Plus} onClick={submit}>Add task</Button></>}
    >
      <div className="space-y-3">
        {errors.form && <InfoNote tone="warning">{errors.form}</InfoNote>}
        <Field label="Task name" required error={errors.name}><Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Bathroom tile & fixtures" /></Field>
        <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Scope, materials and expectations…" /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Work category"><Select value={form.category} onChange={(e) => set("category", e.target.value as WorkCategory)}>{workCategories.map((category) => <option key={category}>{category}</option>)}</Select></Field>
          <Field label="Assigned contractor / worker" error={errors.contractorId}>
            <Select value={form.contractorId} onChange={(e) => set("contractorId", e.target.value)}>
              <option value="">Internal / unassigned</option>
              {contractors.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Worker (optional)"><Input value={form.assigneeName} onChange={(e) => set("assigneeName", e.target.value)} placeholder="Named worker on site" /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Planned start" required><Input type="date" value={form.plannedStart} onChange={(e) => set("plannedStart", e.target.value)} /></Field>
          <Field label="Planned finish" required error={errors.plannedFinish}><Input type="date" value={form.plannedFinish} onChange={(e) => set("plannedFinish", e.target.value)} /></Field>
          <Field label="Estimated cost (CAD)" error={errors.estimatedCost}><Input inputMode="decimal" value={form.estimatedCost} onChange={(e) => set("estimatedCost", e.target.value)} placeholder="0" /></Field>
          <Field label="Priority"><Select value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>{priorities.map((p) => <option key={p}>{p}</option>)}</Select></Field>
        </div>
        <Field label="Dependencies" hint="Predecessor tasks that must complete first.">
          <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-u-ink/[0.07] bg-u-bg/60 p-2">
            {project.tasks.length === 0 && <p className="text-[10.5px] text-u-muted">No existing tasks — this is the first work package.</p>}
            {project.tasks.map((task) => (
              <label key={task.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[11px] text-u-ink2 hover:bg-u-ink/[0.04]">
                <input
                  type="checkbox"
                  className="h-3 w-3 accent-u-accent"
                  checked={form.dependencies.includes(task.id)}
                  onChange={(e) => set("dependencies", e.target.checked ? [...form.dependencies, task.id] : form.dependencies.filter((id) => id !== task.id))}
                />
                <span className="truncate">{task.name}</span>
                <StatusBadge status={task.status} dot={false} className="ml-auto" />
              </label>
            ))}
          </div>
        </Field>
        <div className="rounded-lg border border-u-ink/[0.06] bg-u-ink/[0.02] px-3 py-2">
          <Switch checked={form.inspectionRequired} onChange={(checked) => set("inspectionRequired", checked)} label="Inspection required before this task can complete" />
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------- Contractors tab ---------------------------- */

export function ContractorsTab({ project }: { project: Project }) {
  const { contractors } = useStore();
  const [assignOpen, setAssignOpen] = useState(false);
  const committed = project.team.filter((m) => m.status === "Active" || m.status === "Assigned").reduce((sum, m) => sum + m.contractAmountCents, 0);
  const complianceIssues = project.team
    .map((member) => ({ member, contractor: contractors.find((c) => c.id === member.contractorId) }))
    .filter((entry): entry is { member: ProjectTeamMember; contractor: Contractor } => !!entry.contractor)
    .map((entry) => {
      const insuranceDays = daysBetween(TODAY, entry.contractor.insuranceExpiry);
      const wsibDays = daysBetween(TODAY, entry.contractor.wsibExpiry);
      return { ...entry, insuranceDays, wsibDays };
    })
    .filter((entry) => entry.insuranceDays < 45 || entry.wsibDays < 45 || !entry.contractor.active);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={HardHat} tone="acid" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Assigned team</p><p className="font-mono text-[17px] text-u-ink">{project.team.length}</p><p className="text-[9.5px] text-u-muted">Contractors & trades</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={CircleDollarSign} tone="aqua" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Committed value</p><p className="font-mono text-[17px] text-u-ink">{money(committed)}</p><p className="text-[9.5px] text-u-muted">Active assignments</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={Users} tone="sky" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Workers on site</p><p className="font-mono text-[17px] text-u-ink">{project.team.reduce((sum, m) => sum + (contractors.find((c) => c.id === m.contractorId)?.workers.length ?? 0), 0)}</p><p className="text-[9.5px] text-u-muted">Under contracted firms</p></div></Card>
        <Card className={cn("flex items-center gap-3 p-3.5", complianceIssues.length && "border-u-warn/20")}><ToneIcon icon={complianceIssues.length ? ShieldX : ShieldCheck} tone={complianceIssues.length ? "amber" : "acid"} /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Compliance alerts</p><p className={cn("font-mono text-[17px]", complianceIssues.length ? "text-u-warn" : "text-u-accent")}>{complianceIssues.length}</p><p className="text-[9.5px] text-u-muted">Insurance / WSIB</p></div></Card>
      </div>

      {complianceIssues.length > 0 && (
        <InfoNote tone="warning">
          <span className="font-medium">Compliance review:</span>{" "}
          {complianceIssues.map((entry) => `${entry.contractor.name} — ${entry.contractor.insuranceExpiry < TODAY ? "insurance expired" : entry.insuranceDays <= 45 ? `insurance expires in ${entry.insuranceDays} days` : entry.contractor.wsibExpiry < TODAY ? "WSIB expired" : `WSIB expires in ${entry.wsibDays} days`}`).join("; ")}. Do not award new work until updated certificates are on file.
        </InfoNote>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3">
          <SectionHeader icon={HardHat} title="Project contractors & assignments" subtitle="Reusable directory records — one contractor may serve many projects" />
          <div className="flex items-center gap-1.5">
            <Badge tone="slate">{contractors.filter((c) => c.active).length} active directory</Badge>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setAssignOpen(true)}>Assign contractor</Button>
          </div>
        </div>
        {project.team.length === 0 ? (
          <div className="p-4"><EmptyState icon={HardHat} title="No contractors assigned" description="Assign licensed trades from the reusable contractor directory, with contract amount, role and dates." action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setAssignOpen(true)}>Assign contractor</Button>} /></div>
        ) : (
          <div className="grid gap-3 p-3 lg:grid-cols-2">
            {project.team.map((member) => {
              const contractor = contractors.find((c) => c.id === member.contractorId);
              if (!contractor) return null;
              const insuranceDays = daysBetween(TODAY, contractor.insuranceExpiry);
              return (
                <div key={member.id} className="rounded-xl border border-u-ink/[0.07] bg-u-ink/[0.02] p-3">
                  <div className="flex items-start gap-2.5">
                    <Avatar name={contractor.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[12.5px] font-semibold text-u-ink">{contractor.name}</p>
                        <StatusBadge status={member.status} />
                        {!contractor.active && <Badge tone="rose">Inactive</Badge>}
                      </div>
                      <p className="mt-0.5 text-[10px] text-u-muted">{contractor.trade} · {contractor.pricingModel}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-u-muted">
                        <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {contractor.phone}</span>
                        <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {contractor.email}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[12px] text-u-ink">{money(member.contractAmountCents)}</p>
                      <p className="text-[8.5px] text-u-muted">Contract value</p>
                    </div>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                    <div className="rounded-md bg-u-ink/[0.03] px-2 py-1"><p className="text-[8px] uppercase tracking-wide text-u-muted">Assigned role</p><p className="truncate text-[10px] text-u-ink">{member.role}</p></div>
                    <div className="rounded-md bg-u-ink/[0.03] px-2 py-1"><p className="text-[8px] uppercase tracking-wide text-u-muted">Assignment dates</p><p className="text-[10px] text-u-ink">{dateLong(member.startDate)} → {dateLong(member.endDate)}</p></div>
                  </div>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-u-muted">{member.responsibilities}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-u-ink/[0.05] pt-2">
                    <Badge tone={insuranceDays < 0 ? "rose" : insuranceDays <= 45 ? "amber" : "aqua"} icon={insuranceDays < 45 ? AlertTriangle : ShieldCheck}>Insurance {dateLong(contractor.insuranceExpiry)}</Badge>
                    <Badge tone={contractor.wsibExpiry < TODAY ? "rose" : "slate"} icon={ShieldCheck}>WSIB {contractor.wsibExpiry}</Badge>
                    <span className="flex items-center gap-1 text-[9.5px] text-u-warn/80"><Star className="h-2.5 w-2.5 fill-u-warn/70" /> {contractor.rating.toFixed(1)}</span>
                    <span className="ml-auto flex items-center gap-1 text-[9px] text-u-muted"><MapPin className="h-2.5 w-2.5" /> {contractor.address.split(",")[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-u-ink/[0.06] bg-u-ink/[0.012] px-4 py-2 text-[9.5px] text-u-muted">
          <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> License, insurance and WSIB records are validated from the contractor directory at assignment.</span>
          <span>{project.team.reduce((sum, m) => sum + (contractors.find((c) => c.id === m.contractorId)?.workers.length ?? 0), 0)} workers under contract</span>
        </div>
      </Card>

      <AssignContractorModal open={assignOpen} onClose={() => setAssignOpen(false)} project={project} />
    </div>
  );
}

function AssignContractorModal({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const { contractors, assignContractor } = useStore();
  const available = contractors.filter((c) => !project.team.some((m) => m.contractorId === c.id) || true);
  const [form, setForm] = useState({
    contractorId: "",
    role: "",
    responsibilities: "",
    contractAmount: "",
    startDate: project.plannedStart,
    endDate: project.estimatedCompletion,
    workerName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const contractor = contractors.find((c) => c.id === form.contractorId);

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.contractorId) nextErrors.contractorId = "Select a contractor from the directory.";
    if (!form.role.trim()) nextErrors.role = "Record the role on this project.";
    if (parseMoneyToCents(form.contractAmount) <= 0) nextErrors.contractAmount = "Enter the agreed contract amount.";
    if (form.endDate < form.startDate) nextErrors.endDate = "End date cannot precede the start date.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = assignContractor(project.id, {
      contractorId: form.contractorId,
      role: form.role.trim(),
      responsibilities: form.responsibilities.trim(),
      contractAmountCents: parseMoneyToCents(form.contractAmount),
      startDate: form.startDate,
      endDate: form.endDate,
      status: "Assigned",
      workerName: form.workerName || undefined,
    });
    if (result.ok) {
      onClose();
      setForm({ ...form, contractorId: "", role: "", responsibilities: "", contractAmount: "" });
    } else setErrors({ form: result.error ?? "Unable to assign contractor." });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign contractor"
      description="Assignments reference an existing contractor record. The agreed contract value becomes a committed cost on this project."
      icon={HardHat}
      footer={<><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button variant="primary" size="md" icon={Check} onClick={submit}>Assign to project</Button></>}
    >
      <div className="space-y-3">
        {errors.form && <InfoNote tone="warning">{errors.form}</InfoNote>}
        <Field label="Contractor" required error={errors.contractorId}>
          <Select value={form.contractorId} onChange={(e) => { setForm((c) => ({ ...c, contractorId: e.target.value })); setErrors((c) => ({ ...c, contractorId: "" })); }}>
            <option value="">Select contractor…</option>
            {available.map((c) => <option key={c.id} value={c.id} disabled={!c.active}>{c.name} — {c.trade}{!c.active ? " (inactive)" : ""}</option>)}
          </Select>
        </Field>
        {contractor && (
          <div className="rounded-lg border border-u-ink/[0.07] bg-u-ink/[0.025] p-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-u-muted">
              <Badge tone={contractor.active ? "acid" : "rose"}>{contractor.active ? "Active" : "Inactive"}</Badge>
              <span>{contractor.pricingModel}</span><span className="text-u-muted">·</span><span>{contractor.agreedRate}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone={daysBetween(TODAY, contractor.insuranceExpiry) <= 45 ? "amber" : "aqua"}>Insurance {contractor.insuranceExpiry}</Badge>
              <Badge tone={contractor.wsibExpiry < TODAY ? "rose" : "slate"}>WSIB {contractor.wsibExpiry}</Badge>
              <Badge tone="slate">{contractor.license}</Badge>
            </div>
            {contractor.workers.length > 0 && <p className="mt-1.5 text-[9.5px] text-u-muted">Workers: {contractor.workers.map((w) => w.name).join(", ")}</p>}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project role" required error={errors.role}><Input value={form.role} onChange={(e) => setForm((c) => ({ ...c, role: e.target.value }))} placeholder="e.g. General contractor" /></Field>
          <Field label="Contract amount (CAD)" required error={errors.contractAmount}><Input inputMode="decimal" value={form.contractAmount} onChange={(e) => setForm((c) => ({ ...c, contractAmount: e.target.value }))} placeholder="22,500" /></Field>
        </div>
        <Field label="Responsibilities"><Textarea rows={2} value={form.responsibilities} onChange={(e) => setForm((c) => ({ ...c, responsibilities: e.target.value }))} placeholder="Scope they are accountable for…" /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Start date"><Input type="date" value={form.startDate} onChange={(e) => setForm((c) => ({ ...c, startDate: e.target.value }))} /></Field>
          <Field label="End date" error={errors.endDate}><Input type="date" value={form.endDate} onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value }))} /></Field>
          <Field label="Named worker (optional)"><Select value={form.workerName} onChange={(e) => setForm((c) => ({ ...c, workerName: e.target.value }))}><option value="">Company / crew</option>{contractor?.workers.map((worker) => <option key={worker.name}>{worker.name}</option>)}</Select></Field>
        </div>
      </div>
    </Modal>
  );
}
