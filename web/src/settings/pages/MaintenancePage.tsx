import {
  AlertTriangle,
  BellRing,
  ClipboardList,
  Clock3,
  ListChecks,
  PhoneCall,
  ShieldCheck,
  Tags,
  Wrench,
} from "lucide-react";
import type { PageProps } from "../types";
import { formatTime } from "../utils";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Field, Input, ListEditor, Select, SettingRow, Textarea, Toggle } from "../components/ui";

const priorities = [
  { key: "lowResponse", label: "Low", tone: "gray" as const, description: "Cosmetic or non-urgent", bar: "bg-u-line2" },
  { key: "normalResponse", label: "Normal", tone: "blue" as const, description: "Routine repair", bar: "bg-u-accent" },
  { key: "highResponse", label: "High", tone: "amber" as const, description: "Habitability concern", bar: "bg-u-warn" },
  { key: "emergencyResponse", label: "Emergency", tone: "red" as const, description: "Immediate risk to safety", bar: "bg-u-danger" },
];

export default function MaintenancePage({ value, update, readOnly, errors, notify }: PageProps) {
  const year = new Date().getFullYear();
  const preview = `${value.workOrderPrefix}${year}-${String(value.nextWorkOrderNumber || 0).padStart(4, "0")}`;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card id="work-orders">
          <CardHeader
            icon={Wrench}
            title="Work order identification"
            description="Numbering and default status for new maintenance requests."
            aside={<Badge tone="blue">Operations</Badge>}
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Work order prefix" error={errors.workOrderPrefix}>
                <Input value={value.workOrderPrefix} maxLength={10} disabled={readOnly} invalid={!!errors.workOrderPrefix} onChange={(event) => update("workOrderPrefix", event.target.value.toUpperCase())} />
              </Field>
              <Field label="Next work order number" error={errors.nextWorkOrderNumber}>
                <Input type="number" min={1} max={999999} value={value.nextWorkOrderNumber} disabled={readOnly} invalid={!!errors.nextWorkOrderNumber} onChange={(event) => update("nextWorkOrderNumber", Number(event.target.value))} />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-dashed border-u-line bg-u-s2/60 px-3.5 py-2.5  ">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">Next work order</p>
                <p className="mt-0.5 font-mono text-[13.5px] font-semibold text-u-ink ">{preview}</p>
              </div>
              <Badge tone="gray">Preview</Badge>
            </div>
            <Field label="Default work order status">
              <Select value={value.defaultStatus} disabled={readOnly} onChange={(event) => update("defaultStatus", event.target.value)}>
                {["Open · Unassigned", "Open · Triage", "Awaiting vendor", "Scheduled", "In progress"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Default assignment method" hint="How new requests are routed to a person or vendor.">
              <Select value={value.assignmentMethod} disabled={readOnly} onChange={(event) => update("assignmentMethod", event.target.value)}>
                {["Property manager triage", "Auto-assign to property manager", "Assign by property", "Vendor first available", "Unassigned queue"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card id="emergency">
          <CardHeader icon={AlertTriangle} title="Emergency instructions" description="Shown to staff and on-call responders for urgent requests." aside={<Badge tone="red">Priority 1</Badge>} />
          <CardBody className="space-y-4">
            <Field label="Emergency instructions" error={errors.emergencyInstructions}>
              <Textarea
                value={value.emergencyInstructions}
                disabled={readOnly}
                invalid={!!errors.emergencyInstructions}
                rows={7}
                onChange={(event) => update("emergencyInstructions", event.target.value)}
              />
            </Field>
            <Callout tone="danger" icon={PhoneCall} title="Simulated contact instructions">
              Emergency contacts are sample content. No calls, texts or escalations are actually sent.
            </Callout>
          </CardBody>
        </Card>
      </div>

      <Card id="priorities">
        <CardHeader icon={Clock3} title="Priority levels & response targets" description="The first-response target used to flag work orders that are past due." />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {priorities.map((priority) => (
              <div key={priority.key} className="relative overflow-hidden rounded-xl border border-u-line bg-u-card p-3.5  ">
                <span className={`absolute inset-x-0 top-0 h-0.5 ${priority.bar}`} />
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={priority.tone} dot>{priority.label}</Badge>
                  <span className="text-[10.5px] text-u-muted">hours</span>
                </div>
                <p className="mt-1.5 text-[11px] text-u-muted ">{priority.description}</p>
                <div className="mt-2.5">
                  <Field error={errors[priority.key]}>
                    <Input
                      type="number"
                      min={0}
                      max={720}
                      value={value[priority.key]}
                      disabled={readOnly}
                      invalid={!!errors[priority.key]}
                      onChange={(event) => update(priority.key, Number(event.target.value))}
                      className="h-8.5"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-u-muted ">
            Example: a high-priority request received at {formatTime("09:00")} should receive a first response by {formatTime("17:00")} ({value.highResponse || 0} hours).
          </p>
        </CardBody>
      </Card>

      <Card id="categories">
        <CardHeader
          icon={Tags}
          title="Maintenance categories"
          description="Categories available when staff or tenants create a request. Disabled categories stay on existing records."
          aside={<Button type="button" size="sm" variant="soft" icon={ListChecks} disabled={readOnly} onClick={() => notify("Use the field below to add a new category", "info")}>Manage list</Button>}
        />
        <CardBody>
          <Field error={errors.categories}>
            <ListEditor
              items={value.categories ?? []}
              onChange={(items) => update("categories", items)}
              readOnly={readOnly}
              allowDisable
              placeholder="Add a maintenance category"
              addLabel="Add category"
              emptyLabel="No maintenance categories configured."
            />
          </Field>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card id="vendors">
          <CardHeader icon={ShieldCheck} title="Vendors & approvals" description="Controls for using vendors and approving maintenance spending." />
          <CardBody className="divide-y divide-u-line py-0 ">
            <SettingRow title="Vendor approval required" description="New vendors must be approved before assignment.">
              <Toggle label="Vendor approval" checked={!!value.vendorApproval} disabled={readOnly} onChange={(checked) => update("vendorApproval", checked)} />
            </SettingRow>
            <SettingRow title="Insurance document reminders" description="Prompt vendors to refresh expiring insurance certificates." icon={BellRing}>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={value.insuranceReminderDays}
                  disabled={readOnly || !value.insuranceReminder}
                  onChange={(event) => update("insuranceReminderDays", Number(event.target.value))}
                  className="h-8.5 w-16 text-center"
                  aria-label="Insurance reminder days"
                />
                <span className="text-[11px] text-u-muted">days</span>
                <Toggle label="Insurance reminders" checked={!!value.insuranceReminder} disabled={readOnly} onChange={(checked) => update("insuranceReminder", checked)} />
              </div>
            </SettingRow>
            <SettingRow title="Spending approval threshold" description="Work orders at or above this amount require approval.">
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  prefix="$"
                  value={value.approvalThreshold}
                  disabled={readOnly}
                  invalid={!!errors.approvalThreshold}
                  onChange={(event) => update("approvalThreshold", Number(event.target.value))}
                  className="h-8.5 w-28 text-[12px]"
                />
              </div>
            </SettingRow>
          </CardBody>
          {errors.approvalThreshold ? <p className="px-5 pb-3 text-[11.5px] text-u-danger">{errors.approvalThreshold}</p> : null}
        </Card>

        <Card id="checklist">
          <CardHeader icon={ClipboardList} title="Default maintenance checklist" description="Suggested steps for every work order." />
          <CardBody>
            <ListEditor
              items={value.checklist ?? []}
              onChange={(items) => update("checklist", items)}
              readOnly={readOnly}
              placeholder="Add a checklist step"
              addLabel="Add step"
              emptyLabel="No default checklist steps."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
