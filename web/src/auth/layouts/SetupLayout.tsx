import type { ReactNode } from "react";
import { Link, useNavigate } from "../shim/router";
import { LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "../components/Logo";
import { Avatar } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useOrganization } from "../contexts/OrganizationContext";
import { useToast } from "../contexts/ToastContext";

export function SetupLayout({ children, maxWidth = "max-w-5xl" }: { children: ReactNode; maxWidth?: string }) {
  const { user, signOut } = useAuth();
  const { pendingInvitations } = useOrganization();
  const { toast } = useToast();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    toast({ title: "Signed out", description: "Your mock session has been cleared.", variant: "info" });
    navigate("/login", { replace: true });
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-u-bg">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(37,99,235,0.07),transparent)]"
        aria-hidden
      />
      <header className="relative z-10 border-b border-u-line/80 bg-u-card/80 backdrop-blur">
        <div className={`mx-auto flex h-16 w-full ${maxWidth} items-center justify-between gap-4 px-5 sm:px-6`}>
          <Link to="/onboarding" className="focus-ring rounded-lg" aria-label="Rentflow onboarding">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-u-line bg-u-s2 px-2.5 py-1 text-[10px] font-medium text-u-muted sm:inline-flex">
              <ShieldCheck className="size-3 text-u-muted" />
              Mock workspace setup
            </span>
            {pendingInvitations.length > 0 ? (
              <Link
                to="/onboarding/invitations"
                className="focus-ring rounded-full border border-u-accent/30 bg-u-accent-soft px-2.5 py-1 text-[10.5px] font-medium text-u-accent transition hover:bg-u-accent-soft"
              >
                {pendingInvitations.length} invitation{pendingInvitations.length > 1 ? "s" : ""}
              </Link>
            ) : null}
            <div className="flex items-center gap-2 border-l border-u-line pl-3">
              <Avatar name={user?.fullName ?? "Guest"} size="sm" />
              <div className="hidden leading-tight sm:block">
                <p className="text-[11.5px] font-medium text-u-ink">{user?.fullName}</p>
                <p className="text-[10px] text-u-muted">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="focus-ring ml-1 rounded-md p-1.5 text-u-muted transition hover:bg-u-s3 hover:text-u-ink2"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className={`relative z-10 mx-auto w-full ${maxWidth} flex-1 px-5 py-8 sm:px-6 sm:py-10`}>{children}</main>

      <footer className="relative z-10 border-t border-u-line/70 bg-u-card/40">
        <div className={`mx-auto flex ${maxWidth} flex-wrap items-center justify-between gap-2 px-5 py-4 text-[10.5px] text-u-muted sm:px-6`}>
          <span>© 2026 Rentflow · Organization setup</span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-u-warn" />
            Mock data persists only in this browser
          </span>
        </div>
      </footer>
    </div>
  );
}
