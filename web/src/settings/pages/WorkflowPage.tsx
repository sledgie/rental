import {
  AlertTriangle,
  ArrowUpRight,
  Gauge,
  GitBranch,
  Info,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { PageProps } from "../types";
import { Badge, Callout, Card, CardBody, CardHeader, Field, Input, RadioCards, Select, SettingRow, Toggle } from "../components/ui";

export default function WorkflowPage({ value, update, readOnly, errors, navigate, notify }: PageProps) {
  return (
    <div className="space-y-5">
      <Card id="workflow-execution" className="overflow-hidden">
        <div className="relative bg-gradient-to-r from-u-accent-soft/80 via-white to-white px-5 py-5 sm:px-6   ">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-u-accent text-u-onaccent shadow-sm shadow-u-accent/25">
                <Zap className="h-5 w-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-u-ink ">Workflow automation</h3>
                  <Badge tone={value.enabled ? "green" : "gray"} dot>
                    {value.enabled ? "Execution enabled" : "Execution paused"}
                  </Badge>
                </div>
                <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-u-muted ">
                  Master switch for all event-driven automations in this organization. Disabling it pauses execution everywhere without deleting workflows.
                </p>
              </div>
            </div>
            <Toggle
              label="Organization-wide automation execution"
              checked={!!value.enabled}
              disabled={readOnly}
              onChange={(checked) => update("enabled", checked)}
            />
          </div>
          {!value.enabled ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-u-warn/30 bg-u-warn-soft px-3 py-2 text-[11.5px] text-u-warn   ">
              <AlertTriangle className="h-3.5 w-3.5" /> All workflow execution is paused. Existing automations are not deleted.
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card id="workflow-guardrails">
          <CardHeader icon={ShieldCheck} title="Approvals & guardrails" description="Sensitive actions can require human review before a workflow completes." />
          <CardBody className="space-y-5">
            <SettingRow title="Require approval for sensitive actions" description="Hold executions that change protected records until approved." className="pt-0">
              <Toggle label="Require approval for sensitive actions" checked={!!value.requireApproval} disabled={readOnly} onChange={(checked) => update("requireApproval", checked)} />
            </SettingRow>
            <Field label="Automations affecting financial records">
              <RadioCards
                columns={1}
                value={value.financialAutomations}
                disabled={readOnly || !value.enabled}
                onChange={(next) => update("financialAutomations", next)}
                options={[
                  { value: "Block", label: "Block financial automations", description: "Workflows cannot create or change financial records." },
                  { value: "Require approval", label: "Require approval", description: "Financial changes wait for an Owner or Administrator." },
                  { value: "Allow", label: "Allow with audit log", description: "Financial changes execute and are recorded in the activity log." },
                ]}
              />
            </Field>
            <Field label="Automations sending external communications">
              <RadioCards
                columns={1}
                value={value.externalCommunications}
                disabled={readOnly || !value.enabled}
                onChange={(next) => update("externalCommunications", next)}
                options={[
                  { value: "Block", label: "Block external communications", description: "Workflows cannot send email or SMS." },
                  { value: "Require approval", label: "Require approval", description: "Messages wait for a team member to approve them." },
                  { value: "Allow", label: "Allow with audit log", description: "Messages execute and are recorded. Delivery is simulated." },
                ]}
              />
            </Field>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card id="workflow-reliability">
            <CardHeader icon={RefreshCw} title="Failure handling" description="Retries and notifications when automation execution fails." />
            <CardBody className="space-y-4">
              <SettingRow title="Failure notifications" className="pt-0">
                <Toggle label="Automation failure notifications" checked={!!value.failureNotifications} disabled={readOnly} onChange={(checked) => update("failureNotifications", checked)} />
              </SettingRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Retry policy">
                  <Select value={value.retryPolicy} disabled={readOnly} onChange={(event) => update("retryPolicy", event.target.value)}>
                    {["No retries", "Fixed interval", "Exponential backoff", "Retry once immediately"].map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Retry count" error={errors.retryCount}>
                  <Input type="number" min={0} max={10} value={value.retryCount} disabled={readOnly} invalid={!!errors.retryCount} onChange={(event) => update("retryCount", Number(event.target.value))} />
                </Field>
              </div>
              <Field label="Failure recipients">
                <Select value={value.failureRecipients} disabled={readOnly} onChange={(event) => update("failureRecipients", event.target.value)}>
                  {["Administrators", "Owners & Administrators", "Workflow owner", "All workspace members"].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Card id="workflow-limits">
            <CardHeader icon={Gauge} title="Execution limits" description="Safety limits that apply across all event-driven automations." />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Max runs / day" error={errors.maxRunsPerDay}>
                  <Input type="number" min={1} max={10000} value={value.maxRunsPerDay} disabled={readOnly} invalid={!!errors.maxRunsPerDay} onChange={(event) => update("maxRunsPerDay", Number(event.target.value))} />
                </Field>
                <Field label="Max concurrent" error={errors.maxConcurrent}>
                  <Input type="number" min={1} max={100} value={value.maxConcurrent} disabled={readOnly} invalid={!!errors.maxConcurrent} onChange={(event) => update("maxConcurrent", Number(event.target.value))} />
                </Field>
              </div>
              <Field label="Execution history retention (months)" error={errors.retentionMonths}>
                <Input type="number" min={1} max={60} value={value.retentionMonths} disabled={readOnly} invalid={!!errors.retentionMonths} onChange={(event) => update("retentionMonths", Number(event.target.value))} />
              </Field>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-u-violet/15 text-u-violet ring-1 ring-u-violet/10   ">
              <GitBranch className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-medium text-u-ink ">The workflow builder stays in the Workflow Automation module</p>
              <p className="mt-0.5 max-w-2xl text-[11.5px] leading-relaxed text-u-muted ">
                These settings define global defaults, restrictions and execution limits. Creating triggers, conditions and actions happens outside Settings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => notify("Workflow builder is part of the automation module", "info", "This prototype focuses on configuration. No workflow editor is included.")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-u-line bg-u-card px-3 py-2 text-[12px] font-medium text-u-ink2 shadow-sm hover:bg-u-s2    "
          >
            About the module <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </CardBody>
      </Card>

      <Callout tone="neutral" icon={Info} title="Prototype guardrails">
        Automation restrictions are simulated UI rules. No background workers, payment actions or external messages are executed.
      </Callout>
      <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-u-muted ">
        <LockKeyhole className="h-3 w-3" />
        Requires Owner or Administrator access to change global automation settings.{" "}
        <button type="button" onClick={() => navigate("security")} className="font-medium text-u-accent hover:text-u-accent ">
          Review permissions
        </button>
      </div>
    </div>
  );
}
