import { isSupabaseConfigured } from "../lib/supabase";
// Full property profile (a drawer with tabs), the property counterpart of the tenant profile. Uses the Tenants module's styles.
import { ArrowUpRight, Building2, Home, Mail, MapPin, Pencil, Phone, Users, Wallet } from "lucide-react";
import {
  currency,
  propertyAtRisk,
  propertyBalance,
  propertyCollectionRate,
  propertyOccupied,
  propertyRentRoll,
  propertyTenants,
  type Property,
  type Unit,
} from "./data/properties";
import { Button, DataField, EmptyState, Overlay, SectionTitle, TextLink } from "../tenants/components/ui";

export type ProfileTab = "Overview" | "Units" | "Residents" | "Financials" | "Details";
export const PROFILE_TABS: ProfileTab[] = ["Overview", "Units", "Residents", "Financials", "Details"];

const COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const initials = (name: string) =>
  name.replace(/^The\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
const colorFor = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};
const UNIT_LABEL: Record<Unit["status"], string> = { current: "Current", late: "Late", delinquent: "Delinquent", vacant: "Vacant", notice: "Notice" };

function status(p: Property) {
  if (p.units.some((u) => u.status === "delinquent")) return { label: "Delinquent", cls: "status-terminated" };
  if (propertyBalance(p) > 0) return { label: "Arrears", cls: "status-expiring" };
  if (p.units.some((u) => u.status === "vacant" || u.status === "notice")) return { label: "Vacancy", cls: "status-pending" };
  return { label: "Current", cls: "status-active" };
}

function UnitItems({ units }: { units: Unit[] }) {
  return (
    <div className="unit-lease-group">
      {units.map((u) => (
        <div className="unit-item" key={u.unit}>
          <div className="unit-item-top">
            <span className="unit-name">Unit {u.unit}</span>
            <span className={`occupancy ${u.status === "vacant" ? "historical" : ""}`}>
              <i />
              {UNIT_LABEL[u.status]}
            </span>
          </div>
          <p className="unit-address">
            {u.beds} bd &middot; {u.baths} ba &middot; {u.sqft.toLocaleString()} sf
            {u.leaseEnd !== "—" ? ` · lease ends ${u.leaseEnd}` : ""}
          </p>
          {u.tenants[0] && <p className="unit-address">{u.tenants.map((t) => t.name).join(", ")}</p>}
          <div className="unit-rent">
            <span>
              {currency(u.rent)}
              <span className="muted"> / mo</span>
            </span>
            {u.balance > 0 && <span className="amber-text">{currency(u.balance)} due</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PropertyProfile({
  property: p,
  tab,
  onTab,
  onClose,
  onEdit,
}: {
  property: Property;
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
  onClose: () => void;
  onEdit: () => void;
}) {
  const s = status(p);
  const balance = propertyBalance(p);
  const occupied = propertyOccupied(p);
  const risk = propertyAtRisk(p);
  const residents = p.units.flatMap((u) => u.tenants.map((t) => ({ ...t, unit: u.unit })));
  const owing = p.units.filter((u) => u.balance > 0).sort((a, b) => b.balance - a.balance);
  const hasHistory = p.units.some((u) => u.history.length);
  const phone = p.managerPhone !== "—" ? p.managerPhone : "";
  const email = p.managerEmail !== "—" ? p.managerEmail : "";

  return (
    <Overlay drawer title="Property profile" subtitle="Everything about this property, in one place." onClose={onClose} className="profile-drawer">
      <div className="profile-heading">
        <span className={`avatar avatar-xl avatar-${colorFor(p.name)}`} aria-hidden="true">
          {initials(p.name)}
        </span>
        <div className="profile-identity">
          <h2>{p.name}</h2>
          <div>
            <span>{p.code}</span>
            <span className={`status-badge ${s.cls}`}>
              <span className="status-dot" />
              {s.label}
            </span>
          </div>
        </div>
        <Button className="profile-edit-button" onClick={onEdit}>
          <Pencil size={14} />
          Edit property
        </Button>
      </div>
      <nav className="profile-tabs" aria-label="Property profile sections">
        {PROFILE_TABS.map((t) => (
          <button key={t} className={t === tab ? "selected" : ""} aria-current={t === tab ? "page" : undefined} onClick={() => onTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      <div className="profile-body" key={tab}>
        {tab === "Overview" && (
          <>
            <div className="profile-contact">
              {email && (
                <a href={`mailto:${email}`}>
                  <Mail size={15} />
                  {email}
                </a>
              )}
              {phone && (
                <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>
                  <Phone size={15} />
                  {phone}
                </a>
              )}
              <span>
                <MapPin size={15} />
                {p.address1}, {p.city}, {p.state} {p.zip}
              </span>
            </div>
            <div className="profile-at-a-glance">
              <button onClick={() => onTab("Units")}>
                <span>Units</span>
                <strong>
                  {p.units.length}
                  <ArrowUpRight size={15} />
                </strong>
              </button>
              <button onClick={() => onTab("Units")}>
                <span>Occupancy</span>
                <strong>
                  {occupied}/{p.units.length}
                  <ArrowUpRight size={15} />
                </strong>
              </button>
              <button onClick={() => onTab("Financials")}>
                <span>Outstanding balance</span>
                <strong className={balance ? "amber-text" : ""}>
                  {currency(balance)}
                  <ArrowUpRight size={15} />
                </strong>
              </button>
            </div>
            <section className="profile-section">
              <SectionTitle
                icon={<Wallet size={16} />}
                title="Units with a balance"
                action={
                  <TextLink onClick={() => onTab("Financials")}>
                    View financials
                    <ArrowUpRight size={13} />
                  </TextLink>
                }
              />
              {owing.length ? (
                <UnitItems units={owing.slice(0, 4)} />
              ) : (
                <EmptyState compact title="Nothing owed" description="Every unit in this property is paid up." />
              )}
            </section>
            <section className="profile-section">
              <SectionTitle icon={<Building2 size={15} />} title="Property information" />
              <dl className="personal-info-grid">
                <DataField label="Type">{p.type}</DataField>
                <DataField label="Manager">{p.manager}</DataField>
                <DataField label="Acquired">{p.acquired}</DataField>
                <DataField label="Year built">{p.yearBuilt}</DataField>
              </dl>
            </section>
          </>
        )}

        {tab === "Units" && (
          <section className="detail-section">
            <SectionTitle icon={<Home size={15} />} title={`Units (${p.units.length})`} />
            <UnitItems units={p.units} />
          </section>
        )}

        {tab === "Residents" && (
          <section className="detail-section people-section">
            <SectionTitle icon={<Users size={15} />} title={`Residents (${propertyTenants(p)})`} />
            {residents.length ? (
              <div className="people-list">
                {residents.map((r) => (
                  <div className="person-item" key={`${r.unit}-${r.name}`}>
                    <span className={`avatar avatar-md avatar-${colorFor(r.name)}`} aria-hidden="true">
                      {initials(r.name)}
                    </span>
                    <div className="person-content">
                      <div className="person-name-line">
                        <span className="person-name">{r.name}</span>
                      </div>
                      <div className="person-relationship">
                        <div className="person-role">
                          {r.role}
                          <span className="dot-separator">&middot;</span>Unit {r.unit}
                        </div>
                      </div>
                      <div className="person-contact">
                        <span>Since {r.since}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No residents yet" description="Residents appear here once units are leased." />
            )}
          </section>
        )}

        {tab === "Financials" && (
          <section className="detail-section financial-section">
            <SectionTitle icon={<Wallet size={15} />} title="Financial summary" />
            <div className="financial-balance">
              <span>Outstanding balance</span>
              <strong className={balance > 0 ? (risk > 0 ? "red-text" : "amber-text") : ""}>
                {currency(balance)}
                <small>USD</small>
              </strong>
            </div>
            <dl className="financial-facts">
              <DataField label="Monthly rent roll">{currency(propertyRentRoll(p))}</DataField>
              <DataField label="Occupancy">
                {occupied} of {p.units.length} units
              </DataField>
              <DataField label="On-time payments">{hasHistory ? `${Math.round(propertyCollectionRate(p) * 100)}%` : "No history yet"}</DataField>
              <DataField label="Units at risk">
                <span className={risk > 0 ? "amber-text" : ""}>{risk}</span>
              </DataField>
            </dl>
            {balance === 0 && <span className="settled-note">No outstanding balance</span>}
            <div className="ledger-table-wrap" style={{ marginTop: 18 }}>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Status</th>
                    <th>Rent</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {p.units.map((u) => (
                    <tr key={u.unit}>
                      <td>Unit {u.unit}</td>
                      <td>{UNIT_LABEL[u.status]}</td>
                      <td>{currency(u.rent)}</td>
                      <td className={u.balance > 0 ? "amber-text" : ""}>{currency(u.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "Details" && (
          <>
            <SectionTitle
              title="Property details"
              action={
                <TextLink onClick={onEdit}>
                  <Pencil size={13} />
                  Edit details
                </TextLink>
              }
            />
            <dl className="personal-info-grid">
              <DataField label="Property name">{p.name}</DataField>
              <DataField label="Property code">{p.code}</DataField>
              <DataField label="Type">{p.type}</DataField>
              <DataField label="Street address">{p.address1}</DataField>
              <DataField label="City">{p.city}</DataField>
              <DataField label="State / ZIP">
                {p.state} {p.zip}
              </DataField>
              <DataField label="Manager">{p.manager}</DataField>
              <DataField label="Manager phone">{phone || "Not provided"}</DataField>
              <DataField label="Manager email">{email || "Not provided"}</DataField>
              <DataField label="Acquired">{p.acquired}</DataField>
              <DataField label="Year built">{p.yearBuilt}</DataField>
              <DataField label="Units">{p.units.length}</DataField>
            </dl>
          </>
        )}
        <div className="profile-footer-note">Property records are private to your workspace. All amounts in USD.{isSupabaseConfigured ? "" : " Demo data."}</div>
      </div>
    </Overlay>
  );
}
