import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CURRENT_USER,
  contractors as seedContractors,
  projects as seedProjects,
  properties as seedProperties,
} from "../lib/data";
import {
  canCompleteProject,
  dateLong,
  invoiceBalance,
  invoiceTotal,
  nextStatuses,
  parseMoneyToCents,
  TODAY,
} from "../lib/finance";
import type {
  ActivityEntry,
  ApprovalStatus,
  ChangeOrder,
  Contractor,
  Expense,
  Inspection,
  Invoice,
  InvoiceLine,
  Milestone,
  Payment,
  Project,
  ProjectDocument,
  ProjectDraft,
  ProjectStatus,
  ProjectTeamMember,
  Property,
  Task,
  TaskStatus,
} from "../lib/types";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: "success" | "error" | "info" | "warning";
}

interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

interface StoreValue {
  projects: Project[];
  contractors: Contractor[];
  properties: Property[];
  toasts: Toast[];
  user: typeof CURRENT_USER;
  can: (permission: string) => boolean;
  notify: (title: string, tone?: Toast["tone"], description?: string) => void;
  dismissToast: (id: string) => void;
  projectById: (id: string) => Project | undefined;
  propertyById: (id: string) => Property | undefined;
  unitForProject: (project: Project) => Property["units"][number] | undefined;
  createProject: (draft: ProjectDraft) => ActionResult;
  updateProject: (id: string, patch: Partial<Project>, detail: string) => ActionResult;
  transitionProject: (id: string, status: ProjectStatus, reason: string) => ActionResult;
  toggleArchive: (id: string, archived: boolean) => void;
  addTask: (projectId: string, task: Omit<Task, "id" | "projectId" | "createdAt" | "createdBy" | "modifiedAt" | "modifiedBy">) => ActionResult;
  setTaskStatus: (projectId: string, taskId: string, status: TaskStatus) => ActionResult;
  reorderTask: (projectId: string, taskId: string, direction: -1 | 1) => void;
  addExpense: (projectId: string, expense: Omit<Expense, "id" | "projectId" | "createdAt" | "createdBy">) => ActionResult;
  setExpenseApproval: (projectId: string, expenseId: string, approval: ApprovalStatus) => void;
  findDuplicateInvoice: (vendorId: string, number: string) => Invoice | undefined;
  addInvoice: (projectId: string, invoice: Omit<Invoice, "id" | "projectId" | "createdAt" | "createdBy">) => ActionResult;
  setInvoiceApproval: (projectId: string, invoiceId: string, approval: ApprovalStatus) => void;
  recordPayment: (projectId: string, payment: Omit<Payment, "id" | "projectId" | "createdAt" | "recordedBy">) => ActionResult;
  addChangeOrder: (projectId: string, co: Omit<ChangeOrder, "id" | "projectId">) => ActionResult;
  decideChangeOrder: (projectId: string, changeOrderId: string, approve: boolean, reason?: string) => ActionResult;
  addDocument: (projectId: string, document: Omit<ProjectDocument, "id" | "uploadDate" | "uploader">) => ActionResult;
  setMilestoneStatus: (projectId: string, milestoneId: string, status: Milestone["status"]) => void;
  addInspection: (projectId: string, inspection: Omit<Inspection, "id">) => ActionResult;
  resolveDeficiency: (projectId: string, deficiencyId: string, notes: string) => ActionResult;
  assignContractor: (projectId: string, assignment: Omit<ProjectTeamMember, "id">) => ActionResult;
  approveReadiness: (projectId: string) => ActionResult;
}

const StoreContext = createContext<StoreValue | null>(null);

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const stamp = () => `${TODAY}T${new Date().toTimeString().slice(0, 5)}:00`;

const cloneProjects = (): Project[] => JSON.parse(JSON.stringify(seedProjects)) as Project[];

const activity = (projectId: string, actor: string, action: string, detail: string, kind: ActivityEntry["kind"]): ActivityEntry => ({
  id: uid("ACT"),
  projectId,
  at: stamp(),
  actor,
  action,
  detail,
  kind,
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(cloneProjects);
  const [contractors] = useState<Contractor[]>(seedContractors);
  const [properties, setProperties] = useState<Property[]>(seedProperties);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((title: string, tone: Toast["tone"] = "success", description?: string) => {
    const id = uid("TST");
    setToasts((current) => [...current, { id, title, description, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const can = useCallback((permission: string) => CURRENT_USER.permissions.includes(permission), []);

  const projectById = useCallback((id: string) => projects.find((p) => p.id === id), [projects]);

  const propertyById = useCallback((id: string) => properties.find((p) => p.id === id), [properties]);

  const unitForProject = useCallback(
    (project: Project) => properties.find((p) => p.id === project.propertyId)?.units.find((u) => u.id === project.unitId),
    [properties],
  );

  const mutateProject = useCallback((id: string, fn: (project: Project) => Project) => {
    setProjects((current) => current.map((p) => (p.id === id ? { ...fn(p), modifiedAt: stamp(), modifiedBy: CURRENT_USER.name } : p)));
  }, []);

  const createProject = useCallback(
    (draft: ProjectDraft): ActionResult => {
      if (!can("project.create")) return { ok: false, error: "You do not have permission to create projects." };
      if (!draft.name.trim()) return { ok: false, error: "A project name is required." };
      if (!draft.description.trim()) return { ok: false, error: "A scope of work is required before approval." };
      const property = properties.find((p) => p.id === draft.propertyId);
      const unit = property?.units.find((u) => u.id === draft.unitId);
      if (!property || !unit) return { ok: false, error: "Select an existing property and unit." };
      if (!draft.plannedStart || !draft.estimatedCompletion) return { ok: false, error: "Planned start and estimated completion are required." };
      if (draft.estimatedCompletion < draft.plannedStart) return { ok: false, error: "Estimated completion cannot be before the planned start." };
      if (parseMoneyToCents(draft.originalBudget) <= 0 && draft.originalBudget.trim() !== "0")
        return { ok: false, error: "Enter a valid original budget." };

      const year = new Date(`${draft.plannedStart}T12:00:00`).getFullYear();
      const highest = Math.max(1000, ...projects.map((p) => Number.parseInt(p.id.replace(/\D/g, ""), 10) || 0));
      const id = `PRJ-${highest + 1}`;
      const now = stamp();
      const start = draft.plannedStart;
      const end = draft.estimatedCompletion;
      const templates: { name: string; requiresInspection: boolean }[] = [
        { name: "Project approved", requiresInspection: false },
        { name: "Contractor confirmed", requiresInspection: false },
        { name: "Materials delivered", requiresInspection: false },
        { name: "Rough-in work completed", requiresInspection: true },
        { name: "Installation completed", requiresInspection: false },
        { name: "Final inspection completed", requiresInspection: true },
        { name: "Unit ready for occupancy", requiresInspection: true },
      ];
      const span = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000));
      const milestones: Milestone[] = templates.map((t, index) => {
        const offset = Math.round((span * index) / (templates.length - 1));
        const planned = new Date(`${start}T12:00:00`);
        planned.setDate(planned.getDate() + offset);
        return {
          id: `${id}-MS-${index + 1}`,
          projectId: id,
          name: t.name,
          description: "",
          plannedDate: planned.toISOString().slice(0, 10),
          status: "Pending",
          responsible: draft.manager,
          notes: "",
          requiresInspection: t.requiresInspection,
        };
      });

      const project: Project = {
        id,
        name: draft.name.trim(),
        propertyId: property.id,
        propertyName: property.name,
        unitId: unit.id,
        unitNumber: unit.number,
        type: draft.type,
        description: draft.description.trim(),
        reason: draft.reason.trim(),
        priority: draft.priority,
        status: "Draft",
        manager: draft.manager,
        createdBy: CURRENT_USER.name,
        createdAt: now,
        modifiedBy: CURRENT_USER.name,
        modifiedAt: now,
        plannedStart: draft.plannedStart,
        estimatedCompletion: draft.estimatedCompletion,
        occupancyStatus: draft.occupancyStatus,
        mustVacate: draft.mustVacate,
        tenantNotifications: [],
        accessRequirements: draft.accessRequirements,
        expectedReadyDate: draft.estimatedCompletion,
        utilityShutdowns: "",
        lostRentCents: 0,
        readinessApproved: false,
        originalBudgetCents: parseMoneyToCents(draft.originalBudget),
        contingencyCents: parseMoneyToCents(draft.contingency),
        internalNotes: draft.internalNotes,
        archived: false,
        tasks: [],
        team: [],
        expenses: [],
        invoices: [],
        payments: [],
        changeOrders: [],
        quotes: [],
        purchaseOrders: [],
        milestones,
        inspections: [],
        deficiencies: [],
        documents: [],
        activity: [
          {
            id: uid("ACT"),
            projectId: id,
            at: now,
            actor: CURRENT_USER.name,
            action: "Project created",
            detail: `Draft created for ${property.name} · Unit ${unit.number}. ${year} capital project.`,
            kind: "created",
          },
        ],
      };
      setProjects((current) => [project, ...current]);
      notify("Project created", "success", `${id} saved as Draft. Add tasks and an approved budget before moving to Planned.`);
      return { ok: true, id };
    },
    [projects, properties, can, notify],
  );

  const updateProject = useCallback(
    (id: string, patch: Partial<Project>, detail: string): ActionResult => {
      if (!can("project.edit")) return { ok: false, error: "You do not have permission to edit projects." };
      mutateProject(id, (project) => ({
        ...project,
        ...patch,
        activity: [activity(id, CURRENT_USER.name, "Project updated", detail, "status"), ...project.activity],
      }));
      notify("Project updated", "success", detail);
      return { ok: true };
    },
    [can, mutateProject, notify],
  );

  const transitionProject = useCallback(
    (id: string, status: ProjectStatus, reason: string): ActionResult => {
      const project = projects.find((p) => p.id === id);
      if (!project) return { ok: false, error: "Project not found." };
      if (!nextStatuses[project.status].includes(status)) {
        return { ok: false, error: `Invalid transition: ${project.status} → ${status}.` };
      }
      if (!can("project.edit")) return { ok: false, error: "You do not have permission to change project status." };
      if ((status === "Completed" || status === "Cancelled") && !can("project.close"))
        return { ok: false, error: "Closing or cancelling a project requires close permission." };
      if ((status === "Planned" || status === "Approved") && (!project.name.trim() || !project.description.trim()))
        return { ok: false, error: "A project name and clear scope of work are required before planning or approval." };
      if (status === "Approved" && project.originalBudgetCents <= 0)
        return { ok: false, error: "An original approved budget is required before project approval." };
      if (status === "Completed") {
        const checks = canCompleteProject(project);
        if (!checks.allowed) return { ok: false, error: `Completion blocked: ${checks.reasons.join("; ")}.` };
      }
      if (status === "Cancelled" && !reason.trim()) return { ok: false, error: "A cancellation reason is required." };
      if (!reason.trim()) return { ok: false, error: "A reason is required for every status change." };
      mutateProject(id, (p) => ({
        ...p,
        status,
        actualStart: status === "In Progress" && !p.actualStart ? TODAY : p.actualStart,
        actualCompletion: status === "Completed" ? TODAY : p.actualCompletion,
        milestones:
          status === "Completed"
            ? p.milestones.map((m) =>
                m.status === "Completed" || /ready for occupancy/i.test(m.name)
                  ? m
                  : { ...m, status: "Completed", actualDate: m.actualDate ?? TODAY },
              )
            : p.milestones,
        activity: [
          activity(id, CURRENT_USER.name, status === "Cancelled" ? "Project cancelled" : `Status changed to ${status}`, reason, "status"),
          ...p.activity,
        ],
      }));
      notify(`Status updated to ${status}`, "success", reason);
      return { ok: true };
    },
    [projects, can, mutateProject, notify],
  );

  const toggleArchive = useCallback(
    (id: string, archived: boolean) => {
      mutateProject(id, (project) => ({
        ...project,
        archived,
        activity: [
          activity(id, CURRENT_USER.name, archived ? "Project archived" : "Project restored", archived ? "Archived with financial and audit history retained." : "Restored to active portfolio view.", "status"),
          ...project.activity,
        ],
      }));
      notify(archived ? "Project archived" : "Project restored", "info");
    },
    [mutateProject, notify],
  );

  const addTask = useCallback(
    (projectId: string, t: Omit<Task, "id" | "projectId" | "createdAt" | "createdBy" | "modifiedAt" | "modifiedBy">): ActionResult => {
      if (!t.name.trim()) return { ok: false, error: "Task name is required." };
      if (t.plannedFinish < t.plannedStart) return { ok: false, error: "Planned finish cannot be before planned start." };
      const project = projects.find((p) => p.id === projectId);
      if (!project) return { ok: false, error: "Project not found." };
      const id = `${projectId}-TSK-${project.tasks.length + 1}-${Math.random().toString(36).slice(2, 5)}`;
      const now = stamp();
      const task: Task = { ...t, id, projectId, createdBy: CURRENT_USER.name, createdAt: now, modifiedBy: CURRENT_USER.name, modifiedAt: now };
      mutateProject(projectId, (p) => ({
        ...p,
        tasks: [...p.tasks, task],
        activity: [activity(projectId, CURRENT_USER.name, "Task added", `${task.name} assigned to ${task.assigneeName}.`, "task"), ...p.activity],
      }));
      notify("Task added", "success", task.name);
      return { ok: true, id };
    },
    [projects, mutateProject, notify],
  );

  const setTaskStatus = useCallback(
    (projectId: string, taskId: string, status: TaskStatus): ActionResult => {
      if (!can("project.edit")) return { ok: false, error: "You do not have permission to update tasks." };
      const project = projects.find((p) => p.id === projectId);
      const current = project?.tasks.find((t) => t.id === taskId);
      if (!current) return { ok: false, error: "Task not found." };
      if (status === "Completed" && current.status !== "Completed") {
        const unresolved = current.dependencies.filter((dep) => project?.tasks.find((t) => t.id === dep)?.status !== "Completed");
        if (unresolved.length) return { ok: false, error: "Complete predecessor tasks first — this task has unresolved dependencies." };
      }
      mutateProject(projectId, (p) => ({
        ...p,
        tasks: p.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status,
                actualStart: status !== "Not Started" && !t.actualStart ? TODAY : t.actualStart,
                actualFinish: status === "Completed" ? TODAY : status === "In Progress" ? undefined : t.actualFinish,
                modifiedAt: stamp(),
                modifiedBy: CURRENT_USER.name,
              }
            : t,
        ),
        activity: [activity(projectId, CURRENT_USER.name, "Task updated", `${current.name} → ${status}.`, "task"), ...p.activity],
      }));
      notify("Task updated", "success", `${current.name} marked ${status}.`);
      return { ok: true };
    },
    [projects, can, mutateProject, notify],
  );

  const reorderTask = useCallback(
    (projectId: string, taskId: string, direction: -1 | 1) => {
      mutateProject(projectId, (p) => {
        const index = p.tasks.findIndex((t) => t.id === taskId);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= p.tasks.length) return p;
        const tasks = [...p.tasks];
        [tasks[index], tasks[next]] = [tasks[next], tasks[index]];
        return { ...p, tasks };
      });
    },
    [mutateProject],
  );

  const addExpense = useCallback(
    (projectId: string, e: Omit<Expense, "id" | "projectId" | "createdAt" | "createdBy">): ActionResult => {
      if (!e.description.trim()) return { ok: false, error: "Description is required." };
      if (e.quantity <= 0) return { ok: false, error: "Quantity must be greater than zero." };
      if (e.unitPriceCents < 0) return { ok: false, error: "Unit price cannot be negative." };
      if (e.taxRate < 0 || e.taxRate > 30) return { ok: false, error: "Tax rate must be between 0% and 30%." };
      const project = projects.find((p) => p.id === projectId);
      if (!project) return { ok: false, error: "Project not found." };
      const subtotal = Math.round(e.quantity * e.unitPriceCents);
      const tax = Math.round(((subtotal - e.discountCents) * e.taxRate) / 100);
      const record: Expense = {
        ...e,
        id: uid("EXP"),
        projectId,
        subtotalCents: subtotal,
        taxAmountCents: tax,
        totalCents: subtotal - e.discountCents + tax,
        createdAt: stamp(),
        createdBy: CURRENT_USER.name,
      };
      mutateProject(projectId, (p) => ({
        ...p,
        expenses: [record, ...p.expenses],
        activity: [activity(projectId, CURRENT_USER.name, "Expense recorded", `${record.description} — ${(record.totalCents / 100).toFixed(2)} CAD (${record.approval}).`, "budget"), ...p.activity],
      }));
      notify(record.approval === "Approved" ? "Expense recorded" : "Expense submitted", "success", record.description);
      return { ok: true, id: record.id };
    },
    [projects, mutateProject, notify],
  );

  const setExpenseApproval = useCallback(
    (projectId: string, expenseId: string, approval: ApprovalStatus) => {
      mutateProject(projectId, (p) => ({
        ...p,
        expenses: p.expenses.map((e) => (e.id === expenseId ? { ...e, approval } : e)),
        activity: [activity(projectId, CURRENT_USER.name, `Expense ${approval.toLowerCase()}`, `${expenseId} approval status set to ${approval}.`, "budget"), ...p.activity],
      }));
      notify(`Expense ${approval.toLowerCase()}`, approval === "Rejected" ? "warning" : "success");
    },
    [mutateProject, notify],
  );

  const findDuplicateInvoice = useCallback(
    (vendorId: string, number: string) => {
      const normalized = number.trim().toLowerCase();
      return projects
        .flatMap((p) => p.invoices)
        .find((i) => i.vendorId === vendorId && i.number.trim().toLowerCase() === normalized && i.approval !== "Cancelled");
    },
    [projects],
  );

  const addInvoice = useCallback(
    (projectId: string, inv: Omit<Invoice, "id" | "projectId" | "createdAt" | "createdBy">): ActionResult => {
      if (!inv.number.trim()) return { ok: false, error: "Invoice number is required." };
      if (!inv.lines.length) return { ok: false, error: "Add at least one line item." };
      if (inv.lines.some((l) => l.quantity <= 0 || l.unitPriceCents < 0)) return { ok: false, error: "Line quantities must be positive and prices cannot be negative." };
      if (inv.lines.some((l) => l.taxRate < 0 || l.taxRate > 30)) return { ok: false, error: "Tax rates must be between 0% and 30%." };
      if (inv.dueDate < inv.invoiceDate) return { ok: false, error: "Payment due date cannot precede the invoice date." };
      const project = projects.find((p) => p.id === projectId);
      if (!project) return { ok: false, error: "Project not found." };
      const record: Invoice = { ...inv, id: uid("INV"), projectId, createdAt: stamp(), createdBy: CURRENT_USER.name };
      mutateProject(projectId, (p) => ({
        ...p,
        invoices: [record, ...p.invoices],
        activity: [activity(projectId, CURRENT_USER.name, "Invoice received", `${record.number} from ${record.vendorName} recorded for approval.`, "invoice"), ...p.activity],
      }));
      notify(findDuplicateInvoice(record.vendorId, record.number) ? "Invoice flagged — possible duplicate" : "Invoice recorded", findDuplicateInvoice(record.vendorId, record.number) ? "warning" : "success", record.number);
      return { ok: true, id: record.id };
    },
    [projects, mutateProject, notify, findDuplicateInvoice],
  );

  const setInvoiceApproval = useCallback(
    (projectId: string, invoiceId: string, approval: ApprovalStatus): ActionResult => {
      if ((approval === "Approved" || approval === "Rejected") && !can("invoice.approve"))
        return { ok: false, error: "Invoice approval or rejection requires finance permission." };
      const project = projects.find((p) => p.id === projectId);
      const invoice = project?.invoices.find((i) => i.id === invoiceId);
      if (!invoice) return { ok: false, error: "Invoice not found." };
      if (approval === "Rejected" || approval === "Cancelled") {
        const allocated = project?.payments.reduce(
          (sum, payment) => sum + payment.allocations.filter((a) => a.invoiceId === invoiceId).reduce((s, a) => s + a.amountCents, 0),
          0,
        ) ?? 0;
        if (allocated > 0)
          return {
            ok: false,
            error: "This invoice has recorded payment allocations. Reverse or reallocate the payments before rejecting or cancelling the invoice.",
          };
      }
      mutateProject(projectId, (p) => ({
        ...p,
        invoices: p.invoices.map((i) => (i.id === invoiceId ? { ...i, approval } : i)),
        activity: [activity(projectId, CURRENT_USER.name, `Invoice ${approval.toLowerCase()}`, `${invoice.number} — ${invoice.vendorName}. Approval does not constitute payment.`, "invoice"), ...p.activity],
      }));
      notify(`Invoice ${approval.toLowerCase()}`, approval === "Rejected" ? "warning" : "success", "Payment status is calculated separately from recorded payments.");
      return { ok: true };
    },
    [can, projects, mutateProject, notify],
  );

  const recordPayment = useCallback(
    (projectId: string, pay: Omit<Payment, "id" | "projectId" | "createdAt" | "recordedBy">): ActionResult => {
      if (!can("payment.record")) return { ok: false, error: "Recording payments requires finance permission." };
      const project = projects.find((p) => p.id === projectId);
      if (!project) return { ok: false, error: "Project not found." };
      if (pay.amountCents <= 0) return { ok: false, error: "Payment amount must be greater than zero." };
      const allocated = pay.allocations.reduce((sum, a) => sum + a.amountCents, 0);
      if (allocated !== pay.amountCents) return { ok: false, error: "Payment allocations must equal the payment total." };
      for (const allocation of pay.allocations) {
        const invoice = project.invoices.find((i) => i.id === allocation.invoiceId);
        if (!invoice) return { ok: false, error: "Allocated invoice not found." };
        if (invoice.approval !== "Approved") return { ok: false, error: `Invoice ${invoice.number} must be approved before payment.` };
        const available = invoiceBalance(invoice, project.payments);
        if (allocation.amountCents > available)
          return { ok: false, error: `Allocation exceeds the available balance on ${invoice.number} (${(available / 100).toFixed(2)} CAD available).` };
      }
      const record: Payment = { ...pay, id: uid("PAY"), projectId, createdAt: stamp(), recordedBy: CURRENT_USER.name };
      mutateProject(projectId, (p) => ({
        ...p,
        payments: [record, ...p.payments],
        activity: [activity(projectId, CURRENT_USER.name, "Payment recorded", `${record.id} — ${(record.amountCents / 100).toFixed(2)} CAD to ${record.payeeName} via ${record.method}.`, "payment"), ...p.activity],
      }));
      notify("Payment recorded", "success", "Invoice balances have been recalculated.");
      return { ok: true, id: record.id };
    },
    [projects, can, mutateProject, notify],
  );

  const addChangeOrder = useCallback(
    (projectId: string, co: Omit<ChangeOrder, "id" | "projectId">): ActionResult => {
      if (!co.description.trim()) return { ok: false, error: "Describe the requested change." };
      if (!co.reason.trim()) return { ok: false, error: "A reason is required." };
      if (!co.supportingDocument) return { ok: false, error: "Attach the supporting quote or document." };
      const project = projects.find((p) => p.id === projectId);
      if (!project) return { ok: false, error: "Project not found." };
      const record: ChangeOrder = { ...co, id: uid("CO"), projectId };
      mutateProject(projectId, (p) => ({
        ...p,
        changeOrders: [record, ...p.changeOrders],
        activity: [activity(projectId, CURRENT_USER.name, "Change order requested", `${record.number} — ${(record.costDeltaCents / 100).toFixed(2)} CAD / ${record.scheduleImpactDays} days.`, "change"), ...p.activity],
      }));
      notify("Change order submitted", "success", "Approved change orders update the current approved budget.");
      return { ok: true, id: record.id };
    },
    [projects, mutateProject, notify],
  );

  const decideChangeOrder = useCallback(
    (projectId: string, changeOrderId: string, approve: boolean, reason?: string): ActionResult => {
      if (!can("budget.approve")) return { ok: false, error: "Change-order approval requires budget approval permission." };
      const project = projects.find((p) => p.id === projectId);
      const co = project?.changeOrders.find((c) => c.id === changeOrderId);
      if (!co) return { ok: false, error: "Change order not found." };
      if (co.approval !== "Pending Approval") return { ok: false, error: "This change order has already been decided." };
      if (!approve && !reason?.trim()) return { ok: false, error: "A rejection reason is required." };
      mutateProject(projectId, (p) => ({
        ...p,
        changeOrders: p.changeOrders.map((c) =>
          c.id === changeOrderId
            ? { ...c, approval: approve ? "Approved" : "Rejected", approver: CURRENT_USER.name, approvalDate: TODAY, rejectionReason: approve ? undefined : reason }
            : c,
        ),
        activity: [
          activity(
            projectId,
            CURRENT_USER.name,
            approve ? "Change order approved" : "Change order rejected",
            approve
              ? `${co.number} approved — current approved budget ${co.costDeltaCents >= 0 ? "increased" : "decreased"} by ${Math.abs(co.costDeltaCents / 100).toFixed(2)} CAD and schedule adjusted ${co.scheduleImpactDays >= 0 ? "+" : ""}${co.scheduleImpactDays} days.`
              : `${co.number} rejected: ${reason}`,
            "change",
          ),
          ...p.activity,
        ],
      }));
      notify(approve ? "Change order approved" : "Change order rejected", approve ? "success" : "warning", approve ? "Budget and schedule values updated from the approved change." : reason);
      return { ok: true };
    },
    [can, projects, mutateProject, notify],
  );

  const addDocument = useCallback(
    (projectId: string, document: Omit<ProjectDocument, "id" | "uploadDate" | "uploader">): ActionResult => {
      if (!can("document.manage")) return { ok: false, error: "You do not have permission to upload documents." };
      if (!document.name) return { ok: false, error: "A file name is required." };
      const record: ProjectDocument = { ...document, id: uid("DOC"), uploadDate: TODAY, uploader: CURRENT_USER.name };
      mutateProject(projectId, (p) => ({
        ...p,
        documents: [record, ...p.documents],
        activity: [activity(projectId, CURRENT_USER.name, "Document uploaded", `${record.name} filed under ${record.category}.`, "document"), ...p.activity],
      }));
      notify("Document added", "success", "Stored with project-level access controls (mock repository).");
      return { ok: true, id: record.id };
    },
    [can, mutateProject, notify],
  );

  const setMilestoneStatus = useCallback(
    (projectId: string, milestoneId: string, status: Milestone["status"]) => {
      mutateProject(projectId, (p) => {
        const target = p.milestones.find((m) => m.id === milestoneId);
        if (status === "Completed" && target?.requiresInspection) {
          const passed = p.inspections.some((i) => i.result === "Pass");
          if (!passed) {
            notify("Inspection required", "warning", "This milestone requires a passed inspection before it can be completed.");
            return p;
          }
        }
        return {
          ...p,
          milestones: p.milestones.map((m) => (m.id === milestoneId ? { ...m, status, actualDate: status === "Completed" ? m.actualDate ?? TODAY : undefined } : m)),
          activity: [activity(projectId, CURRENT_USER.name, "Milestone updated", `${target?.name ?? milestoneId} → ${status}.`, "task"), ...p.activity],
        };
      });
      notify("Milestone updated", "success");
    },
    [mutateProject, notify],
  );

  const addInspection = useCallback(
    (projectId: string, i: Omit<Inspection, "id">): ActionResult => {
      const record: Inspection = { ...i, id: uid("INS") };
      const project = projects.find((p) => p.id === projectId);
      const requiresCorrection = record.result === "Fail" || record.result === "Conditional";
      const due = new Date(`${TODAY}T12:00:00`);
      due.setDate(due.getDate() + 14);
      const newDeficiency = requiresCorrection
        ? {
            id: uid("DEF"),
            projectId,
            inspectionId: record.id,
            description: record.findings || record.correctiveActions || `${record.type} requires corrective action.`,
            severity: record.result === "Fail" ? ("High" as const) : ("Medium" as const),
            assignedTo: project?.manager ?? CURRENT_USER.name,
            dueDate: due.toISOString().slice(0, 10),
            status: "Open" as const,
            resolutionNotes: record.correctiveActions ? `Corrective action: ${record.correctiveActions}` : "",
          }
        : undefined;
      mutateProject(projectId, (p) => ({
        ...p,
        inspections: [record, ...p.inspections],
        deficiencies: newDeficiency ? [newDeficiency, ...p.deficiencies] : p.deficiencies,
        activity: [
          activity(projectId, CURRENT_USER.name, `Inspection ${record.result.toLowerCase()}`, `${record.type} — ${record.findings || "No findings recorded."}`, "inspection"),
          ...(newDeficiency
            ? [activity(projectId, CURRENT_USER.name, "Deficiency created", `${newDeficiency.id} raised automatically from ${record.type}. Due ${newDeficiency.dueDate}.`, "inspection")]
            : []),
          ...p.activity,
        ],
      }));
      notify(
        requiresCorrection ? "Inspection recorded — deficiency raised" : "Inspection recorded",
        requiresCorrection ? "warning" : "success",
        requiresCorrection ? "A corrective deficiency was created and must be resolved before project completion." : record.findings,
      );
      return { ok: true, id: record.id };
    },
    [projects, mutateProject, notify],
  );

  const resolveDeficiency = useCallback(
    (projectId: string, deficiencyId: string, notes: string): ActionResult => {
      if (!notes.trim()) return { ok: false, error: "Resolution notes are required to close a deficiency." };
      mutateProject(projectId, (p) => ({
        ...p,
        deficiencies: p.deficiencies.map((d) => (d.id === deficiencyId ? { ...d, status: "Resolved", resolutionNotes: notes, reinspectionDate: TODAY } : d)),
        activity: [activity(projectId, CURRENT_USER.name, "Deficiency resolved", `${deficiencyId}: ${notes} (pending verification).`, "inspection"), ...p.activity],
      }));
      notify("Deficiency resolved", "success", "Marked resolved — verification still required before project closure.");
      return { ok: true };
    },
    [mutateProject, notify],
  );

  const assignContractor = useCallback(
    (projectId: string, assignment: Omit<ProjectTeamMember, "id">): ActionResult => {
      const contractor = contractors.find((c) => c.id === assignment.contractorId);
      if (!contractor) return { ok: false, error: "Select a contractor." };
      if (!contractor.active) return { ok: false, error: "This contractor is inactive. Update compliance documents before assigning." };
      if (assignment.contractAmountCents <= 0) return { ok: false, error: "Contract amount must be greater than zero." };
      if (assignment.endDate < assignment.startDate) return { ok: false, error: "Assignment end date cannot precede the start date." };
      const record: ProjectTeamMember = { ...assignment, id: uid("TA") };
      mutateProject(projectId, (p) => ({
        ...p,
        team: [...p.team, record],
        activity: [activity(projectId, CURRENT_USER.name, "Contractor assigned", `${contractor.name} — ${assignment.role}, ${(assignment.contractAmountCents / 100).toFixed(2)} CAD.`, "assignment"), ...p.activity],
      }));
      notify("Contractor assigned", "success", contractor.name);
      return { ok: true, id: record.id };
    },
    [contractors, mutateProject, notify],
  );

  const approveReadiness = useCallback(
    (projectId: string): ActionResult => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return { ok: false, error: "Project not found." };
      if (project.status !== "Completed") return { ok: false, error: "Project completion is required before unit readiness can be confirmed." };
      const readinessChecks = canCompleteProject(project);
      if (!readinessChecks.allowed)
        return { ok: false, error: `Readiness requirements outstanding: ${readinessChecks.reasons.join("; ")}.` };
      if (project.deficiencies.some((d) => d.status !== "Verified" && d.status !== "Resolved"))
        return { ok: false, error: "Resolve all deficiencies before confirming readiness." };
      mutateProject(projectId, (p) => ({
        ...p,
        readinessApproved: true,
        readinessApprovedBy: CURRENT_USER.name,
        actualReadyDate: TODAY,
        milestones: p.milestones.map((m) => (m.name === "Unit ready for occupancy" ? { ...m, status: "Completed", actualDate: TODAY } : m)),
        activity: [activity(projectId, CURRENT_USER.name, "Unit readiness confirmed", `Unit ${p.unitNumber} readiness approved. Availability status updated separately by asset management.`, "status"), ...p.activity],
      }));
      setProperties((current) =>
        current.map((prop) => ({
          ...prop,
          units: prop.units.map((u) =>
            u.id === project.unitId && (u.occupancy === "Vacant" || u.occupancy === "Vacating")
              ? { ...u, occupancy: "Ready for rent" }
              : u,
          ),
        })),
      );
      notify("Unit readiness confirmed", "success", `Unit ${project.unitNumber} moved to Ready for rent.`);
      return { ok: true };
    },
    [projects, mutateProject, notify],
  );

  const value = useMemo<StoreValue>(
    () => ({
      projects,
      contractors,
      properties,
      toasts,
      user: CURRENT_USER,
      can,
      notify,
      dismissToast,
      projectById,
      propertyById,
      unitForProject,
      createProject,
      updateProject,
      transitionProject,
      toggleArchive,
      addTask,
      setTaskStatus,
      reorderTask,
      addExpense,
      setExpenseApproval,
      findDuplicateInvoice,
      addInvoice,
      setInvoiceApproval,
      recordPayment,
      addChangeOrder,
      decideChangeOrder,
      addDocument,
      setMilestoneStatus,
      addInspection,
      resolveDeficiency,
      assignContractor,
      approveReadiness,
    }),
    [projects, contractors, properties, toasts, can, notify, dismissToast, projectById, propertyById, unitForProject, createProject, updateProject, transitionProject, toggleArchive, addTask, setTaskStatus, reorderTask, addExpense, setExpenseApproval, findDuplicateInvoice, addInvoice, setInvoiceApproval, recordPayment, addChangeOrder, decideChangeOrder, addDocument, setMilestoneStatus, addInspection, resolveDeficiency, assignContractor, approveReadiness],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}

export { dateLong, invoiceTotal };
export type { InvoiceLine };
