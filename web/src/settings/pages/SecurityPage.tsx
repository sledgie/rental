import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  KeyRound,
  Lock,
  LockKeyhole,
  Shield,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { SECURITY_PERMISSIONS, ROLE_TONES } from "../mockSettings";
import type { PageProps, Role } from "../types";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Field, Input, MetaRow, ProtectedBadge, Select, SettingRow, Toggle } from "../components/ui";

const ROLES: Role[] = ["Owner", "Administrator", "Property Manager", "Accountant", "Maintenance Staff", "Read-Only / Auditor"];

const roleDescriptions: Record<Role, string> = {
  Owner: "Full control, including sensitive organization settings.",
  Administrator: "Most configuration except protected Owner actions.",
  "Property Manager": "Property, leasing, maintenance and project defaults.",
  Accountant: "Financial defaults, documents and data exports.",
  "Maintenance Staff": "Maintenance and vendor defaults only.",
  "Read-Only / Auditor": "View permitted settings and audit history.",
};

export default function SecurityPage({ value, update, readOnly, errors, members, openDirectory }: PageProps) {
  const owners = members.filter((member) => member.role === "Owner" && member.status === "Active");
  const matrix = value.matrix ?? {};
  const matrixEditable = !readOnly;

  const updatePermission = (role: Role, permission: string, checked: boolean) => {
    if (role === "Owner") return;
    update("matrix", {
      ...matrix,
      [role]: { ...(matrix[role] ?? {}), [permission]: checked },
    });
  };

  const countRole = (role: Role) => members.filter((member) => member.role === role && member.status !== "Invited").length;

  return (
    <div className="space-y-5">
      <Callout tone="warning" icon={ShieldCheck} title="Simulated access controls">
        Roles and permissions configure UI behavior only. This frontend prototype does not provide production authentication or backend authorization.
      </Callout>

      <Card id="security-members">
        <CardHeader
          icon={Users}
          title="Membership roles"
          description="Existing organization memberships shape which settings can be edited in this workspace."
          aside={
            <Button type="button" size="sm" variant="secondary" icon={UserCog} onClick={() => openDirectory("members")}>
              View members
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {ROLES.map((role) => {
              const isOwner = role === "Owner";
              return (
                <div
                  key={role}
                  className={`rounded-xl border p-3.5 ${isOwner ? "border-u-accent/30 bg-u-accent-soft/40  " : "border-u-line bg-u-card  "}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset ${ROLE_TONES[role]}`}>{role}</span>
                    <span className="text-[11px] font-semibold text-u-muted ">{countRole(role)} member{countRole(role) === 1 ? "" : "s"}</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-u-muted ">{roleDescriptions[role]}</p>
                  {isOwner ? <div className="mt-2 flex items-center gap-1.5"><ProtectedBadge /><span className="text-[10px] text-u-muted">Last owner protected</span></div> : null}
                </div>
              );
            })}
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-u-line bg-u-s2/60 px-3.5 py-2.5  ">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-u-muted" />
            <p className="text-[11.5px] leading-relaxed text-u-muted ">
              The last active Owner ({owners[0]?.name ?? "Avery Bennett"}) cannot be removed, suspended or demoted. Ownership transfer requires another active Owner and is not available in this prototype.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card id="security-matrix">
        <CardHeader
          icon={Shield}
          title="Role-based permission matrix"
          description="Permissions applied to the workspace UI. Owner permissions are locked to protect organization control."
          aside={<Badge tone="violet">{members.length} members</Badge>}
        />
        {errors.matrix ? (
          <div className="flex items-center gap-2 border-b border-u-danger/30 bg-u-danger-soft px-5 py-2 text-[11.5px] font-medium text-u-danger   ">
            <AlertTriangle className="h-3.5 w-3.5" /> {errors.matrix}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-u-line bg-u-s2/60  ">
                <th className="sticky left-0 z-10 bg-u-s2/95 px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-u-muted backdrop-blur  sm:px-6">Permission</th>
                {ROLES.map((role) => (
                  <th key={role} className="px-2 py-2.5 text-center text-[10.5px] font-semibold text-u-muted">
                    <span className={role === "Owner" ? "text-u-accent " : ""}>{role.replace("Read-Only / Auditor", "Auditor")}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line ">
              {SECURITY_PERMISSIONS.map((permission) => (
                <tr key={permission.id} className="hover:bg-u-s2/40 ">
                  <td className="sticky left-0 z-10 bg-u-card px-5 py-2.5  sm:px-6">
                    <p className="text-[12px] font-medium text-u-ink ">{permission.label}</p>
                    <p className="text-[10.5px] text-u-muted ">{permission.hint}</p>
                  </td>
                  {ROLES.map((role) => {
                    const owner = role === "Owner";
                    const enabled = !!matrix[role]?.[permission.id];
                    return (
                      <td key={role} className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={enabled}
                          aria-label={`${role}: ${permission.label}`}
                          disabled={owner || !matrixEditable}
                          onClick={() => updatePermission(role, permission.id, !enabled)}
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition disabled:cursor-not-allowed ${
                            enabled
                              ? owner
                                ? "border-u-accent/30 bg-u-accent-soft text-u-accent   "
                                : "border-u-accent/60 bg-u-accent text-u-onaccent"
                              : "border-u-line bg-u-card text-transparent  "
                          } ${owner ? "opacity-90" : "hover:border-u-accent/60"}`}
                        >
                          {enabled ? owner ? <Lock className="h-2.5 w-2.5" /> : <Check className="h-3 w-3" strokeWidth={3} /> : <span className="h-1 w-1 rounded-full bg-u-line" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-u-line px-5 py-2.5 text-[10.5px] text-u-muted  sm:px-6">
          <span>Owner column is protected and cannot be reduced.</span>
          <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> UI-level simulation</span>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card id="security-policy">
          <CardHeader icon={LockKeyhole} title="Session & account policy" description="Applies to all workspace members in the prototype." />
          <CardBody className="space-y-4">
            <Field label="Session timeout">
              <Select value={value.sessionTimeout} disabled={readOnly} onChange={(event) => update("sessionTimeout", event.target.value)}>
                {["15 minutes", "30 minutes", "1 hour", "4 hours", "8 hours"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Invitation expiration (days)" error={errors.invitationExpiryDays}>
              <Input type="number" min={1} max={90} value={value.invitationExpiryDays} disabled={readOnly} invalid={!!errors.invitationExpiryDays} onChange={(event) => update("invitationExpiryDays", Number(event.target.value))} />
            </Field>
            <Field label="Account suspension policy">
              <Select value={value.suspensionPolicy} disabled={readOnly} onChange={(event) => update("suspensionPolicy", event.target.value)}>
                {["Suspend after 10 failed sign-in attempts", "Suspend after 5 failed sign-in attempts", "Manual suspension only"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <div className="rounded-lg border border-u-line p-3 ">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-u-ink "><KeyRound className="h-3.5 w-3.5 text-u-muted" /> Password policy</p>
                <Badge tone="gray"><Lock className="h-3 w-3" /> Managed</Badge>
              </div>
              <ul className="mt-2 space-y-1 text-[11.5px] text-u-muted ">
                <li>• Minimum 12 characters with upper, lower, number and symbol</li>
                <li>• Password reuse blocked for the last 5 passwords</li>
                <li>• Password policy is displayed for reference and is not enforced by a backend.</li>
              </ul>
            </div>
          </CardBody>
        </Card>

        <Card id="security-sensitive">
          <CardHeader icon={ShieldCheck} title="Sensitive data & financial actions" description="Additional protections for money movement and documents." />
          <CardBody className="space-y-4">
            <Field label="Sensitive financial actions">
              <Select value={value.sensitiveFinancialAction} disabled={readOnly} onChange={(event) => update("sensitiveFinancialAction", event.target.value)}>
                {[
                  "Require Owner or Administrator approval",
                  "Require Owner approval",
                  "Require two-person approval",
                  "Allow without additional approval",
                ].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Document access permissions" error={errors.documentAccess}>
              <Select value={value.documentAccess} disabled={readOnly} onChange={(event) => update("documentAccess", event.target.value)}>
                {["Role-based access", "Property assignment only", "Organization-wide read access", "Owner & Administrator only"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <SettingRow title="Track audit events" description="Record mock security and configuration events in the activity log.">
              <Toggle label="Audit event tracking" checked={!!value.auditTracking} disabled={readOnly} onChange={(checked) => update("auditTracking", checked)} />
            </SettingRow>
            <div className="flex items-center justify-between rounded-lg bg-u-s2 px-3 py-2.5 text-[11.5px] text-u-muted  ">
              <span className="flex items-center gap-1.5"><ArrowUpRight className="h-3.5 w-3.5" /> Reused activity log · no sensitive values recorded</span>
              <button type="button" onClick={() => openDirectory("activity")} className="font-semibold text-u-accent hover:text-u-accent ">View</button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card id="security-audit">
          <CardHeader icon={ShieldCheck} title="Audit event tracking" description="Choose which simulated events create activity records." />
          <CardBody className="space-y-2">
            {[
              ["signIn", "Member sign-in events"],
              ["permissionChanges", "Role and permission changes"],
              ["financialEdits", "Financial setting changes"],
              ["exports", "Configuration and data exports"],
            ].map(([key, label]) => (
              <ToggleRow
                key={key}
                label={String(label)}
                checked={!!value.auditEvents?.[key]}
                disabled={readOnly || !value.auditTracking}
                onChange={(checked) => update("auditEvents", { ...(value.auditEvents ?? {}), [key]: checked })}
              />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={AlertTriangle} title="Security notifications" description="Alerts sent to Owners and Administrators." />
          <CardBody className="space-y-2">
            {[
              ["failedSignIn", "Failed sign-in attempts"],
              ["newDevice", "Sign-in from a new device"],
              ["roleChange", "Membership role changes"],
              ["exportFailure", "Failed data exports"],
            ].map(([key, label]) => (
              <ToggleRow
                key={key}
                label={String(label)}
                checked={!!value.securityAlerts?.[key]}
                disabled={readOnly}
                onChange={(checked) => update("securityAlerts", { ...(value.securityAlerts ?? {}), [key]: checked })}
              />
            ))}
            <div className="pt-2">
              <MetaRow label="Notification recipients"><Badge tone="blue">Owners & Administrators</Badge></MetaRow>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5">
      <span className="text-[12.5px] text-u-ink2 ">{label}</span>
      <Toggle label={label} size="sm" checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}
