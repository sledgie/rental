import { useEffect, useState } from "react";
import { Link2, Mail, ShieldCheck, UserCheck, UserPlus } from "lucide-react";
import { Alert, Button, Modal, SelectInput, TextInput } from "../../components/ui";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useToast } from "../../contexts/ToastContext";
import { ASSIGNABLE_ROLES } from "../../lib/format";
import { isValidEmail, roleDescriptions } from "../../lib/format";
import { userService } from "../../services";
import type { Role } from "../../lib/types";

export function InviteMemberModal({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited?: () => void;
}) {
  const { activeOrganization, inviteMember } = useOrganization();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Property Manager");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [existingName, setExistingName] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("Property Manager");
      setError(null);
      setFieldError(null);
      setExistingName(null);
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!isValidEmail(email)) {
      setExistingName(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const timer = window.setTimeout(() => {
      userService.getUserDirectory()
        .then((users) => {
          if (cancelled) return;
          const match = users.find((user) => user.email.toLowerCase() === email.trim().toLowerCase());
          setExistingName(match?.fullName ?? null);
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [email]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim()) {
      setFieldError("Enter an email address.");
      return;
    }
    if (!isValidEmail(email)) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      await inviteMember(email.trim(), role);
      toast({
        title: "Invitation created",
        description: `${email.trim()} was invited to ${activeOrganization?.name} as ${role}. No email was sent.`,
        variant: "success",
      });
      onInvited?.();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create invitation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => (saving ? undefined : onClose())}
      title="Invite a member"
      description={`Add someone to ${activeOrganization?.name ?? "this organization"} with a specific role.`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" form="invite-member-form" icon={UserPlus} loading={saving}>
            Send invitation
          </Button>
        </>
      }
    >
      <form id="invite-member-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <TextInput
          label="Email address"
          type="email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setFieldError(null);
            setError(null);
          }}
          error={fieldError ?? undefined}
          leftIcon={Mail}
          required
          autoFocus
          disabled={saving}
          hint={
            existingName
              ? undefined
              : "The invitation is linked to this exact email. If they don't have an account yet, they can register with this address."
          }
        />

        {checking ? (
          <p className="flex items-center gap-1.5 text-[10.5px] text-u-muted">
            <span className="size-3 animate-spin rounded-full border-[1.5px] border-u-line border-t-slate-500" />
            Checking the mock user directory…
          </p>
        ) : existingName ? (
          <div className="flex items-center gap-2 rounded-lg border border-u-accent/30 bg-u-accent-soft/70 px-3 py-2">
            <UserCheck className="size-3.5 text-u-accent" />
            <p className="text-[10.5px] text-u-accent">
              <span className="font-semibold">{existingName}</span> already has a mock account. The invitation will be
              associated with their existing user.
            </p>
          </div>
        ) : null}

        <SelectInput
          label="Assigned role"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          options={ASSIGNABLE_ROLES.map((option) => ({ value: option, label: option }))}
          disabled={saving}
          required
        />

        <div className="rounded-lg border border-u-line bg-u-s2/70 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-u-ink2">
            <ShieldCheck className="size-3.5 text-u-muted" />
            {role} permissions
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-u-muted">{roleDescriptions[role]}</p>
        </div>

        <p className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-u-muted">
          <Link2 className="mt-0.5 size-3 shrink-0" />
          Invitations expire after 7 days. Owner access cannot be granted by invitation — use ownership transfer in the
          members table. This prototype sends no email or notification.
        </p>
      </form>
    </Modal>
  );
}
