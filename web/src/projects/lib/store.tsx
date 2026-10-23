import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../../lib/activeOrg";
import { loadStaff } from "../../properties/add/store/refRepo";
import * as repo from "../repo";
import { deleteDocument, openDocument, uploadDocument } from "../../lib/documents";
import {
  CURRENT_USER,
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
  /** false while the first load from Supabase is running */
  ready: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
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
  addExpense: (projectId: string, expense: Omit<Expense, "id" | "projectId" | "createdAt" | "createdBy">, file?: File) => ActionResult;
  openAttachment: (projectId: string, recordId: string) => void;
  setExpenseApproval: (projectId: string, expenseId: string, approval: ApprovalStatus) => void;
  findDuplicateInvoice: (vendorId: string, number: string) => Invoice | undefined;
  addInvoice: (projectId: string, invoice: Omit<Invoice, "id" | "projectId" | "createdAt" | "createdBy">, file?: File) => ActionResult;
  setInvoiceApproval: (projectId: string, invoiceId: string, approval: ApprovalStatus) => void;
  recordPayment: (projectId: string, payment: Omit<Payment, "id" | "projectId" | "createdAt" | "recordedBy">, file?: File) => ActionResult;
  addChangeOrder: (projectId: string, co: Omit<ChangeOrder, "id" | "projectId">, file?: File) => ActionResult;
  decideChangeOrder: (projectId: string, changeOrderId: string, approve: boolean, reason?: string) => ActionResult;
  addDocument: (projectId: string, document: Omit<ProjectDocument, "id" | "uploadDate" | "uploader">, file?: File) => ActionResult;
  openDocument: (document: ProjectDocument) => void;
  setMilestoneStatus: (projectId: string, milestoneId: string, status: Milestone["status"]) => void;
  addInspection: (projectId: string, inspection: Omit<Inspection, "id">, file?: File) => ActionResult;
  resolveDeficiency: (projectId: string, deficiencyId: string, notes: string) => ActionResult;
  assignContractor: (projectId: string, assignment: Omit<ProjectTeamMember, "id">) => ActionResult;
  approveReadiness: (projectId: string) => ActionResult;
}

const StoreContext = createContext<StoreValue | null>(null);

const uid = (prefix: string) => (isSupabaseConfigured ? crypto.randomUUID() : `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
const stamp = () => `${TODAY}T${new Date().toTimeString().slice(0, 5)}:00`;

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [properties, setProperties] = useState<Property[]>(isSupabaseConfigured ? [] : seedProperties);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [user, setUser] = useState(CURRENT_USER);
  const userRef = useRef(user);
  userRef.current = user;
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [loadError, setLoadError] = useState<string | null>(null);
  const orgId = useSyncExternalStore(subscribeActiveOrg, getActiveOrgId);
  // last state known to be in the database; changes are written as the difference from it
  const saved = useRef<Project[]>([]);
  const chain = useRef<Promise<void>>(Promise.resolve());
  // files waiting to be uploaded once their project is saved
  const uploads = useRef<{ name: string; run: () => Promise<void>; onFail?: () => void }[]>([]);

  const notify = useCallback((title: string, tone: Toast["tone"] = "success", description?: string) => {
    const id = uid("TST");
    setToasts((current) => [...current, { id, title, description, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  // with Supabase the database decides who may change what (Row-Level Security); the screen only explains a refusal
  /** Stores the file chosen for a record (receipt, invoice, proof of payment ...) once that record is saved. */
  const queueAttachment = useCallback(
    (projectId: string, file: File | undefined, spec: { entityType: "project_expense" | "project_invoice" | "project"; entityId: string; category: string; description?: string }) => {
      if (!isSupabaseConfigured || !file) return;
      uploads.current.push({
        name: file.name,
        run: async () => {
          const rowId = repo.projectRowId(projectId);
          if (!rowId) throw new Error("The project for this file was not saved.");
          await uploadDocument({
            bucket: "project-documents", area: "projects", file, entityType: spec.entityType, entityId: spec.entityType === "project" ? rowId : spec.entityId, entityLabel: projectId, category: spec.category,
            originModule: "Projects", description: spec.description,
          });
        },
      });
    },
    [],
  );

  const openAttachment = useCallback(
    (projectId: string, recordId: string) => {
      const file = projects.find((p) => p.id === projectId)?.attachmentFiles?.[recordId];
      if (!file) { notify("The file is still uploading", "info", "Try again in a moment."); return; }
      openDocument(file.bucket, file.path).catch((error) => notify("The file could not be opened", "error", error instanceof Error ? error.message : undefined));
    },
    [projects, notify],
  );

  const can = useCallback((permission: string) => isSupabaseConfigured || CURRENT_USER.permissions.includes(permission), []);

  /** Reads the organization's properties, contractors and projects (the database is the source of truth). */
  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const org = getActiveOrgId();
    if (!org) return;
    try {
      await chain.current; // let pending writes finish so they are not overwritten by an older read
      const staff = await loadStaff(org).catch(() => []);
      const [ref, loaded] = await Promise.all([repo.loadReference(org, staff), repo.loadProjects(org, staff)]);
      if (getActiveOrgId() !== org) return; // the user switched organization meanwhile
      const { data: auth } = await supabase.auth.getUser();
      saved.current = loaded;
      setProperties(ref.properties);
      setContractors(ref.contractors);
      setProjects(loaded);
      setMe(ref.me);
      const name = ref.me?.name ?? auth.user?.email ?? "You";
      setUser((u) => ({ ...u, name, email: auth.user?.email ?? "", role: "Team member", initials: name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() }));
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load projects.";
      setLoadError(message);
      notify("Projects could not be loaded", "error", message);
    } finally {
      if (getActiveOrgId() === org) setReady(true);
    }
  }, [notify]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    setReady(false);
    if (orgId) void reload();
    else {
      setProjects([]);
      setProperties([]);
      setContractors([]);
      setReady(true);
    }
  }, [orgId, reload]);

  // every change to the projects is written to the database as a difference from what is already saved
  useEffect(() => {
    if (!isSupabaseConfigured || !ready) return;
    const prev = saved.current;
    if (JSON.stringify(prev) !== JSON.stringify(projects)) {
      saved.current = projects;
      chain.current = chain.current
        .then(() => repo.persist(prev, projects, me))
        .catch((error) => {
          notify(error instanceof Error ? error.message : "The change could not be saved.", "error");
          return reload();
        });
    }
    if (uploads.current.length) {
      const batch = uploads.current.splice(0);
      chain.current = chain.current.then(async () => {
        const failed: string[] = [];
        for (const item of batch) {
          try {
            await item.run();
          } catch (error) {
            failed.push(`${item.name}: ${error instanceof Error ? error.message : "upload failed"}`);
            item.onFail?.();
          }
        }
        if (failed.length) notify("Some files were not uploaded", "error", failed.join(" "));
        else await reload();
      });
    }
  }, [ready, projects, me, notify, reload]);

  const projectById = useCallback((id: string) => projects.find((p) => p.id === id), [projects]);

  const propertyById = useCallback((id: string) => properties.find((p) => p.id === id), [properties]);

  const unitForProject = useCallback(
    (project: Project) => properties.find((p) => p.id === project.propertyId)?.units.find((u) => u.id === project.unitId),
    [properties],
  );

  const mutateProject = useCallback((id: string, fn: (project: Project) => Project) => {
    setProjects((current) => current.map((p) => (p.id === id ? { ...fn(p), modifiedAt: stamp(), modifiedBy: userRef.current.name } : p)));
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
      const highest = Math.max(isSupabaseConfigured ? 0 : 1000, ...projects.map((p) => Number.parseInt(p.id.replace(/\D/g, ""), 10) || 0));
      const id = isSupabaseConfigured ? `PRJ-${String(highest + 1).padStart(4, "0")}` : `PRJ-${highest + 1}`;
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
          id: isSupabaseConfigured ? crypto.randomUUID() : `${id}-MS-${index + 1}`,
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
        createdBy: userRef.current.name,
        createdAt: now,
        modifiedBy: userRef.current.name,
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
            actor: userRef.current.name,
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
        activity: [activity(id, userRef.current.name, "Project updated", detail, "status"), ...project.activity],
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
          activity(id, userRef.current.name, status === "Cancelled" ? "Project cancelled" : `Status changed to ${status}`, reason, "status"),
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
          activity(id, userRef.current.name, archived ? "Project archived" : "Project restored", archived ? "Archived with financial and audit history retained." : "Restored to active portfolio view.", "status"),
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
      const id = isSupabaseConfigured ? crypto.randomUUID() : `${projectId}-TSK-${project.tasks.length + 1}-${Math.random().toString(36).slice(2, 5)}`;
      const now = stamp();
      const task: Task = { ...t, id, projectId, createdBy: userRef.current.name, createdAt: now, modifiedBy: userRef.current.name, modifiedAt: now };
      mutateProject(projectId, (p) => ({
        ...p,
        tasks: [...p.tasks, task],
        activity: [activity(projectId, userRef.current.name, "Task added", `${task.name} assigned to ${task.assigneeName}.`, "task"), ...p.activity],
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
                modifiedBy: userRef.current.name,
              }
            : t,
        ),
        activity: [activity(projectId, userRef.current.name, "Task updated", `${current.name} → ${status}.`, "task"), ...p.activity],
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
    (projectId: string, e: Omit<Expense, "id" | "projectId" | "createdAt" | "createdBy">, file?: File): ActionResult => {
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
        createdBy: userRef.current.name,
      };
      mutateProject(projectId, (p) => ({
        ...p,
        expenses: [record, ...p.expenses],
        activity: [activity(projectId, userRef.current.name, "Expense recorded", `${record.description} — ${(record.totalCents / 100).toFixed(2)} CAD (${record.approval}).`, "budget"), ...p.activity],
      }));
      queueAttachment(projectId, file, { entityType: "project_expense", entityId: record.id, category: "Receipt" });
      notify(record.approval === "Approved" ? "Expense recorded" : "Expense submitted", "success", record.description);
      return { ok: true, id: record.id };
    },
    [queueAttachment, projects, mutateProject, notify],
  );

  const setExpenseApproval = useCallback(
    (projectId: string, expenseId: string, approval: ApprovalStatus) => {
      mutateProject(projectId, (p) => ({
        ...p,
        expenses: p.expenses.map((e) => (e.id === expenseId ? { ...e, approval } : e)),
        activity: [activity(projectId, userRef.current.name, `Expense ${approval.toLowerCase()}`, `${expenseId} approval status set to ${approval}.`, "budget"), ...p.activity],
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
    (projectId: string, inv: Omit<Invoice, "id" | "projectId" | "createdAt" | "createdBy">, file?: File): ActionResult => {
      if (!inv.number.trim()) return { ok: false, error: "Invoice number is required." };
      if (!inv.lines.length) return { ok: false, error: "Add at least one line item." };
      if (inv.lines.some((l) => l.quantity <= 0 || l.unitPriceCents < 0)) return { ok: false, error: "Line quantities must be positive and prices cannot be negative." };
      if (inv.lines.some((l) => l.taxRate < 0 || l.taxRate > 30)) return { ok: false, error: "Tax rates must be between 0% and 30%." };
      if (inv.dueDate < inv.invoiceDate) return { ok: false, error: "Payment due date cannot precede the invoice date." };
      const project = projects.find((p) => p.id === projectId);
      if (!project) return { ok: false, error: "Project not found." };
      const record: Invoice = { ...inv, id: uid("INV"), projectId, createdAt: stamp(), createdBy: userRef.current.name };
      mutateProject(projectId, (p) => ({
        ...p,
        invoices: [record, ...p.invoices],
        activity: [activity(projectId, userRef.current.name, "Invoice received", `${record.number} from ${record.vendorName} recorded for approval.`, "invoice"), ...p.activity],
      }));
      queueAttachment(projectId, file, { entityType: "project_invoice", entityId: record.id, category: "Invoice" });
      notify(findDuplicateInvoice(record.vendorId, record.number) ? "Invoice flagged — possible duplicate" : "Invoice recorded", findDuplicateInvoice(record.vendorId, record.number) ? "warning" : "success", record.number);
      return { ok: true, id: record.id };
    },
    [queueAttachment, projects, mutateProject, notify, findDuplicateInvoice],
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
        activity: [activity(projectId, userRef.current.name, `Invoice ${approval.toLowerCase()}`, `${invoice.number} — ${invoice.vendorName}. Approval does not constitute payment.`, "invoice"), ...p.activity],
      }));
      notify(`Invoice ${approval.toLowerCase()}`, approval === "Rejected" ? "warning" : "success", "Payment status is calculated separately from recorded payments.");
      return { ok: true };
    },
    [can, projects, mutateProject, notify],
  );

  const recordPayment = useCallback(
    (projectId: string, pay: Omit<Payment, "id" | "projectId" | "createdAt" | "recordedBy">, file?: File): ActionResult => {
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
      const record: Payment = { ...pay, id: uid("PAY"), projectId, createdAt: stamp(), recordedBy: userRef.current.name };
      mutateProject(projectId, (p) => ({
        ...p,
        payments: [record, ...p.payments],
        activity: [activity(projectId, userRef.current.name, "Payment recorded", `${record.id} — ${(record.amountCents / 100).toFixed(2)} CAD to ${record.payeeName} via ${record.method}.`, "payment"), ...p.activity],
      }));
      queueAttachment(projectId, file, { entityType: "project", entityId: record.id, category: "Proof of payment", description: `payment:${record.id}` });
      notify("Payment recorded", "success", "Invoice balances have been recalculated.");
      return { ok: true, id: record.id };
    },
    [queueAttachment, projects, can, mutateProject, notify],
  );

  const addChangeOrder = useCallback(
    (projectId: string, co: Omit<ChangeOrder, "id" | "projectId">, file?: File): ActionResult => {
      if (!co.description.trim()) return { ok: false, error: "Describe the requested change." };
      if (!co.reason.trim()) return { ok: false, error: "A reason is required." };
      if (!co.supportingDocument) return { ok: false, error: "Attach the supporting quote or document." };
      const project = projects.find((p) => p.id === projectId);
      if (!project) return { ok: false, error: "Project not found." };
      const record: ChangeOrder = { ...co, id: uid("CO"), projectId };
      mutateProject(projectId, (p) => ({
        ...p,
        changeOrders: [record, ...p.changeOrders],
        activity: [activity(projectId, userRef.current.name, "Change order requested", `${record.number} — ${(record.costDeltaCents / 100).toFixed(2)} CAD / ${record.scheduleImpactDays} days.`, "change"), ...p.activity],
      }));
      queueAttachment(projectId, file, { entityType: "project", entityId: record.id, category: "Change order", description: `change_order:${record.id}` });
      notify("Change order submitted", "success", "Approved change orders update the current approved budget.");
      return { ok: true, id: record.id };
    },
    [queueAttachment, projects, mutateProject, notify],
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
            ? { ...c, approval: approve ? "Approved" : "Rejected", approver: userRef.current.name, approvalDate: TODAY, rejectionReason: approve ? undefined : reason }
            : c,
        ),
        activity: [
          activity(
            projectId,
            userRef.current.name,
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
    (projectId: string, document: Omit<ProjectDocument, "id" | "uploadDate" | "uploader">, file?: File): ActionResult => {
      if (!can("document.manage")) return { ok: false, error: "You do not have permission to upload documents." };
      if (!document.name) return { ok: false, error: "A file name is required." };
      if (isSupabaseConfigured && !file) return { ok: false, error: "Choose a file to upload." };
      const record: ProjectDocument = { ...document, id: uid("DOC"), uploadDate: TODAY, uploader: userRef.current.name };
      if (isSupabaseConfigured && file) {
        uploads.current.push({
          name: record.name,
          run: async () => {
            const projectRowId = repo.projectRowId(projectId);
            if (!projectRowId) throw new Error("The project for this file was not saved.");
            await uploadDocument({
              id: record.id, bucket: "project-documents", area: "projects", file, entityType: "project", entityId: projectRowId, entityLabel: projectId, category: record.category, originModule: "Projects",
              stage: record.stage ? (record.stage.toLowerCase() as "before" | "during" | "after") : undefined, visibility: record.visibility.toLowerCase() as "internal" | "team" | "restricted", expiryDate: record.expiryDate,
              alsoLinkTo: record.taskId ? { entityType: "project_task", entityId: record.taskId } : undefined,
            });
          },
          onFail: () => setProjects((current) => current.map((p) => (p.id === projectId ? { ...p, documents: p.documents.filter((d) => d.id !== record.id) } : p))),
        });
      }
      mutateProject(projectId, (p) => ({
        ...p,
        documents: [record, ...p.documents],
        activity: [activity(projectId, userRef.current.name, "Document uploaded", `${record.name} filed under ${record.category}.`, "document"), ...p.activity],
      }));
      notify("Document added", "success", isSupabaseConfigured ? "Uploading to the project repository." : "Recorded against the project (file storage is not connected yet).");
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
          activity: [activity(projectId, userRef.current.name, "Milestone updated", `${target?.name ?? milestoneId} → ${status}.`, "task"), ...p.activity],
        };
      });
      notify("Milestone updated", "success");
    },
    [mutateProject, notify],
  );

  const addInspection = useCallback(
    (projectId: string, i: Omit<Inspection, "id">, file?: File): ActionResult => {
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
            assignedTo: project?.manager ?? userRef.current.name,
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
          activity(projectId, userRef.current.name, `Inspection ${record.result.toLowerCase()}`, `${record.type} — ${record.findings || "No findings recorded."}`, "inspection"),
          ...(newDeficiency
            ? [activity(projectId, userRef.current.name, "Deficiency created", `${newDeficiency.id} raised automatically from ${record.type}. Due ${newDeficiency.dueDate}.`, "inspection")]
            : []),
          ...p.activity,
        ],
      }));
      queueAttachment(projectId, file, { entityType: "project", entityId: record.id, category: "Inspection report", description: `inspection:${record.id}` });
      notify(
        requiresCorrection ? "Inspection recorded — deficiency raised" : "Inspection recorded",
        requiresCorrection ? "warning" : "success",
        requiresCorrection ? "A corrective deficiency was created and must be resolved before project completion." : record.findings,
      );
      return { ok: true, id: record.id };
    },
    [queueAttachment, projects, mutateProject, notify],
  );

  const resolveDeficiency = useCallback(
    (projectId: string, deficiencyId: string, notes: string): ActionResult => {
      if (!notes.trim()) return { ok: false, error: "Resolution notes are required to close a deficiency." };
      mutateProject(projectId, (p) => ({
        ...p,
        deficiencies: p.deficiencies.map((d) => (d.id === deficiencyId ? { ...d, status: "Resolved", resolutionNotes: notes, reinspectionDate: TODAY } : d)),
        activity: [activity(projectId, userRef.current.name, "Deficiency resolved", `${deficiencyId}: ${notes} (pending verification).`, "inspection"), ...p.activity],
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
        activity: [activity(projectId, userRef.current.name, "Contractor assigned", `${contractor.name} — ${assignment.role}, ${(assignment.contractAmountCents / 100).toFixed(2)} CAD.`, "assignment"), ...p.activity],
      }));
      notify("Contractor assigned", "success", contractor.name);
      return { ok: true, id: record.id };
    },
    [contractors, mutateProject, notify],
  );

  const openProjectDocument = useCallback(
    (document: ProjectDocument) => {
      if (document.url && !document.path) { window.open(document.url, "_blank"); return; }
      if (document.bucket && document.path) {
        openDocument(document.bucket, document.path).catch((error) => notify("The file could not be opened", "error", error instanceof Error ? error.message : undefined));
        return;
      }
      notify("No file stored", "info", `${document.name} has no stored file.`);
    },
    [notify],
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
        readinessApprovedBy: userRef.current.name,
        actualReadyDate: TODAY,
        milestones: p.milestones.map((m) => (m.name === "Unit ready for occupancy" ? { ...m, status: "Completed", actualDate: TODAY } : m)),
        activity: [activity(projectId, userRef.current.name, "Unit readiness confirmed", `Unit ${p.unitNumber} readiness approved. Availability status updated separately by asset management.`, "status"), ...p.activity],
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
      user,
      ready,
      loadError,
      reload,
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
      openAttachment,
      openDocument: openProjectDocument,
      setMilestoneStatus,
      addInspection,
      resolveDeficiency,
      assignContractor,
      approveReadiness,
    }),
    [ready, loadError, reload, user, projects, contractors, properties, toasts, can, notify, dismissToast, projectById, propertyById, unitForProject, createProject, updateProject, transitionProject, toggleArchive, addTask, setTaskStatus, reorderTask, addExpense, setExpenseApproval, findDuplicateInvoice, addInvoice, setInvoiceApproval, recordPayment, addChangeOrder, decideChangeOrder, addDocument, openAttachment, openProjectDocument, setMilestoneStatus, addInspection, resolveDeficiency, assignContractor, approveReadiness],
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
