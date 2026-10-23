import { ArrowUpRight, Bell, CircleUserRound, LayoutDashboard, Moon, Palette, ShieldCheck, Sun, Table2, UserRound } from "lucide-react";
import { useAuth } from "../../auth/contexts/AuthContext";
import { initials } from "../../auth/lib/format";
import { useSettings } from "../store";
import type { PageProps } from "../types";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Field, Select, SettingRow, Toggle } from "../components/ui";

const themeOptions = [
  { value: "dark", label: "Dark", description: "Low-light workspace", icon: Moon, swatch: { bg: "#0b1220", panel: "#1a2438", line: "#26324a", accent: "#4f8cff" } },
  { value: "light", label: "Light", description: "Bright, neutral workspace", icon: Sun, swatch: { bg: "#f4f6fa", panel: "#ffffff", line: "#dfe4ee", accent: "#4f46e5" } },
  { value: "blue", label: "Light with blue", description: "Bright workspace, blue accent", icon: Palette, swatch: { bg: "#eef4ff", panel: "#ffffff", line: "#cfdcf5", accent: "#1d6fe8" } },
];

export default function PersonalPage({ value, update, notify, navigate }: PageProps) {
  const { user } = useAuth();
  const { activeOrg, role } = useSettings();
  const prefs = value;

  return (
    <div className="space-y-5">
      <Callout tone="success" icon={UserRound} title="These preferences belong to you">
        Personal preferences belong to your account, not the organization. They follow you when you switch organizations and do not change workspace-wide defaults.
      </Callout>

      <Card id="personal-theme">
        <CardHeader icon={Palette} title="Appearance" description="Choose how the app looks for your account. The theme applies after saving." aside={<Badge tone="violet">Personal</Badge>} />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {themeOptions.map((option) => {
              const active = prefs.theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update("theme", option.value)}
                  className={`overflow-hidden rounded-xl border text-left transition ${active ? "border-u-accent/60 ring-2 ring-u-accent/20" : "border-u-line hover:border-u-line2  "}`}
                >
                  <div className="relative flex h-20 items-end gap-1 overflow-hidden p-2.5" style={{ background: option.swatch.bg }}>
                    <span className="h-10 w-7 rounded" style={{ background: option.swatch.panel, border: `1px solid ${option.swatch.line}` }} />
                    <span className="flex h-10 flex-1 flex-col gap-1">
                      <span className="h-2.5 w-3/4 rounded" style={{ background: option.swatch.line }} />
                      <span className="h-2.5 w-1/2 rounded" style={{ background: option.swatch.panel }} />
                      <span className="mt-auto h-4 w-10 rounded" style={{ background: option.swatch.accent }} />
                    </span>
                    <span className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full border ${active ? "border-u-accent/60 bg-u-accent" : "border-u-line2 bg-u-card/80"}`}>
                      {active ? <span className="h-1.5 w-1.5 rounded-full bg-u-card" /> : null}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-u-card px-3 py-2.5 ">
                    <option.icon className="h-3.5 w-3.5 text-u-muted " />
                    <div>
                      <p className="text-[12px] font-medium text-u-ink ">{option.label}</p>
                      <p className="text-[10.5px] text-u-muted">{option.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <SettingRow title="Reduce motion" description="Minimize non-essential interface animation." className="pt-0">
            <Toggle label="Reduce motion" checked={!!prefs.reduceMotion} onChange={(checked) => update("reduceMotion", checked)} />
          </SettingRow>
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card id="personal-experience">
          <CardHeader icon={LayoutDashboard} title="Experience" description="Personal defaults for landing, density and language." />
          <CardBody className="space-y-4">
            <Field label="Default landing page" hint="Where you land after signing in. Organization default views remain unchanged.">
              <Select value={prefs.landingPage} onChange={(event) => update("landingPage", event.target.value)}>
                {["Dashboard overview", "Settings", "Properties", "Maintenance", "Reports"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Table density">
              <div className="inline-flex rounded-lg bg-u-s3 p-0.5 ">
                {["Compact", "Comfortable", "Spacious"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => update("tableDensity", option)}
                    className={`h-7.5 rounded-md px-2.5 text-[11.5px] font-medium transition ${prefs.tableDensity === option ? "bg-u-card text-u-ink shadow-sm  " : "text-u-muted "}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </Field>
            <Field
              label="Language"
              badge={<Badge tone="amber">Prototype only</Badge>}
              hint="Translation support is not available in this prototype. Selecting another language does not translate the interface."
            >
              <Select value={prefs.language} onChange={(event) => update("language", event.target.value)}>
                {["English (United States)", "English (United Kingdom)", "Spanish (Español)", "French (Français)"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <div className="rounded-lg border border-u-line bg-u-s2/40 p-3  ">
              <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-u-muted"><Table2 className="h-3 w-3" /> Table density preview</p>
              <div className={`overflow-hidden rounded-md border border-u-line bg-u-card   ${prefs.tableDensity === "Compact" ? "text-[10.5px]" : prefs.tableDensity === "Spacious" ? "text-[12px]" : "text-[11px]"}`}>
                {["Maple Court · Unit 4B", "Cedar Heights · Unit 12"].map((row) => (
                  <div key={row} className={`border-b border-u-line px-2.5 last:border-0  ${prefs.tableDensity === "Compact" ? "py-1" : prefs.tableDensity === "Spacious" ? "py-2.5" : "py-1.5"}`}>{row}</div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card id="personal-notifications">
          <CardHeader icon={Bell} title="Personal notification preferences" description="Channels you receive for your own account. Organization delivery rules stay separate." />
          <CardBody className="divide-y divide-u-line py-0 ">
            <SettingRow title="Email notifications" description="Account activity and assigned tasks.">
              <Toggle label="Email notifications" checked={!!prefs.notifications?.email} onChange={(checked) => update("notifications", { ...prefs.notifications, email: checked })} />
            </SettingRow>
            <SettingRow title="Desktop notifications" description="In-browser alerts while you are signed in.">
              <Toggle label="Desktop notifications" checked={!!prefs.notifications?.desktop} onChange={(checked) => update("notifications", { ...prefs.notifications, desktop: checked })} />
            </SettingRow>
            <SettingRow title="Weekly digest" description="A Monday summary of rent and maintenance activity.">
              <Toggle label="Weekly digest" checked={!!prefs.notifications?.weeklyDigest} onChange={(checked) => update("notifications", { ...prefs.notifications, weeklyDigest: checked })} />
            </SettingRow>
            <SettingRow title="Product updates" description="Occasional updates about new features.">
              <Toggle label="Product updates" checked={!!prefs.notifications?.productUpdates} onChange={(checked) => update("notifications", { ...prefs.notifications, productUpdates: checked })} />
            </SettingRow>
          </CardBody>
        </Card>
      </div>

      <Card id="personal-widgets">
        <CardHeader icon={LayoutDashboard} title="Dashboard widgets" description="Choose the summary cards shown on your own dashboard." />
        <CardBody className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {[
            ["occupancy", "Occupancy rate", "Current occupancy across your portfolio."],
            ["rentCollection", "Rent collection", "Collected and outstanding rent this month."],
            ["maintenance", "Open work orders", "Requests that still need attention."],
            ["renewals", "Upcoming renewals", "Leases ending in the next 90 days."],
          ].map(([key, label, description]) => (
            <SettingRow key={key} title={label} description={description}>
              <Toggle
                size="sm"
                label={label}
                checked={!!prefs.widgets?.[key]}
                onChange={(checked) => update("widgets", { ...prefs.widgets, [key]: checked })}
              />
            </SettingRow>
          ))}
        </CardBody>
      </Card>

      <Card id="personal-account">
        <CardHeader icon={CircleUserRound} title="Profile & account shortcuts" description="Personal account details are managed outside the Settings Center." />
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-u-accent text-[13px] font-semibold text-u-onaccent">{initials(user?.fullName ?? "?")}</span>
            <div>
              <p className="text-[13px] font-semibold text-u-ink ">{user?.fullName}</p>
              <p className="text-[11.5px] text-u-muted ">{user?.email}</p>
              <p className="mt-0.5 text-[10.5px] text-u-muted">{role} · {activeOrg.name}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" icon={CircleUserRound} onClick={() => notify("Profile editing lives in the Account module", "info", "This settings prototype does not duplicate profile management.")}>
              Edit profile
            </Button>
            <Button type="button" size="sm" variant="secondary" icon={ShieldCheck} onClick={() => navigate("security")}>
              Account security
            </Button>
            <span className="inline-flex items-center gap-1 text-[10.5px] text-u-muted"><ArrowUpRight className="h-3 w-3" /> Reused modules</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
