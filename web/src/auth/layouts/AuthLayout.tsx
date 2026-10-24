import type { ReactNode } from "react";
import { Link } from "../shim/router";
import { ArrowUpRight, Building2, Landmark, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react";
import { Logo } from "../components/Logo";
import { Skyline } from "../components/Skyline";
import { usingSupabase } from "../services";

const sparkPoints = [38, 44, 41, 52, 49, 60, 57, 68, 72, 66, 78, 86];

function Sparkline() {
  const width = 260;
  const height = 64;
  const step = width / (sparkPoints.length - 1);
  const points = sparkPoints.map((value, index) => `${index * step},${height - (value / 100) * height}`).join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="auth-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9ed6bf" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#9ed6bf" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="auth-spark-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9ed6bf" />
          <stop offset="100%" stopColor="#e6f4ed" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#auth-spark-fill)" />
      <polyline points={points} fill="none" stroke="url(#auth-spark-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={height - (86 / 100) * height} r="3.5" fill="#e6f4ed" stroke="#123d32" strokeWidth="2" />
    </svg>
  );
}

function PortfolioPreview() {
  return (
    <div className="glass-dark relative rounded-2xl p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-u-accent to-u-accent-strong text-[10px] font-bold text-[#0c2a22]">
            NR
          </span>
          <div>
            <p className="text-[12.5px] font-semibold text-u-onaccent">Northstar Rentals</p>
            <p className="text-[10px] text-u-muted">Portfolio pulse · June 2026</p>
          </div>
        </div>
        <span className="rounded-full border border-u-ok/20 bg-u-ok/10 px-2 py-0.5 text-[9.5px] font-medium text-u-ok">
          Live preview
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-u-card/8 bg-black/15 p-3">
          <p className="text-[9.5px] font-medium tracking-[0.08em] text-u-muted uppercase">Rental income</p>
          <p className="mt-1.5 text-[19px] font-semibold tracking-[-0.03em] text-u-onaccent">$148,500</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-u-ok">
            <TrendingUp className="size-3" /> 8.2% vs May
          </p>
        </div>
        <div className="rounded-xl border border-u-card/8 bg-black/15 p-3">
          <p className="text-[9.5px] font-medium tracking-[0.08em] text-u-muted uppercase">Occupancy</p>
          <div className="mt-1.5 flex items-end justify-between">
            <p className="text-[19px] font-semibold tracking-[-0.03em] text-u-onaccent">94.2%</p>
            <div className="relative size-9">
              <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#9ed6bf" strokeWidth="4" strokeLinecap="round" strokeDasharray="84 100" pathLength={100} />
              </svg>
            </div>
          </div>
          <p className="mt-0.5 text-[10px] text-u-muted">186 of 198 units</p>
        </div>
      </div>

      <div className="mt-2.5 rounded-xl border border-u-card/8 bg-black/15 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[9.5px] font-medium tracking-[0.08em] text-u-muted uppercase">Income trend</p>
          <p className="text-[9.5px] text-u-muted">Last 12 months</p>
        </div>
        <Sparkline />
      </div>

      <div className="mt-2.5 space-y-1">
        {[
          { icon: Building2, name: "The Granite Collection", meta: "15 / 16 units", value: "$34,200" },
          { icon: Building2, name: "Lakeview Commons", meta: "7 / 9 units", value: "$22,600" },
        ].map((row) => (
          <div key={row.name} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
            <span className="flex size-6 items-center justify-center rounded-md border border-u-card/8 bg-u-card/5">
              <row.icon className="size-3 text-u-s3" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10.5px] font-medium text-u-s3">{row.name}</p>
              <p className="text-[9px] text-u-muted">{row.meta}</p>
            </div>
            <p className="text-[10px] font-medium text-u-s3">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-u-bg">
      <aside className="au-panel mesh-panel relative hidden w-[46%] max-w-[680px] shrink-0 flex-col overflow-x-hidden overflow-y-auto lg:flex">
        <div className="dot-grid absolute inset-0 opacity-[0.14]" aria-hidden />
        <Skyline tone="dark" className="pointer-events-none absolute inset-x-0 bottom-0 h-[200px] w-full" />
        <div className="absolute -top-24 -left-24 size-96 rounded-full bg-u-accent/10 blur-3xl" aria-hidden />
        <div className="animate-drift absolute right-[-6rem] bottom-[18%] size-80 rounded-full bg-u-accent/10 blur-3xl" aria-hidden />

        <div className="relative flex h-full flex-col px-10 py-8 xl:px-14 xl:py-10">
          <div className="flex items-center justify-between">
            <Logo theme="dark" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-u-card/10 bg-u-card/5 px-2.5 py-1 text-[10px] font-medium text-u-s3">
              <span className="size-1.5 rounded-full bg-u-ok" />
              {usingSupabase ? "Landlord Operations & Financial Tracking" : "Prototype workspace"}
            </span>
          </div>

          <div className="my-auto max-w-[480px] py-10">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-u-accent/20 bg-u-accent/10 px-2.5 py-1 text-[10.5px] font-medium text-u-onaccent">
              <Sparkles className="size-3" />
              Property management with the accounting built in
            </span>
            <h1 className="mt-5 text-[34px] leading-[1.1] font-semibold tracking-[-0.04em] text-u-onaccent xl:text-[40px]">
              Every property.
              <br />
              <span className="bg-gradient-to-r from-u-accent-strong via-u-accent to-u-accent-strong bg-clip-text text-transparent">
                Every detail.
              </span>{" "}
              One place.
            </h1>
            <p className="mt-4 max-w-[420px] text-[13.5px] leading-relaxed text-u-muted">
              Sign in to manage properties, tenants, rent and maintenance — always scoped to the
              right organization and the right level of access.
            </p>

            <div className="mt-8">
              <PortfolioPreview />
            </div>
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-u-card/8 pt-5">
            <p className="flex items-center gap-1.5 text-[10.5px] text-u-muted">
              <ShieldCheck className="size-3.5 text-u-muted" />
              {usingSupabase ? "Secured by Supabase Auth" : "Development environment · mock data only"}
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-[10.5px] font-medium text-u-s3 transition hover:text-u-onaccent"
            >
              Back to home <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </div>
      </aside>

      <main className="relative isolate flex min-h-screen w-full flex-1 flex-col overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(18,61,50,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(18,61,50,0.045)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_45%,#000_25%,transparent_100%)]" />
          <div className="absolute -top-40 -right-32 h-[460px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(29,102,80,0.12),transparent)]" />
          <div className="absolute -bottom-32 -left-24 h-[360px] w-[460px] rounded-full bg-[radial-gradient(closest-side,rgba(200,138,50,0.09),transparent)]" />
          <Skyline className="absolute inset-x-0 bottom-0 h-[230px] w-full" />
        </div>
        <div className="au-panel mesh-panel flex items-center justify-between px-5 py-3.5 lg:hidden">
          <Logo theme="dark" size="sm" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-u-card/10 bg-u-card/5 px-2.5 py-1 text-[10px] font-medium text-u-s3">
            <span className="size-1.5 rounded-full bg-u-ok" />
            {usingSupabase ? "L.O.F.T." : "Mock data"}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-[440px]">
            <div className="rounded-2xl border border-u-line bg-white/85 p-6 shadow-[0_1px_2px_rgba(18,61,50,0.04),0_24px_48px_-24px_rgba(18,61,50,0.22)] backdrop-blur sm:p-8">{children}</div>
            <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-u-muted">
              {[
                [Landmark, "Balanced double-entry books"],
                [Building2, "Organization-level data separation"],
                [Users, "Role-based permissions"],
              ].map(([Icon, label]) => (
                <li key={label as string} className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-u-accent" strokeWidth={1.9} />
                  {label as string}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-6 pb-6 text-[10.5px] text-u-muted">
          <span>© 2026 L.O.F.T.</span>
          <span className="text-u-s3">·</span>
          <span>{usingSupabase ? "Landlord Operations & Financial Tracking" : "Mock environment — no real data or email delivery"}</span>
        </footer>
      </main>
    </div>
  );
}
