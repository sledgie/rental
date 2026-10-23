import {
  BellRing,
  BriefcaseBusiness,
  ClipboardCheck,
  DollarSign,
  FileStack,
  FolderKanban,
  Hash,
  Info,
  Tags,
  UserRound,
} from "lucide-react";
import type { PageProps } from "../types";
import { Badge, Callout, Card, CardBody, CardHeader, Field, Input, ListEditor, Select, SettingRow, Toggle } from "../components/ui";

export default function ProjectsPage({ value, update, readOnly, errors }: PageProps) {
  return (
    <div className="space-y-5">
      <Callout tone="neutral" icon={Info} title="Configuration for the Projects module">
        These settings define defaults and guardrails for projects performed on properties or units. Project creation and management stay in the Projects module.
      </Callout>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card id="project-identification">
          <CardHeader
            icon={FolderKanban}
            title="Project numbering & priority"
            description="Identifiers and defaults applied when a new capital project is created."
            aside={<Badge tone="blue">Operations</Badge>}
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project number prefix" error={errors.projectPrefix}>
                <Input value={value.projectPrefix} maxLength={10} disabled={readOnly} invalid={!!errors.projectPrefix} onChange={(event) => update("projectPrefix", event.target.value.toUpperCase())} />
              </Field>
              <Field label="Next project number" error={errors.nextProjectNumber}>
                <Input type="number" min={1} max={999999} value={value.nextProjectNumber} disabled={readOnly} invalid={!!errors.nextProjectNumber} onChange={(event) => update("nextProjectNumber", Number(event.target.value))} />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-dashed border-u-line bg-u-s2/60 px-3.5 py-2.5  ">
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-u-muted" />
                <span className="font-mono text-[13px] font-semibold text-u-ink ">
                  {value.projectPrefix}{new Date().getFullYear()}-{String(value.nextProjectNumber || 0).padStart(4, "0")}
                </span>
              </div>
              <span className="text-[10.5px] text-u-muted">Next project preview</span>
            </div>
            <Field label="Default project priority">
              <Select value={value.defaultPriority} disabled={readOnly} onChange={(event) => update("defaultPriority", event.target.value)}>
                {["Low", "Normal", "High", "Urgent"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card id="project-budgets">
          <CardHeader icon={DollarSign} title="Budgets & approvals" description="Warnings and approval gates for capital spending." />
          <CardBody className="space-y-4">
            <Field label="Budget warning threshold" error={errors.budgetWarningThreshold} hint="Warn project managers when spending reaches this share of budget.">
              <Input type="number" min={1} max={100} prefix="%" value={value.budgetWarningThreshold} disabled={readOnly} invalid={!!errors.budgetWarningThreshold} onChange={(event) => update("budgetWarningThreshold", Number(event.target.value))} />
            </Field>
            <Field label="Spending approval threshold" error={errors.approvalThreshold} hint="Projects above this amount need Owner or Administrator approval.">
              <Input type="number" min={0} prefix="$" value={value.approvalThreshold} disabled={readOnly} invalid={!!errors.approvalThreshold} onChange={(event) => update("approvalThreshold", Number(event.target.value))} />
            </Field>
            <div>
              <div className="mb-1 flex items-center justify-between text-[10.5px] text-u-muted">
                <span>0%</span>
                <span className="font-medium text-u-muted ">Warning at {value.budgetWarningThreshold}%</span>
                <span>100%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-u-s3 ">
                <div className="h-full rounded-full bg-u-warn transition-all" style={{ width: `${Math.min(100, Math.max(0, Number(value.budgetWarningThreshold) || 0))}%` }} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card id="project-lists">
          <CardHeader icon={Tags} title="Project categories" description="Categories for organizing capital improvements and repairs." />
          <CardBody>
            <Field error={errors.categories}>
              <ListEditor
                items={value.categories ?? []}
                onChange={(items) => update("categories", items)}
                readOnly={readOnly}
                allowDisable
                placeholder="Add a project category"
                addLabel="Add category"
                emptyLabel="No project categories configured."
              />
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={ClipboardCheck} title="Project statuses" description="Status options available to project managers." />
          <CardBody>
            <Field error={errors.statuses}>
              <ListEditor
                items={value.statuses ?? []}
                onChange={(items) => update("statuses", items)}
                readOnly={readOnly}
                allowDisable
                placeholder="Add a project status"
                addLabel="Add status"
                emptyLabel="No project statuses configured."
              />
            </Field>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <Card id="project-docs">
          <CardHeader icon={FileStack} title="Required project documentation" description="Checks applied before a project can move past planning." />
          <CardBody>
            <ListEditor
              items={value.requiredDocs ?? []}
              onChange={(items) => update("requiredDocs", items)}
              readOnly={readOnly}
              placeholder="Add a required document"
              addLabel="Add document"
              emptyLabel="No required documents."
            />
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={UserRound} title="Project manager assignment" description="Default routing for new projects." />
            <CardBody>
              <Field label="Assignment default">
                <Select value={value.managerAssignment} disabled={readOnly} onChange={(event) => update("managerAssignment", event.target.value)}>
                  {["Assign property manager by portfolio", "Assign to creating user", "Assign to Owner", "Leave unassigned for triage"].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={BellRing} title="Budget overrun alerts" />
            <CardBody className="divide-y divide-u-line py-0 ">
              <SettingRow title="Notify on budget overrun" description="Send an alert when a project exceeds its approved budget.">
                <Toggle label="Budget overrun notification" checked={!!value.budgetOverrunNotify} disabled={readOnly} onChange={(checked) => update("budgetOverrunNotify", checked)} />
              </SettingRow>
              <SettingRow title="Recipients" description="Who receives overrun notifications." icon={BriefcaseBusiness}>
                <Select
                  value={value.overrunRecipients}
                  disabled={readOnly || !value.budgetOverrunNotify}
                  onChange={(event) => update("overrunRecipients", event.target.value)}
                  className="h-8.5 w-[190px] text-[12px]"
                >
                  {["Owners & Administrators", "Project managers only", "Owners only", "All workspace members"].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </Select>
              </SettingRow>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader icon={ClipboardCheck} title="Project completion checklist" description="Standard closeout steps for every project." />
        <CardBody>
          <ListEditor
            items={value.completionChecklist ?? []}
            onChange={(items) => update("completionChecklist", items)}
            readOnly={readOnly}
            placeholder="Add a completion step"
            addLabel="Add step"
            emptyLabel="No completion steps."
          />
        </CardBody>
      </Card>
    </div>
  );
}
