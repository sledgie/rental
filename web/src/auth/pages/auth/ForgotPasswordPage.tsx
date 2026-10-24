import { useState } from "react";
import { Link } from "../../shim/router";
import { ArrowLeft, ArrowRight, Mail, MailCheck, ShieldCheck } from "lucide-react";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Alert, Button, TextInput } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { isValidEmail } from "../../lib/format";
import { usingSupabase } from "../../services";

export default function ForgotPasswordPage() {
  useDocumentTitle("Reset your password");
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSentTo(email.trim());
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <AuthLayout>
        <div className="animate-fade-up">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-u-accent-soft ring-1 ring-u-accent/30">
            <MailCheck className="size-6 text-u-accent" />
          </span>
          <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.03em] text-u-ink">Check your inbox</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-u-muted">
            If an account exists for <span className="font-medium text-u-ink2">{sentTo}</span>, password
            {usingSupabase ? "a password reset link has been sent. It can take a minute to arrive." : "reset instructions have been simulated."}
          </p>
          {!usingSupabase ? (
          <Alert tone="info" className="mt-5" title="Development simulation">
            No email was actually sent. This prototype does not have real email delivery or a reset token
            endpoint. Use the demo credentials on the sign-in page.
          </Alert>
          ) : null}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link to="/login" className="flex-1">
              <Button variant="secondary" fullWidth icon={ArrowLeft}>
                Back to sign in
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setSentTo(null);
                setEmail(sentTo);
              }}
            >
              Try another email
            </Button>
          </div>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-[10.5px] text-u-muted">
            <ShieldCheck className="size-3.5" />
            We never reveal whether an account exists.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="animate-fade-up">
        <Link
          to="/login"
          className="focus-ring mb-6 inline-flex items-center gap-1.5 rounded text-[12px] font-medium text-u-muted transition hover:text-u-ink"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-u-accent uppercase">Password help</p>
        <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-u-ink">Reset your password</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-u-muted">
          Enter the email address linked to your account. We'll simulate sending reset instructions.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <TextInput
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            leftIcon={Mail}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(undefined);
              setFormError(undefined);
            }}
            error={error}
            disabled={loading}
            autoFocus
          />
          <Button type="submit" size="lg" fullWidth loading={loading} iconRight={ArrowRight}>
            Send reset instructions
          </Button>
        </form>

        {!usingSupabase ? (
        <div className="mt-6 rounded-lg border border-u-line bg-u-s2/70 p-3.5">
          <p className="text-[11.5px] font-medium text-u-ink2">Testing the prototype?</p>
          <p className="mt-1 text-[11px] leading-relaxed text-u-muted">
            All demo accounts use <span className="font-mono font-medium text-u-ink2">Demo123!</span>.
            Password resets do not change credentials — mock data only.
          </p>
        </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}
