import { useState } from "react";
import { Link, useNavigate } from "../../shim/router";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Alert, Button, CheckInput, Modal, TextInput } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { isValidEmail, passwordChecks, passwordIsStrong } from "../../lib/format";
import { PASSWORD_REQUIREMENTS } from "../../lib/constants";
import { cn } from "../../utils/cn";

type Errors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
  form?: string;
};

export default function SignUpPage() {
  useDocumentTitle("Create your account");
  const navigate = useNavigate();
  const { signUp, authenticating } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [legalOpen, setLegalOpen] = useState<"terms" | "privacy" | null>(null);

  const checks = passwordChecks(password);

  function clearError(key: keyof Errors) {
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = "Enter your full name.";
    else if (fullName.trim().length < 2) next.fullName = "Your name must be at least 2 characters.";
    if (!email.trim()) next.email = "Enter your email address.";
    else if (!isValidEmail(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Create a password.";
    else if (!passwordIsStrong(password)) next.password = "Your password does not meet all requirements.";
    if (!confirmPassword) next.confirmPassword = "Confirm your password.";
    else if (password !== confirmPassword) next.confirmPassword = "Passwords do not match.";
    if (!terms) next.terms = "You must accept the Terms and Privacy Policy.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      await signUp({ fullName: fullName.trim(), email, password });
      toast({
        variant: "success",
        title: "Account created",
        description: "Email verification simulated. Next: set up or join an organization.",
      });
      navigate("/onboarding", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create your account.";
      if (message.toLowerCase().includes("already exists")) {
        setErrors({ email: message });
      } else {
        setErrors({ form: message });
      }
    }
  }

  return (
    <AuthLayout>
      <div className="animate-fade-up py-2">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-u-accent uppercase">Get started</p>
        <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-u-ink">
          Create your account
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-u-muted">
          Your account is separate from any rental organization. You'll choose a workspace next.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-3.5">
          {errors.form ? (
            <Alert tone="danger" className="animate-fade-in">
              {errors.form}
            </Alert>
          ) : null}

          <TextInput
            label="Full name"
            placeholder="Alex Carter"
            autoComplete="name"
            leftIcon={User}
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              clearError("fullName");
            }}
            error={errors.fullName}
            disabled={authenticating}
            autoFocus
          />

          <TextInput
            label="Email address"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            leftIcon={Mail}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearError("email");
            }}
            error={errors.email}
            hint="Use an email address that could receive workspace invitations."
            disabled={authenticating}
          />

          <TextInput
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="Create a password"
            autoComplete="new-password"
            leftIcon={Lock}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearError("password");
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

          {password ? (
            <div className="animate-fade-in grid grid-cols-1 gap-x-3 gap-y-1 rounded-lg border border-u-line bg-u-s2/60 px-3 py-2.5 sm:grid-cols-2">
              {PASSWORD_REQUIREMENTS.map((requirement) => {
                const met = checks[requirement.key];
                return (
                  <div key={requirement.key} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "flex size-3.5 items-center justify-center rounded-full transition",
                        met ? "bg-u-ok-soft text-u-ok" : "bg-u-line/80 text-u-muted"
                      )}
                    >
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                    <span className={cn("text-[10.5px]", met ? "text-u-ok" : "text-u-muted")}>
                      {requirement.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          <TextInput
            label="Confirm password"
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            leftIcon={ShieldCheck}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearError("confirmPassword");
            }}
            error={errors.confirmPassword}
            disabled={authenticating}
          />

          <CheckInput
            checked={terms}
            onChange={(event) => {
              setTerms(event.target.checked);
              clearError("terms");
            }}
            error={errors.terms}
            label={
              <>
                I agree to the{" "}
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setLegalOpen("terms");
                  }}
                  className="font-medium text-u-accent underline decoration-u-accent underline-offset-2 hover:text-u-accent"
                >
                  Terms of Service
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setLegalOpen("privacy");
                  }}
                  className="font-medium text-u-accent underline decoration-u-accent underline-offset-2 hover:text-u-accent"
                >
                  Privacy Policy
                </button>
                .
              </>
            }
            disabled={authenticating}
          />

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={authenticating}
            iconRight={ArrowRight}
            className="mt-1"
          >
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-[12.5px] text-u-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-u-accent transition hover:text-u-accent hover:underline">
            Sign in
          </Link>
        </p>

        <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-u-accent/30 bg-u-accent-soft/60 px-3.5 py-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-u-accent" />
          <p className="text-[11px] leading-relaxed text-u-accent/80">
            <span className="font-semibold">Prototype note:</span> email verification is simulated and no
            message is sent. Creating an account never creates an organization automatically.
          </p>
        </div>
      </div>

      <Modal
        open={legalOpen !== null}
        onClose={() => setLegalOpen(null)}
        title={legalOpen === "privacy" ? "Privacy Policy (prototype)" : "Terms of Service (prototype)"}
        description="This is placeholder copy for the interactive prototype."
        footer={
          <Button onClick={() => setLegalOpen(null)} size="sm">
            Understood
          </Button>
        }
      >
        <div className="space-y-3 text-[12.5px] leading-relaxed text-u-ink2">
          {legalOpen === "privacy" ? (
            <>
              <p>
                Rentflow is a frontend demonstration. All users, organizations, invitations, and financial
                figures are mock records stored in your browser's local storage.
              </p>
              <p>
                No data is transmitted to a server, no real emails are sent, and no production
                authentication or authorization is performed. You can clear the demo dataset from the
                account menu inside the application.
              </p>
            </>
          ) : (
            <>
              <p>
                This prototype is provided for evaluation only. Authentication is simulated with local mock
                credentials. It is not suitable for managing real tenant, lease, or financial data.
              </p>
              <p>
                Demo credentials are deliberately visible. Replace the mock service layer with a real API
                and a secure identity provider before any production use.
              </p>
            </>
          )}
        </div>
      </Modal>
    </AuthLayout>
  );
}
