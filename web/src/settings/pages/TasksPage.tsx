import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  Info,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import type { PageProps } from "../types";
import { formatTime } from "../utils";
import { Badge, Callout, Card, CardBody, CardHeader, Field, Input, Select, SettingRow, Toggle } from "../components/ui";

export default function TasksPage({ value, update, readOnly, errors }: PageProps) {
  const windowDuration = (() => {
    const [startH, startM] = (value.windowStart ?? "01:00").split(":").map(Number);
    const [endH, endM] = (value.windowEnd ?? "05:00").split(":").map(Number);
    const duration = (endH * 60 + endM - (startH * 60 + startM) + 1440) % 1440;
    return duration;
  })();

  return (
    <div className="space-y-5">
      <Callout tone="info" icon={Info} title="Defaults, not the task scheduler">
        Settings configure how scheduled tasks behave across the workspace. Individual jobs are created, viewed and managed in the <strong>Scheduled Tasks</strong> module. This page does not create or duplicate jobs.
      </Callout>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card id="task-schedule">
          <CardHeader
            icon={CalendarClock}
            title="Scheduling & execution window"
            description="Organization defaults used when a new scheduled task is created."
            aside={<Badge tone="blue">Organization-wide</Badge>}
          />
          <CardBody className="space-y-4">
            <Field label="Default scheduling time zone" error={errors.timezone}>
              <Select value={value.timezone} disabled={readOnly} invalid={!!errors.timezone} onChange={(event) => update("timezone", event.target.value)}>
                {[
                  "America/Los_Angeles — Pacific",
                  "America/Denver — Mountain",
                  "America/Chicago — Central",
                  "America/New_York — Eastern",
                  "Europe/London — London",
                ].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Default execution window" error={errors.windowEnd} hint="Tasks are scheduled inside this window when no specific time is configured.">
              <div className="flex flex-wrap items-center gap-2">
                <Input type="time" value={value.windowStart} disabled={readOnly} onChange={(event) => update("windowStart", event.target.value)} className="w-32" />
                <span className="text-[12px] text-u-muted">to</span>
                <Input type="time" value={value.windowEnd} disabled={readOnly} invalid={!!errors.windowEnd} onChange={(event) => update("windowEnd", event.target.value)} className="w-32" />
                <span className="ml-1 rounded-md bg-u-s3 px-2 py-1 text-[10.5px] font-medium text-u-muted  ">
                  {formatTime(value.windowStart)} – {formatTime(value.windowEnd)}
                </span>
              </div>
            </Field>
            <div className="flex items-center gap-2 rounded-lg bg-u-s2 px-3 py-2.5 text-[11.5px] text-u-muted  ">
              <Clock3 className="h-3.5 w-3.5 shrink-0" />
              Configured window closes {Math.round((windowDuration / 60) * 10) / 10} hours after it opens. Overnight windows are supported.
            </div>
            <Field label="Default reminder delivery timing">
              <Select value={value.reminderTiming} disabled={readOnly} onChange={(event) => update("reminderTiming", event.target.value)}>
                {["1 hour before", "6 hours before", "12 hours before", "24 hours before", "2 days before"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card id="task-reliability">
          <CardHeader icon={RefreshCw} title="Retries & reliability" description="How the system retries failed executions." />
          <CardBody className="space-y-4">
            <Field label="Retry count" error={errors.retryCount} hint="Set to 0 to disable automatic retries.">
              <Input type="number" min={0} max={10} value={value.retryCount} disabled={readOnly} invalid={!!errors.retryCount} onChange={(event) => update("retryCount", Number(event.target.value))} />
            </Field>
            <Field label="Retry interval (minutes)" error={errors.retryIntervalMinutes}>
              <Input type="number" min={1} max={1440} value={value.retryIntervalMinutes} disabled={readOnly} invalid={!!errors.retryIntervalMinutes} onChange={(event) => update("retryIntervalMinutes", Number(event.target.value))} />
            </Field>
            <div className="flex items-start gap-2 rounded-lg bg-u-s2 px-3 py-2.5 text-[11.5px] leading-relaxed text-u-muted  ">
              <AlarmClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              A failed job may be attempted {value.retryCount} more time{Number(value.retryCount) === 1 ? "" : "s"}, spaced {value.retryIntervalMinutes} minutes apart.
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card id="task-notifications">
          <CardHeader icon={ShieldAlert} title="Failures & missed tasks" description="Who is notified when executions fail or windows close." />
          <CardBody className="divide-y divide-u-line py-0 ">
            <SettingRow title="Failure notifications" description="Notify administrators when an execution fails.">
              <Toggle label="Failure notifications" checked={!!value.failureNotifications} disabled={readOnly} onChange={(checked) => update("failureNotifications", checked)} />
            </SettingRow>
            <SettingRow title="Missed-task alerts" description="Alert when a scheduled window closes without a successful run." icon={AlarmClock}>
              <Toggle label="Missed-task alerts" checked={!!value.missedTaskAlerts} disabled={readOnly} onChange={(checked) => update("missedTaskAlerts", checked)} />
            </SettingRow>
            <SettingRow title="Failure recipients" description="Applies to failure and missed-task alerts.">
              <Select value={value.failureRecipients} disabled={readOnly} onChange={(event) => update("failureRecipients", event.target.value)} className="h-8.5 w-[200px] text-[12px]">
                {["Owners & Administrators", "Administrators", "Owners only", "Task creator only"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </SettingRow>
            <SettingRow title="Missed-task recipients">
              <Select value={value.missedTaskRecipients} disabled={readOnly} onChange={(event) => update("missedTaskRecipients", event.target.value)} className="h-8.5 w-[200px] text-[12px]">
                {["Administrators", "Owners & Administrators", "Owners only", "Task creator only"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </SettingRow>
          </CardBody>
        </Card>

        <Card id="task-history">
          <CardHeader icon={History} title="Execution history" description="Retention period for task execution records and their output." />
          <CardBody className="space-y-4">
            <Field label="History retention (months)" error={errors.retentionMonths} hint="Older execution records are marked for simulated cleanup.">
              <Input type="number" min={1} max={120} value={value.retentionMonths} disabled={readOnly} invalid={!!errors.retentionMonths} onChange={(event) => update("retentionMonths", Number(event.target.value))} />
            </Field>
            <div className="rounded-xl border border-u-line px-3.5 py-3 ">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-u-ok" />
                <p className="text-[12px] font-medium text-u-ink ">Retention active</p>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-u-muted ">
                Execution history is kept for {value.retentionMonths} months. No records are deleted by this frontend prototype.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
