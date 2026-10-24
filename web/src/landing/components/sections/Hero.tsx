import type { ReactNode } from "react";
import { ArrowRight, Check, Scale } from "lucide-react";
import { Container } from "@lf/components/ui/Container";
import { Reveal } from "@lf/components/ui/Reveal";
import { IconTile } from "@lf/components/ui/IconTile";
import { buttonArrowClass, buttonStyles } from "@lf/components/ui/button";
import { AuthLink } from "@lf/components/auth/AuthLink";
import { HeroDashboard } from "@lf/components/mockups/HeroDashboard";

function Emphasis({ children }: { children: ReactNode }) {
  return <span className="text-forest">{children}</span>;
}

const TRUST_POINTS = ["Balanced journal entries", "Organization-level data separation", "Role-based permissions"];

function TrustStatement() {
  return (
    <div className="border-t border-line pt-6">
      <p className="flex items-center gap-3 text-[0.9375rem] font-medium text-evergreen">
        <IconTile icon={Scale} size="sm" />
        Property management and double-entry accounting, working together.
      </p>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        {TRUST_POINTS.map((point) => (
          <li key={point} className="flex items-center gap-1.5">
            <Check className="size-3.5 text-forest" strokeWidth={2.5} aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-blueprint mask-fade-hero" />
        <div className="absolute -right-48 -top-40 h-[640px] w-[860px] rounded-full bg-[radial-gradient(closest-side,rgb(29_102_80/0.11),transparent)]" />
        <div className="absolute -left-48 top-56 h-[420px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgb(200_138_50/0.07),transparent)]" />
      </div>

      <Container className="grid gap-x-12 gap-y-10 pb-20 pt-10 sm:pt-14 lg:grid-cols-12 lg:pb-28 lg:pt-20 xl:gap-x-16">
        {/* Copy + calls to action */}
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:self-end">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-white/70 px-3 py-1 text-eyebrow font-semibold uppercase text-forest shadow-xs">
              <span className="size-1.5 rounded-full bg-forest" aria-hidden="true" />
              Rental management, reimagined
            </p>
          </Reveal>
          <Reveal delay={60}>
            <h1 id="hero-title" className="mt-6 text-display font-semibold text-evergreen text-balance">
              Run every <Emphasis>property</Emphasis>, <Emphasis>tenant</Emphasis> and <Emphasis>dollar</Emphasis> from
              one place.
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 max-w-xl text-lead text-muted text-pretty">
              One workspace for your whole rental business. From applications and leases to maintenance and
              accounting, keep your operations organized and your numbers connected.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <AuthLink route="signup" size="lg">
                Start Your Free Workspace
                <ArrowRight className={buttonArrowClass} aria-hidden="true" />
              </AuthLink>
              <a href="#platform" className={buttonStyles({ variant: "secondary", size: "lg" })}>
                Explore the Platform
              </a>
            </div>
            <p className="mt-3.5 text-sm text-muted">Set up your workspace and add your first property.</p>
          </Reveal>
        </div>

        {/* Product preview — directly after the primary CTA on mobile */}
        <div className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:self-center">
          <Reveal delay={200}>
            <HeroDashboard />
          </Reveal>
        </div>

        {/* Trust statement */}
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:self-start">
          <Reveal delay={320}>
            <TrustStatement />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
