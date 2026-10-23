import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  Settings2,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { PageProps } from "../types";
import { formatTime } from "../utils";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Field, Input, Segmented, Select, Toggle } from "../components/ui";

const EVENTS = [
  { key: "rentDue", label: "Rent due reminders", description: "Upcoming and scheduled rent payments", icon: Clock3 },
  { key: "overdueRent", label: "Overdue rent alerts", description: "Balances past the grace period", icon: AlertTriangle },
  { key: "leaseRenewal", label: "Lease expiration & renewal", description: "Upcoming lease end and renewal reminders", icon: BellRing },
  { key: "maintenance", label: "Maintenance requests", description: "New requests and status changes", icon: Settings2 },
  { key: "emergency", label: "Emergency maintenance", description: "Priority 1 requests and escalations", icon: AlertTriangle },
  { key: "projectBudget", label: "Project budget warnings", description: "Threshold and overrun alerts", icon: Bell },
  { key: "invoicePayment", label: "Invoices & payments", description: "Issued invoices and recorded payments", icon: Mail },
  { key: "taskFailure", label: "Scheduled task failures", description: "Failed or missed scheduled executions", icon: Clock3 },
  { key: "automationFailure", label: "Workflow failures", description: "Automation errors and retry exhaustion", icon: Settings2 },
];

const RECIPIENT_OPTIONS = [
  "Tenants",
  "Owners & Property Managers",
  "Owners & Administrators",
  "Property Managers",
  "Maintenance Staff",
  "Owners & on-call staff",
  "Accountants",
  "Administrators",
];

const TEMPLATES = {
  "Rent due reminder": {
    subject: "Rent reminder · Unit 4B at Maple Court",
    body: "Hi Jordan,\n\nThis is a friendly reminder that rent for Unit 4B is due on the 1st. Your balance is $1,850.00. You can pay securely from your tenant portal.\n\nThank you,\n{org}",
  },
  "Maintenance update": {
    subject: "Maintenance update · Work order WO-2026-0238",
    body: "Hi Jordan,\n\nYour maintenance request for the kitchen faucet has been assigned to a vendor. A team member will contact you to schedule access.\n\nThanks,\n{org}",
  },
  "Lease renewal": {
    subject: "Your lease at Maple Court is up for renewal",
    body: "Hi Jordan,\n\nYour current lease ends in 60 days. We'd love to have you stay. Reply to this message and we'll share renewal options.\n\nBest,\n{org}",
  },
};

export default function NotificationsPage({ value, update, readOnly, errors, notify }: PageProps) {
  const [template, setTemplate] = useState<keyof typeof TEMPLATES>("Rent due reminder");
  const [previewOpen, setPreviewOpen] = useState(true);
  const [channel, setChannel] = useState("Email");
  const [sending, setSending] = useState(false);

  const events = value.events ?? {};
  const updateEvent = (eventKey: string, field: string, fieldValue: unknown) => {
    update("events", { ...events, [eventKey]: { ...(events[eventKey] ?? {}), [field]: fieldValue } });
  };

  const sendTest = () => {
    if (!value.senderName?.trim()) {
      notify("Add a sender name first", "error", "The sender display name is required before a simulated test.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.replyTo ?? "")) {
      notify("Check the reply-to email", "error", "A valid reply-to address is required for the simulated test.");
      return;
    }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      notify(`Simulated ${channel.toLowerCase()} notification sent`, "success", "No real message was transmitted by this prototype.");
    }, 900);
  };

  const templateContent = TEMPLATES[template].body.replace("{org}", value.senderName || "Your property team");

  return (
    <div className="space-y-5">
      <Callout tone="info" icon={Smartphone} title="Simulated delivery channels">
        Email, SMS and in-app delivery are simulated. No real emails or texts are sent.
      </Callout>

      <Card id="notification-events">
        <CardHeader
          icon={Bell}
          title="Notification events"
          description="Choose channels and recipients for each organization-wide event."
          aside={<Badge tone="blue">Organization-wide</Badge>}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-u-line bg-u-s2/60 text-left  ">
                <th className="px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-u-muted sm:px-6">Event</th>
                <th className="w-[90px] px-2 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">In-app</th>
                <th className="w-[90px] px-2 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">Email</th>
                <th className="w-[110px] px-2 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">
                  SMS <span className="ml-1 rounded bg-u-line px-1 py-0.5 text-[8.5px] ">Sim</span>
                </th>
                <th className="w-[235px] px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">Recipients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line ">
              {EVENTS.map((event) => {
                const item = events[event.key] ?? { inApp: false, email: false, sms: false, recipients: RECIPIENT_OPTIONS[0] };
                const Icon = event.icon;
                return (
                  <tr key={event.key} className="group hover:bg-u-s2/50 ">
                    <td className="px-5 py-3 sm:px-6">
                      <div className="flex items-start gap-2.5">
                        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${event.key === "emergency" ? "text-u-danger" : "text-u-muted"}`} />
                        <div>
                          <p className="text-[12.5px] font-medium text-u-ink ">{event.label}</p>
                          <p className="text-[11px] text-u-muted ">{event.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <Toggle size="sm" label={`${event.label} in-app`} checked={!!item.inApp} disabled={readOnly} onChange={(checked) => updateEvent(event.key, "inApp", checked)} />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <Toggle size="sm" label={`${event.label} email`} checked={!!item.email} disabled={readOnly} onChange={(checked) => updateEvent(event.key, "email", checked)} />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <Toggle size="sm" label={`${event.label} SMS`} checked={!!item.sms} disabled={readOnly} onChange={(checked) => updateEvent(event.key, "sms", checked)} />
                    </td>
                    <td className="px-3 py-3">
                      <Select value={item.recipients} disabled={readOnly} onChange={(event2) => updateEvent(event.key, "recipients", event2.target.value)} className="h-8 text-[11.5px]">
                        {RECIPIENT_OPTIONS.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card id="notification-sender">
          <CardHeader icon={Mail} title="Sender & communication window" description="Identity and quiet hours used for outbound notification simulations." />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sender display name" required error={errors.senderName}>
                <Input value={value.senderName} disabled={readOnly} invalid={!!errors.senderName} onChange={(event) => update("senderName", event.target.value)} />
              </Field>
              <Field label="Reply-to email" required error={errors.replyTo}>
                <Input type="email" value={value.replyTo} disabled={readOnly} invalid={!!errors.replyTo} onChange={(event) => update("replyTo", event.target.value)} />
              </Field>
            </div>
            <Field label="Communication hours" hint="Notifications outside this window are held until the next available hour in the prototype." error={errors.communicationEnd}>
              <div className="flex items-center gap-2">
                <Input type="time" value={value.communicationStart} disabled={readOnly} onChange={(event) => update("communicationStart", event.target.value)} className="w-32" />
                <span className="text-[12px] text-u-muted">to</span>
                <Input type="time" value={value.communicationEnd} disabled={readOnly} invalid={!!errors.communicationEnd} onChange={(event) => update("communicationEnd", event.target.value)} className="w-32" />
                <span className="ml-1 text-[11.5px] text-u-muted ">
                  {formatTime(value.communicationStart)} – {formatTime(value.communicationEnd)}
                </span>
              </div>
            </Field>
            <Field label="Time zone">
              <Select value={value.timezone} disabled={readOnly} onChange={(event) => update("timezone", event.target.value)}>
                {["America/Los_Angeles — Pacific", "America/Denver — Mountain", "America/Chicago — Central", "America/New_York — Eastern"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-u-line px-3.5 py-2.5 ">
              <span>
                <span className="block text-[12.5px] font-medium text-u-ink ">Daily digest</span>
                <span className="block text-[11px] text-u-muted">Bundle low-priority notifications into one summary.</span>
              </span>
              <Toggle label="Daily digest" checked={!!value.dailyDigest} disabled={readOnly} onChange={(checked) => update("dailyDigest", checked)} />
            </label>
          </CardBody>
        </Card>

        <Card id="notification-test">
          <CardHeader icon={Sparkles} title="Message preview & test" description="Preview sample content and simulate a delivery." aside={<Badge tone="amber">Simulation</Badge>} />
          <CardBody className="space-y-3.5">
            <Field label="Message template">
              <Select value={template} disabled={readOnly} onChange={(event) => setTemplate(event.target.value as keyof typeof TEMPLATES)}>
                {Object.keys(TEMPLATES).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center justify-between gap-2">
              <Segmented
                value={channel}
                onChange={setChannel}
                options={[
                  { value: "Email", label: "Email" },
                  { value: "SMS", label: "SMS" },
                ]}
              />
              <button type="button" onClick={() => setPreviewOpen((current) => !current)} className="text-[11.5px] font-medium text-u-accent hover:text-u-accent ">
                {previewOpen ? "Hide preview" : "Show preview"}
              </button>
            </div>
            {previewOpen ? (
              <div className="overflow-hidden rounded-xl border border-u-line ">
                <div className="border-b border-u-line bg-u-s2/70 px-3 py-2  ">
                  <p className="text-[10.5px] text-u-muted">From: {value.senderName} &lt;{value.replyTo}&gt;</p>
                  <p className="mt-0.5 text-[12px] font-medium text-u-ink ">{TEMPLATES[template].subject}</p>
                </div>
                <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 font-sans text-[11.5px] leading-relaxed text-u-ink2 ">
                  {templateContent}
                </pre>
              </div>
            ) : null}
            <Button type="button" variant="primary" size="md" icon={sending ? Loader2 : Send} loading={sending} onClick={sendTest} disabled={readOnly} className="w-full">
              {sending ? "Sending simulated message…" : `Send simulated ${channel.toLowerCase()}`}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-center text-[10.5px] text-u-muted">
              <CheckCircle2 className="h-3 w-3" /> No real email or SMS is delivered.
            </p>
          </CardBody>
        </Card>
      </div>

      <Callout tone="neutral" icon={MessageSquare} title="Communication settings reused">
        These preferences extend the workspace Communication Settings. The actual message history and delivery logs remain in the Communications module.
      </Callout>
    </div>
  );
}
