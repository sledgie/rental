import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  DollarSign,
  DoorOpen,
  FileSignature,
  Flag,
  Hammer,
  Hash,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useStore } from "../lib/store";
import { dateLong, parseMoneyToCents, TODAY } from "../lib/finance";
import type { Priority, ProjectDraft, ProjectType } from "../lib/types";
import { Badge, Button, Field, InfoNote, Input, Modal, Select, StatusBadge, Switch, Textarea } from "./ui";
import { cn } from "../utils/cn";

const projectTypes: ProjectType[] = ["Renovation", "Repair", "Maintenance", "Upgrade", "Restoration", "Other"];
const priorities: Priority[] = ["Low", "Normal", "High", "Emergency"];
const managers = ["Avery Chen", "Marcus Reed", "Priya Nair", "Jordan Ellis"];

const emptyDraft: ProjectDraft = {
  name: "",
  propertyId: "",
  unitId: "",
  type: "Renovation",
  description: "",
  reason: "",
  priority: "Normal",
  manager: "Avery Chen",
  plannedStart: TODAY,
  estimatedCompletion: "",
  occupancyStatus: "Vacant",
  originalBudget: "",
  contingency: "",
  mustVacate: false,
  accessRequirements: "",
  internalNotes: "",
};

const steps = [
  { title: "Project identity", hint: "Property, unit and ownership", icon: Building2 },
  { title: "Scope & budget", hint: "Work, schedule and funding", icon: ClipboardList },
  { title: "Review & create", hint: "Confirm before saving draft", icon: ShieldCheck },
];

export function NewProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { properties, projects, createProject, user } = useStore();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const property = properties.find((p) => p.id === draft.propertyId);
  const unit = property?.units.find((u) => u.id === draft.unitId);

  const previewId = useMemo(() => {
    const highest = Math.max(1000, ...projects.map((project) => Number.parseInt(project.id.replace(/\D/g, ""), 10) || 0));
    return `PRJ-${highest + 1}`;
  }, [projects]);

  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const selectProperty = (propertyId: string) => {
    const next = properties.find((p) => p.id === propertyId);
    setDraft((current) => ({
      ...current,
      propertyId,
      unitId: next?.units[0]?.id ?? "",
      occupancyStatus: next?.units[0]?.occupancy ?? "Vacant",
    }));
    setErrors((current) => ({ ...current, propertyId: "", unitId: "" }));
  };

  const selectUnit = (unitId: string) => {
    const nextUnit = property?.units.find((u) => u.id === unitId);
    setDraft((current) => ({ ...current, unitId, occupancyStatus: nextUnit?.occupancy ?? current.occupancyStatus }));
    setErrors((current) => ({ ...current, unitId: "" }));
  };

  const validate = (targetStep: number) => {
    const nextErrors: Record<string, string> = {};
    if (targetStep >= 0) {
      if (!draft.name.trim()) nextErrors.name = "Give the project a short, descriptive name.";
      if (!draft.propertyId) nextErrors.propertyId = "Select an existing property.";
      if (!draft.unitId) nextErrors.unitId = "Select an existing unit.";
      if (!draft.manager) nextErrors.manager = "A responsible person is required.";
    }
    if (targetStep >= 1) {
      if (!draft.description.trim() || draft.description.trim().length < 20) nextErrors.description = "Describe the scope of work (at least 20 characters).";
      if (!draft.reason.trim()) nextErrors.reason = "Explain why the renovation is required.";
      if (!draft.plannedStart) nextErrors.plannedStart = "Planned start is required.";
      if (!draft.estimatedCompletion) nextErrors.estimatedCompletion = "Estimated completion is required.";
      if (draft.plannedStart && draft.estimatedCompletion && draft.estimatedCompletion < draft.plannedStart)
        nextErrors.estimatedCompletion = "Completion must be on or after the planned start.";
      if (parseMoneyToCents(draft.originalBudget) <= 0) nextErrors.originalBudget = "Enter the original approved budget.";
      if (draft.contingency && parseMoneyToCents(draft.contingency) < 0) nextErrors.contingency = "Contingency cannot be negative.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const next = () => {
    if (validate(step)) setStep((current) => Math.min(current + 1, 2));
  };

  const submit = () => {
    if (!validate(2)) return;
    setSubmitting(true);
    window.setTimeout(() => {
      const result = createProject(draft);
      setSubmitting(false);
      if (result.ok && result.id) {
        onCreated(result.id);
        setDraft(emptyDraft);
        setStep(0);
        onClose();
      } else if (result.error) {
        setErrors({ form: result.error });
      }
    }, 450);
  };

  const close = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create renovation project"
      description="Projects always reference existing property and unit records from the rental system. New projects start as Draft."
      icon={Hammer}
      size="lg"
      footer={
        <>
          <div className="mr-auto hidden items-center gap-1.5 text-[10px] text-u-muted sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-u-accent/80" /> Created by {user.name} · {dateLong(TODAY)}
          </div>
          {step > 0 && <Button variant="ghost" size="md" icon={ArrowLeft} onClick={() => setStep((current) => current - 1)}>Back</Button>}
          {step < 2 ? (
            <Button variant="primary" size="md" iconRight={ArrowRight} onClick={next}>Continue</Button>
          ) : (
            <Button variant="primary" size="md" icon={Check} loading={submitting} onClick={submit}>Create draft project</Button>
          )}
        </>
      }
    >
      <div className="mb-5 flex items-center gap-1.5">
        {steps.map((s, index) => {
          const StepIcon = s.icon;
          const complete = index < step;
          const active = index === step;
          return (
            <div key={s.title} className="flex flex-1 items-center gap-1.5">
              <button
                onClick={() => index < step && setStep(index)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition",
                  active ? "border-u-accent/35 bg-u-accent/[0.08]" : complete ? "border-u-ink/10 bg-u-ink/[0.03]" : "border-u-ink/[0.05]",
                )}
              >
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", active ? "border-u-accent/40 bg-u-accent/15 text-u-accent" : complete ? "border-u-ok/30 bg-u-ok/10 text-u-ok" : "border-u-ink/10 bg-u-ink/[0.03] text-u-muted")}>
                  {complete ? <Check className="h-3 w-3" /> : <StepIcon className="h-3 w-3" />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-[10.5px] font-semibold", active ? "text-u-ink" : "text-u-muted")}>{index + 1}. {s.title}</span>
                  <span className="hidden truncate text-[9px] text-u-muted sm:block">{s.hint}</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {errors.form && <div className="mb-3"><InfoNote tone="warning">{errors.form}</InfoNote></div>}

      {step === 0 && (
        <div className="animate-ap-slide-up space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Project name" required error={errors.name} htmlFor="np-name" hint="e.g. Kitchen & ensuite refresh">
              <Input id="np-name" autoFocus placeholder="What are we delivering?" value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Project ID" hint="Auto-generated">
              <div className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-u-ink/15 bg-u-ink/[0.02] px-3 font-mono text-[12px] text-u-accent">
                <Hash className="h-3.5 w-3.5 text-u-muted" /> {previewId}
              </div>
            </Field>
          </div>

          <div className="rounded-xl border border-u-ink/[0.07] bg-u-ink/[0.02] p-3">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-u-muted"><Building2 className="h-3.5 w-3.5 text-u-accent" /> Rental property & unit</p>
              <Badge tone="slate" icon={ShieldCheck}>Existing records only</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Property" required error={errors.propertyId}>
                <Select value={draft.propertyId} onChange={(e) => selectProperty(e.target.value)}>
                  <option value="">Select property…</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
                </Select>
              </Field>
              <Field label="Unit" required error={errors.unitId}>
                <Select value={draft.unitId} onChange={(e) => selectUnit(e.target.value)} disabled={!property}>
                  <option value="">{property ? "Select unit…" : "Select a property first"}</option>
                  {property?.units.map((u) => <option key={u.id} value={u.id}>Unit {u.number} — {u.beds} bd / {u.baths} ba · {u.occupancy}</option>)}
                </Select>
              </Field>
            </div>
            {property && unit && (
              <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-lg border border-u-ink/[0.06] bg-u-bg/60 px-3 py-2 sm:grid-cols-4">
                <div><p className="text-[9px] uppercase tracking-wide text-u-muted">Unit</p><p className="text-[11px] font-medium text-u-ink">{unit.number} · {unit.sqft} sqft</p></div>
                <div><p className="text-[9px] uppercase tracking-wide text-u-muted">Occupancy</p><p className="text-[11px] font-medium text-u-ink">{draft.occupancyStatus}</p></div>
                <div className="col-span-2"><p className="text-[9px] uppercase tracking-wide text-u-muted">Address</p><p className="flex items-center gap-1 truncate text-[11px] font-medium text-u-ink"><MapPin className="h-3 w-3 text-u-muted" /> {property.address}, {property.city}</p></div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Project type" required>
              <Select value={draft.type} onChange={(e) => set("type", e.target.value as ProjectType)}>
                {projectTypes.map((type) => <option key={type}>{type}</option>)}
              </Select>
            </Field>
            <Field label="Priority" required>
              <Select value={draft.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
                {priorities.map((priority) => <option key={priority}>{priority}</option>)}
              </Select>
            </Field>
            <Field label="Responsible person" required error={errors.manager}>
              <Select value={draft.manager} onChange={(e) => set("manager", e.target.value)}>
                {managers.map((manager) => <option key={manager}>{manager}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border border-u-ink/[0.06] bg-u-ink/[0.02] px-3 py-2.5">
              <Switch checked={draft.mustVacate} onChange={(checked) => set("mustVacate", checked)} label="Unit must be vacated for works" />
              <p className="mt-1 text-[10px] text-u-muted">Tenant notification history and move-out dates are tracked separately.</p>
            </div>
            <Field label="Occupancy status at creation" hint="Status is preserved on the unit record.">
              <Select value={draft.occupancyStatus} onChange={(e) => set("occupancyStatus", e.target.value as ProjectDraft["occupancyStatus"])}>
                {["Vacant", "Occupied", "Vacating", "Ready for rent"].map((status) => <option key={status}>{status}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="animate-ap-slide-up space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Scope of work" required error={errors.description} hint="Required before the project can be approved.">
              <Textarea rows={4} placeholder="Describe the work packages, rooms and key deliverables…" value={draft.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Reason for renovation" required error={errors.reason}>
              <Textarea rows={4} placeholder="Unit turn, damage, compliance, tenant experience…" value={draft.reason} onChange={(e) => set("reason", e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Planned start" required error={errors.plannedStart}>
              <Input type="date" value={draft.plannedStart} onChange={(e) => set("plannedStart", e.target.value)} />
            </Field>
            <Field label="Est. completion" required error={errors.estimatedCompletion}>
              <Input type="date" value={draft.estimatedCompletion} onChange={(e) => set("estimatedCompletion", e.target.value)} />
            </Field>
            <Field label="Original budget (CAD)" required error={errors.originalBudget}>
              <div className="relative"><DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-u-muted" /><Input className="pl-7 font-mono" inputMode="decimal" placeholder="44,000" value={draft.originalBudget} onChange={(e) => set("originalBudget", e.target.value)} /></div>
            </Field>
            <Field label="Contingency (CAD)" error={errors.contingency} hint="Held inside the budget">
              <div className="relative"><DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-u-muted" /><Input className="pl-7 font-mono" inputMode="decimal" placeholder="3,000" value={draft.contingency} onChange={(e) => set("contingency", e.target.value)} /></div>
            </Field>
          </div>

          <Field label="Access coordination requirements" hint="Keys, elevators, parking, resident access windows.">
            <Input placeholder="Lockbox, elevator booking, parking instructions…" value={draft.accessRequirements} onChange={(e) => set("accessRequirements", e.target.value)} />
          </Field>

          <Field label="Internal notes" hint="Visible only to workspace members.">
            <Textarea rows={2} placeholder="Procurement notes, owner preferences, approval context…" value={draft.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} />
          </Field>

          <InfoNote>
            The original budget is preserved permanently. Later changes must be traceable to an approved change order or authorized adjustment. Taxes are recorded per transaction — no default rate is applied.
          </InfoNote>
        </div>
      )}

      {step === 2 && (
        <div className="animate-ap-slide-up space-y-3">
          <div className="overflow-hidden rounded-xl border border-u-ink/[0.08] bg-u-ink/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.07] bg-gradient-to-r from-u-accent/[0.06] to-transparent px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-u-accent/30 bg-u-accent/10 text-u-accent"><Hammer className="h-3.5 w-3.5" /></span>
                <div>
                  <p className="text-[12.5px] font-semibold text-u-ink">{draft.name || "Untitled project"}</p>
                  <p className="font-mono text-[9.5px] text-u-muted">{previewId} · {draft.type} · {draft.priority} priority</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5"><StatusBadge status="Draft" /><Badge tone="slate">{user.name}</Badge></div>
            </div>
            <div className="grid gap-x-4 gap-y-2.5 p-3 sm:grid-cols-2">
              <ReviewRow icon={Building2} label="Property" value={property ? `${property.name}, ${property.city}` : "—"} />
              <ReviewRow icon={DoorOpen} label="Unit" value={unit ? `Unit ${unit.number} · ${unit.beds} bd / ${unit.baths} ba` : "—"} />
              <ReviewRow icon={CalendarDays} label="Planned schedule" value={`${dateLong(draft.plannedStart)} → ${dateLong(draft.estimatedCompletion)}`} />
              <ReviewRow icon={DollarSign} label="Original budget" value={draft.originalBudget ? `CAD ${draft.originalBudget}` : "—"} />
              <ReviewRow icon={FileSignature} label="Reason" value={draft.reason || "—"} />
              <ReviewRow icon={UserRound} label="Responsible" value={draft.manager} />
              <ReviewRow icon={Flag} label="Vacate required" value={draft.mustVacate ? "Yes — tenant coordination required" : "No"} />
              <ReviewRow icon={Sparkles} label="Lifecycle" value="Draft → Planned → Approved" />
            </div>
          </div>
          <div className="rounded-xl border border-u-ink/[0.06] bg-u-bg/50 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-u-muted">Scope summary</p>
            <p className="text-[11.5px] leading-relaxed text-u-ink2">{draft.description || "No scope captured yet."}</p>
          </div>
          <InfoNote tone="success">
            On creation, the project is logged with a unique ID, creator, timestamp, and a draft status entry in the audit trail. Standard milestones are generated from the planned schedule.
          </InfoNote>
        </div>
      )}
    </Modal>
  );
}

function ReviewRow({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-u-muted" />
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-u-muted">{label}</p>
        <p className="truncate text-[11px] text-u-ink">{value}</p>
      </div>
    </div>
  );
}
