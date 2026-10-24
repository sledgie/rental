import { ArrowRight } from "lucide-react";
import { Container } from "@lf/components/ui/Container";
import { Reveal } from "@lf/components/ui/Reveal";
import { buttonArrowClass, buttonStyles } from "@lf/components/ui/button";
import { AuthLink } from "@lf/components/auth/AuthLink";
import { LogoMark } from "@lf/components/brand/Logo";

/** Thin-line streetscape: rooflines and window rows that echo ledger lines. */
function Streetscape() {
  return (
    <svg
      viewBox="0 0 1200 220"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      className="absolute bottom-0 left-1/2 w-[1200px] max-w-none -translate-x-1/2 text-white/[0.07]"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 220V150l70-55 70 55v70" />
      <path d="M140 220V110h150v110" />
      <path d="M290 220V160l85-65 85 65v60" />
      <path d="M460 220V80h120v140" />
      <path d="M580 220V140l60-48 60 48v80" />
      <path d="M700 220V100h170v120" />
      <path d="M870 220V155l75-58 75 58v65" />
      <path d="M1020 220V120h180v100" />
      <path d="M165 135h100M165 160h100M165 185h100" opacity="0.7" />
      <path d="M480 105h80M480 130h80M480 155h80M480 180h80" opacity="0.7" />
      <path d="M725 125h120M725 150h120M725 175h120" opacity="0.7" />
      <path d="M1045 145h130M1045 170h130M1045 195h130" opacity="0.7" />
    </svg>
  );
}

export function FinalCta() {
  return (
    <section
      id="get-started"
      aria-labelledby="cta-title"
      className="on-dark relative isolate overflow-hidden bg-evergreen pb-36 pt-24 sm:pb-40 sm:pt-28 lg:pt-32"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-blueprint-light mask-fade-center" />
        <div className="absolute left-1/2 top-0 h-[520px] w-[960px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(158_214_191/0.18),transparent)]" />
        <Streetscape />
      </div>

      <Container className="text-center">
        <Reveal>
          <LogoMark tone="dark" className="mx-auto size-12" />
          <h2 id="cta-title" className="mx-auto mt-8 max-w-3xl text-title font-semibold text-ivory text-balance">
            Your portfolio. Your books. One source of truth.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lead text-white/70 text-pretty">
            Bring your properties, tenants, maintenance, documents, and financial records together in one workspace.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <AuthLink route="signup" variant="inverse" size="lg">
              Start Your Free Workspace
              <ArrowRight className={buttonArrowClass} aria-hidden="true" />
            </AuthLink>
            <a href="#platform" className={buttonStyles({ variant: "inverseOutline", size: "lg" })}>
              Explore the Platform
            </a>
          </div>
          <p className="mt-4 text-sm text-white/60">Set up your workspace and add your first property.</p>
        </Reveal>
      </Container>
    </section>
  );
}
