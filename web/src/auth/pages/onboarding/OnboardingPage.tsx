import { useNavigate } from "../../shim/router";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Mail,
  MailCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { SetupLayout } from "../../layouts/SetupLayout";
import { Badge, Button, Card, RoleBadge } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate } from "../../lib/format";
import { cn } from "../../utils/cn";

const steps = [
  { label: "Account", done: true },
  { label: "Organization", active: true },
  { label: "Workspace", done: false },
];

export default function OnboardingPage() {
  useDocumentTitle("Set up your workspace");
  const { user, signOut } = useAuth();
  const { pendingInvitations, workspaces, activeOrganization, suspendedWorkspaces } = useOrganization();
  const navigate = useNavigate();
  const firstName = user?.fullName.split(" ")[0] ?? "there";
  const hasMembership = workspaces.length > 0;
  const nextInvitation = pendingInvitations[0];

  return (
    <SetupLayout>
      <div className="animate-fade-up mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <div key={step.label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium",
                    step.done
                      ? "bg-u-ok-soft text-u-ok ring-1 ring-u-ok/30"
                      : step.active
                        ? "bg-u-accent text-u-onaccent shadow-sm"
                        : "bg-u-card text-u-muted ring-1 ring-u-line"
                  )}
                >
                  {step.done ? <Check className="size-3" strokeWidth={3} /> : <span className="text-[9px]">{index + 1}</span>}
                  {step.label}
                </span>
                {index < steps.length - 1 ? <span className="h-px w-4 bg-u-line sm:w-6" /> : null}
              </div>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-u-ok/30 bg-u-ok-soft px-2.5 py-1 text-[10px] font-medium text-u-ok">
            <MailCheck className="size-3" />
            Email verified
          </span>
        </div>

        <div className="mt-7 grid gap-4 rounded-2xl border border-u-line bg-u-card p-5 shadow-[0_1px_2px_rgba(12,42,34,0.04)] sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-u-accent uppercase">One last step</p>
            <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.035em] text-u-ink sm:text-[30px]">
              Where should we set up, {firstName}?
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-u-muted">
              Your account is ready. Rental data always belongs to an organization. Create your own workspace,
              or join one you've been invited to.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-u-line bg-u-s2/80 px-3 py-2.5 sm:flex-col sm:items-start">
            <span className="flex size-8 items-center justify-center rounded-lg bg-u-card ring-1 ring-u-line">
              <MailCheck className="size-4 text-u-accent" />
            </span>
            <div>
              <p className="text-[11px] font-medium text-u-ink2">Account created</p>
              <p className="text-[10px] text-u-muted">No organization attached yet</p>
            </div>
          </div>
        </div>

        {hasMembership ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-u-accent/80 bg-u-accent-soft/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-[12.5px] text-u-accent">
              <CheckCircle2 className="size-4 shrink-0 text-u-accent" />
              You're already active in{" "}
              <span className="font-semibold">{activeOrganization?.name ?? `${workspaces.length} organizations`}</span>.
            </p>
            <Button size="sm" variant="secondary" onClick={() => navigate(activeOrganization ? "/app/dashboard" : "/organizations/select")}>
              Open existing workspace
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="group relative flex flex-col overflow-hidden p-5 transition hover:border-u-accent/30 hover:shadow-[0_12px_36px_-18px_rgba(29,102,80,0.35)]">
            <div className="absolute -top-16 -right-16 size-40 rounded-full bg-u-accent-soft opacity-70 blur-2xl transition group-hover:opacity-100" aria-hidden />
            <div className="relative flex items-start justify-between">
              <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-u-accent to-u-accent shadow-[0_8px_20px_-8px_rgba(29,102,80,0.7)]">
                <Building2 className="size-5 text-u-onaccent" />
              </span>
              <Badge tone="blue">Recommended</Badge>
            </div>
            <h2 className="relative mt-4 text-[16px] font-semibold tracking-[-0.01em] text-u-ink">
              Create a New Organization
            </h2>
            <p className="relative mt-1.5 text-[12.5px] leading-relaxed text-u-muted">
              Set up a workspace for your rental properties and business operations.
            </p>
            <ul className="relative mt-4 space-y-2">
              {["You become the Owner", "Full control over members and settings", "Start with your own portfolio data"].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[11.5px] text-u-ink2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-u-accent" strokeWidth={2.5} />
                  {item}
                </li>
              ))}
            </ul>
            <div className="relative mt-5 flex-1" />
            <Button className="relative mt-2" fullWidth iconRight={ArrowRight} onClick={() => navigate("/onboarding/create-organization")}>
              Create Organization
            </Button>
          </Card>

          <Card className="flex flex-col overflow-hidden p-5 transition hover:border-u-line2">
            <div className="flex items-start justify-between">
              <span className="flex size-11 items-center justify-center rounded-xl border border-u-line bg-u-s2">
                <UserPlus className="size-5 text-u-ink2" />
              </span>
              <Badge tone={pendingInvitations.length ? "amber" : "slate"} dot={pendingInvitations.length > 0}>
                {pendingInvitations.length ? `${pendingInvitations.length} pending` : "No pending invites"}
              </Badge>
            </div>
            <h2 className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-u-ink">
              Join an Existing Organization
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-u-muted">
              Accept an invitation from a landlord or property management company.
            </p>
            <ul className="mt-4 space-y-2">
              {["Invitation-only access", "Your assigned role decides your permissions", "Switch workspaces any time"].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[11.5px] text-u-ink2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-u-muted" strokeWidth={2.5} />
                  {item}
                </li>
              ))}
            </ul>

            {nextInvitation ? (
              <div className="mt-4 rounded-lg border border-u-line bg-u-s2/80 p-2.5">
                <p className="truncate text-[11.5px] font-medium text-u-ink">{nextInvitation.organization?.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={nextInvitation.role} />
                  <span className="flex items-center gap-1 text-[10px] text-u-muted">
                    <Clock3 className="size-3" />
                    Expires {formatDate(nextInvitation.expiresAt, { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="flex-1" />
            <Button
              className="mt-4"
              variant="secondary"
              fullWidth
              iconRight={ArrowRight}
              onClick={() => navigate("/onboarding/invitations")}
            >
              View Invitations
            </Button>
          </Card>
        </div>

        {!hasMembership && pendingInvitations.length === 0 ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-u-line border-dashed bg-u-card/70 px-4 py-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-u-muted" />
            <p className="text-[11.5px] leading-relaxed text-u-muted">
              Organizations cannot be joined by name. An Owner or Administrator must invite your exact email
              address first. Invitations appear here automatically.
            </p>
          </div>
        ) : null}

        {suspendedWorkspaces.length > 0 ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-u-warn/30 bg-u-warn-soft/70 px-4 py-3">
            <Users className="mt-0.5 size-4 shrink-0 text-u-warn" />
            <p className="text-[11.5px] leading-relaxed text-u-warn">
              {suspendedWorkspaces.length} membership{suspendedWorkspaces.length > 1 ? "s are" : " is"} currently
              suspended: {suspendedWorkspaces.map((workspace) => workspace.organization.name).join(", ")}. Contact an
              organization Owner to restore access.
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10.5px] text-u-muted">
          <span className="flex items-center gap-1"><Sparkles className="size-3" /> Account ≠ organization</span>
          <span className="text-u-s3">·</span>
          <span>Signed in as {user?.email}</span>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
            className="font-medium text-u-muted hover:text-u-ink"
          >
            Use a different account
          </button>
        </div>
      </div>
    </SetupLayout>
  );
}
