// About L.O.F.T.: what the app is, the workspace you are signed in to, and the modules it offers. The module list is read from the sidebar
// configuration, so it stays in step with the menu; modules without a page yet are marked "Coming soon".
import { isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../auth/contexts/AuthContext";
import { useOrganization } from "../auth/contexts/OrganizationContext";
import { BRAND, NAV } from "../shell/navConfig.js";
import pkg from "../../package.json";
import "./about.css";

const NOT_CONNECTED = [
  "Email and WhatsApp delivery: those messages and announcements are recorded but not sent yet. Text messages (SMS) are sent through Twilio.",
  "Electronic signatures: signatures are recorded on leases and applications, not collected online.",
  "Background automation: active workflow rules and inspection reminders do not run on their own yet.",
  "Tenant screening services: screening results are entered by your team, not fetched from a provider.",
];

export default function About({ available = [] }: { available?: string[] }) {
  const { user } = useAuth();
  const { activeOrganization, activeRole } = useOrganization();
  const pages = new Set(available);

  return (
    <div className="tn about">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line">
                  <h1>About {BRAND.name}</h1>
                  <span className="muted">Version {pkg.version}</span>
                </div>
                <p>{BRAND.subtitle}</p>
              </div>
            </div>

            <section className="directory-panel about-panel">
              <h2>What {BRAND.name} is</h2>
              <p>
                {BRAND.name} brings the day-to-day work of running rental properties into one place: your properties and units, tenants and
                leases, rent invoicing and payments, deposits, expenses and bills, maintenance and projects, documents and messages, with the
                accounting kept in a proper general ledger so the financial reports always match what happened.
              </p>
              <p>Every change is recorded in your organization&apos;s activity log, so you can always see who did what, and when.</p>
            </section>

            <section className="directory-panel about-panel">
              <h2>Your workspace</h2>
              <dl className="about-facts">
                <div><dt>Organization</dt><dd>{activeOrganization?.name ?? "No organization selected"}</dd></div>
                <div><dt>Your role</dt><dd>{activeRole ?? "—"}</dd></div>
                <div><dt>Signed in as</dt><dd>{user ? `${user.fullName}${user.email ? ` · ${user.email}` : ""}` : "—"}</dd></div>
                <div><dt>Data</dt><dd>{isSupabaseConfigured ? "Saved to your organization's secure cloud database" : "Demo mode: sample data kept in this browser"}</dd></div>
                <div><dt>Version</dt><dd>{pkg.version}</dd></div>
              </dl>
            </section>

            <section className="directory-panel about-panel">
              <h2>Modules</h2>
              <div className="about-groups">
                {NAV.map((group: { id: string; label: string; items: { id: string; label: string; desc: string }[] }) => (
                  <div key={group.id} className="about-group">
                    <h3>{group.label}</h3>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <a href={`#/${item.id}`}>{item.label}</a>
                          {!pages.has(item.id) && <span className="about-soon">Coming soon</span>}
                          <p>{item.desc}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {isSupabaseConfigured && (
              <section className="directory-panel about-panel">
                <h2>Not connected yet</h2>
                <ul className="about-list">
                  {NOT_CONNECTED.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </section>
            )}

            <section className="directory-panel about-panel">
              <h2>Help</h2>
              <p>
                For questions about your account, your access or your organization&apos;s settings, contact your organization&apos;s owner or
                administrator. They can manage members and roles under Settings → Organization.
              </p>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
