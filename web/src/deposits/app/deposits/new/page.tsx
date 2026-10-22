import Link from "../../../shim/link";
import { PageHeader, Card, Callout, Badge } from "../../../components/ui";
import { NewDepositForm, type LeaseOption } from "../../../components/new-deposit-form";
import { loadDepositModule } from "../../../lib/deposits/service";
import { getCurrentUser } from "../../../lib/session";
import { can } from "../../../lib/deposits/domain";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create deposit" };

export default async function CreateDepositPage() {
  const data = await loadDepositModule();
  const user = await getCurrentUser();
  const allowed = can(user.role, "create_deposit");
  const unitsById = new Map(data.lookups.units.map((u) => [u.id, u]));
  const propertiesById = new Map(data.lookups.properties.map((p) => [p.id, p]));
  const tenantsById = new Map(data.lookups.tenants.map((t) => [t.id, t]));

  const leases: LeaseOption[] = data.lookups.leases
    .filter((lease) => lease.status !== "ended")
    .map((lease) => ({
      id: lease.id,
      reference: lease.reference,
      tenantName: tenantsById.get(lease.tenantId)?.name ?? "Unknown tenant",
      tenantId: lease.tenantId,
      propertyName: propertiesById.get(lease.propertyId)?.name ?? "Unknown property",
      building: propertiesById.get(lease.propertyId)?.building ?? "",
      unitLabel: unitsById.get(lease.unitId)?.label ?? "—",
      leaseType: lease.leaseType,
      jurisdiction: lease.jurisdiction,
      monthlyRentCents: lease.monthlyRentCents,
      startDate: lease.startDate,
      endDate: lease.endDate,
      status: lease.status,
    }));

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader
        breadcrumb={[{ label: "Deposits", href: "/deposits" }, { label: "Register", href: "/deposits/register" }, { label: "Create" }]}
        title="Create deposit record"
        description="Create the expected deposit obligation for an existing lease. Collection, application, interest and refunds are separate, validated workflows."
        actions={<Link href="/deposits/register" className="btn btn-sm">Back to register</Link>}
      />
      {!allowed && (
        <Callout tone="danger" title="Permission required">
          Your role ({user.title}) cannot create deposit records. Switch to an Administrator or Property Manager role to use this workflow.
        </Callout>
      )}
      <div className="grid-3">
        <Callout tone="info" title="Lease-linked">Tenant, property, building and unit are derived from the lease — a deposit can never be attached to an unrelated tenant.</Callout>
        <Callout tone="warning" title="Rule enforcement">The applicable effective-dated rule is evaluated at the expected collection date. Prohibited categories are blocked, not warned.</Callout>
        <Callout tone="neutral" title="No financial movement">Saving creates the record only. No payment, refund or journal entry exists until a collection is recorded and confirmed.</Callout>
      </div>
      <Card title="New deposit" subtitle="Fields marked required are validated again on the server before anything is written.">
        <NewDepositForm
          leases={leases}
          accounts={data.lookups.accounts.map((a) => ({ code: a.code, name: a.name, type: a.type }))}
          staff={data.lookups.staff.map((s) => ({ id: s.id, name: s.name, title: s.title }))}
          rules={data.rules}
          today={data.today}
        />
      </Card>
      <Card title="What happens next?">
        <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>The deposit appears in the register as <Badge tone="warning">Expected</Badge> (or Draft if saved as a draft).</li>
          <li>A collection is recorded from the Payments module or as a new simulated payment. Partial collections keep the remaining expected amount open.</li>
          <li>Collection posts a balanced entry: Debit bank / Credit the mapped deposit liability account.</li>
          <li>Last month&apos;s rent is applied to the final rental period invoice; key deposits are refunded on device return; other permitted deposits follow the configured rules.</li>
          <li>Interest, where applicable, is calculated from effective-dated rates and must be posted explicitly with review.</li>
        </ol>
      </Card>
    </div>
  );
}
