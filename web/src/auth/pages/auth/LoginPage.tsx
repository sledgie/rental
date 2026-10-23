import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "../../shim/router";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Alert, Button, CheckInput, Spinner, TextInput } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { isValidEmail } from "../../lib/format";
import { organizationService, usingSupabase } from "../../services";
import { cn } from "../../utils/cn";

const demoAccounts = [
  {
    name: "Alex Carter",
    email: "alex@example.com",
    hint: "alex@example.com · Owner, 2 workspaces",
    tone: "from-u-accent to-u-accent",
  },
  {
    name: "Maya Patel",
    email: "maya@example.com",
    hint: "maya@example.com · Workspace picker",
    tone: "from-u-violet to-u-accent",
  },
  {
    name: "Riley Chen",
    email: "riley@example.com",
    hint: "riley@example.com · No workspace, 2 invites",
    tone: "from-u-blue to-u-accent",
  },
];

export default function LoginPage() {
  useDocumentTitle("Sign in");
  const navigate = useNavigate();
  const { signIn, authenticating } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [demoOpen, setDemoOpen] = useState(true);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [pendingDemo, setPendingDemo] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  async function completeSignIn(nextEmail: string, nextPassword: string, rememberMe = remember) {
    const nextErrors: typeof errors = {};
    if (!nextEmail.trim()) nextErrors.email = "Enter your email address.";
    else if (!isValidEmail(nextEmail)) nextErrors.email = "That doesn't look like a valid email address.";
    if (!nextPassword) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const user = await signIn(nextEmail, nextPassword, rememberMe);
      const destination = await organizationService.resolveEntryRoute(user.id);
      if (!mountedRef.current) return;
      setSignedInAs(user.fullName.split(" ")[0]);
      timeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        navigate(destination, { replace: true });
      }, 700);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in. Try again.";
      const nextFormErrors: typeof errors = { form: message };
      if (message.toLowerCase().includes("email")) nextFormErrors.email = message;
      else if (message.toLowerCase().includes("password")) nextFormErrors.password = message;
      setErrors(nextFormErrors);
      setPendingDemo(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await completeSignIn(email, password);
  }

  async function handleDemo(account: (typeof demoAccounts)[number]) {
    setPendingDemo(account.email);
    setDemoOpen(true);
    setEmail(account.email);
    setPassword("Demo123!");
    await completeSignIn(account.email, "Demo123!", true);
  }

  if (signedInAs) {
    return (
      <AuthLayout>
        <div className="animate-fade-up flex flex-col items-start">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-u-ok-soft ring-1 ring-u-ok/30">
            <CheckCircle2 className="size-6 text-u-ok" />
          </span>
          <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.03em] text-u-ink">
            Welcome back, {signedInAs}.
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-u-muted">
            Your session is ready. Taking you to the correct workspace…
          </p>
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-u-line bg-u-s2/70 px-3.5 py-3">
            <Spinner label="Resolving organization access" />
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="animate-fade-up">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-u-accent uppercase">Welcome back</p>
            <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-u-ink">Sign in to L.O.F.T.</h1>
            <p className="mt-1.5 text-[13px] text-u-muted">
              Enter your workspace credentials to continue.
            </p>
          </div>
          <span className="mt-1 hidden shrink-0 items-center gap-1 rounded-full border border-u-line bg-u-s2 px-2 py-1 text-[9.5px] font-medium text-u-muted sm:inline-flex">
            <span className="size-1.5 rounded-full bg-u-accent" />
            Demo build
          </span>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {errors.form ? (
            <Alert tone="danger" className="animate-fade-in">
              {errors.form}
            </Alert>
          ) : null}

          <TextInput
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            leftIcon={Mail}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined, form: undefined }));
            }}
            error={errors.email}
            disabled={authenticating}
            autoFocus
          />

          <TextInput
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            leftIcon={Lock}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined, form: undefined }));
            }}
            error={errors.password}
            disabled={authenticating}
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="focus-ring rounded-md p-2 text-u-muted transition hover:bg-u-s3 hover:text-u-ink2"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <CheckInput
              label="Remember me"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              disabled={authenticating}
            />
            <Link
              to="/forgot-password"
              className="focus-ring rounded text-[12px] font-medium text-u-accent transition hover:text-u-accent hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={authenticating}
            disabled={authenticating}
            iconRight={ArrowRight}
            className="mt-1"
          >
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-[12.5px] text-u-muted">
          New to L.O.F.T.?{" "}
          <Link to="/signup" className="font-semibold text-u-accent transition hover:text-u-accent hover:underline">
            Create an account
          </Link>
        </p>

        {!usingSupabase ? (
          <>
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-u-line" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-u-card px-3 text-[10px] font-medium tracking-[0.1em] text-u-muted uppercase">
              Prototype access
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-u-line bg-u-s2/60 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-u-card ring-1 ring-u-line">
                <Sparkles className="size-3.5 text-u-accent" />
              </span>
              <div>
                <p className="text-[11.5px] font-semibold text-u-ink">Development demo accounts</p>
                <p className="text-[10.5px] text-u-muted">
                  Password <span className="font-mono font-medium text-u-ink2">Demo123!</span> · mock only
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDemoOpen((value) => !value)}
              className="focus-ring rounded-md p-1 text-u-muted hover:bg-u-card hover:text-u-ink2"
              aria-expanded={demoOpen}
              aria-label={demoOpen ? "Hide demo accounts" : "Show demo accounts"}
            >
              <ChevronDown className={cn("size-4 transition-transform", demoOpen && "rotate-180")} />
            </button>
          </div>

          {demoOpen ? (
            <div className="animate-fade-in mt-3 space-y-1.5">
              {demoAccounts.map((account) => {
                const busy = authenticating && pendingDemo === account.email;
                return (
                  <button
                    key={account.email}
                    type="button"
                    disabled={authenticating}
                    onClick={() => handleDemo(account)}
                    className="focus-ring group flex w-full items-center gap-2.5 rounded-lg border border-u-line bg-u-card px-2.5 py-2 text-left transition hover:border-u-accent/30 hover:shadow-[0_2px_8px_-2px_rgba(37,99,235,0.18)] disabled:opacity-60"
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[9.5px] font-semibold text-u-onaccent",
                        account.tone
                      )}
                    >
                      {account.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] font-medium text-u-ink">{account.name}</span>
                      <span className="block truncate text-[10px] text-u-muted">{account.hint}</span>
                    </span>
                    {busy ? (
                      <Spinner className="shrink-0" />
                    ) : (
                      <ArrowRight className="size-3.5 shrink-0 text-u-s3 transition group-hover:text-u-accent" />
                    )}
                  </button>
                );
              })}
              <p className="flex items-center gap-1.5 pt-1 text-[10px] text-u-muted">
                <KeyRound className="size-3" />
                No real authentication. Credentials are stored locally for the demo.
              </p>
            </div>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleDemo(account)}
                  disabled={authenticating}
                  className="focus-ring inline-flex items-center gap-1 rounded-md border border-u-line bg-u-card px-2 py-1 text-[10.5px] font-medium text-u-ink2 transition hover:border-u-accent/30 hover:text-u-accent disabled:opacity-60"
                >
                  <span className={cn("size-1.5 rounded-full bg-gradient-to-br", account.tone)} />
                  {account.name.split(" ")[0]}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-u-muted">One-click test access</span>
            </div>
          )}
        </div>

          </>
        ) : null}

        <div className="mt-5 flex items-start gap-2 rounded-lg border border-u-line border-dashed px-3 py-2.5">
          <Building2 className="mt-0.5 size-3.5 shrink-0 text-u-muted" />
          <p className="text-[10.5px] leading-relaxed text-u-muted">
            New accounts start without an organization. After signing up, create a workspace or accept
            an invitation — membership is separate from your account.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
