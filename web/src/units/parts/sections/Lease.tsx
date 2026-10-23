import { useMemo, useState } from "react";
import type { Database, Lease } from "../../data/types";
import type { UnitRow } from "../../data/selectors";
import { leasePartiesFor, tenantName, unitsOnLease } from "../../data/selectors";
import { addMonths, daysLabel, daysUntil, formatDate, isoDate, money, pct } from "../../lib/format";
import { TODAY } from "../../data/mockData";
import { useStore } from "../../store/appStore";
import { Icon } from "../../components/ui/Icon";
import { Button, Field, Pill, Select, TextInput } from "../../components/ui/primitives";
import { Callout, ConfirmDialog, Modal } from "../../components/ui/Modal";
import { ActionLink, Def, DefGrid, EmptyInline, MiniStat, SectionCard } from "./common";
import { LeaseStatusPill, leaseTone } from "../status";

/* ------------------------------------------------------------------ *
 * Lease detail (Section C)
 * ------------------------------------------------------------------ */

export function LeaseSection({
  row,
  db,
  onComposeLease,
}: {
  row: UnitRow;
  db: Database;
  onComposeLease: () => void;
}) {
  const { updateLease, pushToast, log } = useStore();
  const [editOpen, setEditOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const entry = row.ctx.current ?? row.ctx.holdover ?? row.ctx.pending;
  const lease = entry?.lease ?? null;
  const link = entry?.link ?? null;
  const shared = lease ? unitsOnLease(db, lease.id) : [];
  const parties = lease ? leasePartiesFor(db, lease.id) : [];
  const leaseDocs = db.documents.filter((doc) => doc.leaseId === lease?.id);
  const isShared = shared.length > 1;

  if (!lease) {
    return (
      <SectionCard icon="key" step="C" title="Lease Details" meta="No applicable lease">
        <EmptyInline
          icon="key"
          title="No current lease"
          body="Nothing is in term, pending or on holdover for this unit. Historical leases remain available below."
          actions={
            <>
              <Button size="xs" variant="primary" icon="plus" onClick={onComposeLease}>
                Create a lease
              </Button>
              {row.ctx.history.length > 0 && (
                <Button size="xs" icon="clock" onClick={() => setShowHistory((s) => !s)}>
                  {showHistory ? "Hide" : "View"} previous leases ({row.ctx.history.length})
                </Button>
              )}
            </>
          }
        />
        {showHistory && <LeaseHistory row={row} db={db} />}
      </SectionCard>
    );
  }

  const days = daysUntil(lease.endDate);
  const expiring = row.ctx.derivedStatus === "Expiring";

  return (
    <SectionCard
      icon="key"
      step="C"
      title="Lease Details"
      meta={
        <>
          <span className="u-num">{lease.leaseNumber}</span> · {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
        </>
      }
      actions={
        <>
          <ActionLink href={`/leases/${lease.id}`} icon="eye">
            View lease
          </ActionLink>
          <Button size="xs" icon="edit" onClick={() => setEditOpen(true)}>
            Edit lease
          </Button>
          <Button size="xs" variant="ghost" icon="file" onClick={() => setDocsOpen(true)}>
            Documents
            {lease.documentReferences.length > 0 && (
              <span className="u-num ml-1 rounded bg-u-s3 px-1 text-[10px]">{lease.documentReferences.length}</span>
            )}
          </Button>
          <Button size="xs" variant="ghost" icon="refresh" onClick={() => setRenewOpen(true)}>
            Renew
          </Button>
        </>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
        <div className="min-w-0">
          <DefGrid cols={3}>
            <Def label="Lease number" mono>
              {lease.leaseNumber}
            </Def>
            <Def label="Lease status">
              <LeaseStatusPill status={row.ctx.derivedStatus} />
              {row.ctx.holdover && (
                <span className="ml-1.5 text-[10.5px] text-u-warn">holdover</span>
              )}
            </Def>
            <Def label="Days until expiry" mono>
              <span className={expiring ? "text-u-warn" : days < 0 ? "text-u-danger" : undefined}>
                {days < 0 ? `${daysLabel(days)} ago` : daysLabel(days)}
              </span>
            </Def>
            <Def label="Lease start" mono>
              {formatDate(lease.startDate)}
            </Def>
            <Def label="Lease end" mono>
              {formatDate(lease.endDate)}
            </Def>
            <Def label="Rent due day" mono>
              Day {lease.rentDueDay} of each month
            </Def>
            <Def label="Monthly rent — this unit" mono>
              {row.ctx.currentRent !== null ? (
                <span className="text-[14px] font-600 text-u-ink">{money(row.ctx.currentRent)}</span>
              ) : (
                <span className="text-u-danger">Allocation missing</span>
              )}
            </Def>
            <Def label="Lease total (all units)" mono>
              {money(lease.totalContractRent)}
            </Def>
            <Def label="Security deposit" mono>
              {lease.securityDeposit ? money(lease.securityDeposit) : "None held"}
            </Def>
            <Def label="Tenants on lease" mono>
              {parties.filter((p) => !p.effectiveEndDate).length} of {parties.length} recorded
            </Def>
            <Def label="Units covered" mono>
              {shared.length}
            </Def>
            <Def label="Allocation of lease total" mono>
              {row.ctx.currentRent !== null ? pct(row.ctx.currentRent, lease.totalContractRent) : "—"}
            </Def>
            <Def label="Renewal terms" span>
              {lease.renewalTerms}
            </Def>
            {lease.terms && (
              <Def label="Terms" span>
                {lease.terms}
              </Def>
            )}
            {lease.terminatedOn && (
              <Def label="Termination" span>
                {formatDate(lease.terminatedOn)} — {lease.terminationReason}
              </Def>
            )}
          </DefGrid>
        </div>

        <div className="grid content-start gap-2">
          <MiniStat
            label="Rent to expiry"
            icon="dollar"
            value={money((row.ctx.currentRent ?? 0) * Math.max(0, Math.round(days / 30)))}
            hint={`${Math.max(0, Math.round(days / 30))} remaining monthly cycles`}
          />
          <MiniStat
            label="Occupancy start"
            icon="calendar"
            value={formatDate(link?.occupancyStartDate ?? lease.startDate)}
            hint={link?.occupancyEndDate ? `Ended ${formatDate(link.occupancyEndDate)}` : "Ongoing"}
          />
          <MiniStat
            label="Deposit held"
            icon="shield"
            tone={lease.securityDeposit ? "jade" : "muted"}
            value={lease.securityDeposit ? money(lease.securityDeposit) : "—"}
            hint={lease.securityDeposit ? "Held in trust" : "No deposit on this lease"}
          />
        </div>
      </div>

      {isShared && (
        <Callout className="mt-3" tone="cyan" icon="layers" title={`Shared lease — ${shared.length} units on ${lease.leaseNumber}`}>
          <div className="mt-1 space-y-1">
            {shared.map((s) => {
              const u = db.units.find((x) => x.id === s.unitId);
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 text-[11.5px]">
                  <span className="truncate">
                    <a
                      href={`#/units/${s.unitId}`}
                      className={s.unitId === row.unit.id ? "text-u-blue" : "text-u-ink2 hover:text-u-blue"}
                    >
                      {u?.unitNumber ?? s.unitId}
                      {s.unitId === row.unit.id ? " (this unit)" : ""}
                    </a>
                    {u ? ` · ${u.unitType}` : ""}
                  </span>
                  <span className="u-num shrink-0">
                    {s.rentAllocation !== null ? money(s.rentAllocation) : "no allocation"}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-3 border-t border-u-blue/25 pt-1 text-[11.5px]">
              <span>Lease total (counted once across the lease)</span>
              <span className="u-num font-600">{money(lease.totalContractRent)}</span>
            </div>
          </div>
        </Callout>
      )}

      {row.ctx.rentBasis === "unallocated" && (
        <Callout className="mt-3" tone="rose" icon="alert" title="Rent allocation missing">
          This lease covers {shared.length} units but no split is recorded, so no unit-level rent is reported. The
          lease-level total of {money(lease.totalContractRent)} is shown separately — record an allocation to bring this
          unit into the rent roll.
        </Callout>
      )}

      {row.ctx.holdover && (
        <Callout className="mt-3" tone="amber" icon="alert" title="Holdover — expired lease, unit still occupied">
          {lease.leaseNumber} ended {daysLabel(days)} ago but {row.unit.unitNumber} remains occupied. Occupancy status
          and lease status are reported separately; this unit is excluded from the contractual rent roll until a new
          lease is issued.
          <div className="mt-1.5">
            <Button size="xs" variant="primary" icon="refresh" onClick={() => setRenewOpen(true)}>
              Issue renewal lease
            </Button>
          </div>
        </Callout>
      )}

      {expiring && !row.ctx.holdover && (
        <Callout className="mt-3" tone="amber" icon="clock" title={`Expiring in ${daysLabel(days)}`}>
          Inside the {60}-day warning window. {lease.renewalTerms}
        </Callout>
      )}

      {row.ctx.history.length > 0 && (
        <div className="mt-3">
          <Button size="xs" variant="ghost" icon="clock" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? "Hide" : "View"} previous leases ({row.ctx.history.length})
          </Button>
          {showHistory && <LeaseHistory row={row} db={db} />}
        </div>
      )}

      {/* ---- edit lease ---- */}
      <LeaseEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        db={db}
        lease={lease}
        allocation={link?.rentAllocation ?? null}
        linkId={link?.id ?? null}
        shared={isShared}
        onSave={(patch) => {
          updateLease(lease.id, patch);
          pushToast({
            tone: "jade",
            title: "Lease updated",
            message: `${lease.leaseNumber} saved. Unit records and tenant associations were not modified.`,
          });
          log(row.unit.id, "lease", `Lease ${lease.leaseNumber} updated`);
        }}
      />

      {/* ---- documents ---- */}
      <Modal
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        title="Lease documents"
        subtitle={`${lease.leaseNumber} — references held on the lease record`}
        icon="file"
        footer={<Button onClick={() => setDocsOpen(false)}>Close</Button>}
      >
        {lease.documentReferences.length === 0 && leaseDocs.length === 0 ? (
          <EmptyInline icon="file" title="No documents attached" body="Upload a signed lease or addendum from the lease record." />
        ) : (
          <ul className="space-y-1.5">
            {lease.documentReferences.map((ref) => {
              const doc = leaseDocs.find((d) => d.name === ref);
              return (
                <li
                  key={ref}
                  className="flex items-center gap-2.5 rounded-md border border-u-line2 bg-u-bg/55 px-3 py-2 transition-colors hover:border-u-line2"
                >
                  <Icon name="file" size={15} className="text-u-accent" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-u-ink">{ref}</span>
                  <span className="u-num text-[11px] text-u-muted">{doc ? `${doc.sizeKb} KB` : "referenced"}</span>
                  <Button
                    size="xs"
                    variant="ghost"
                    icon="download"
                    onClick={() =>
                      pushToast({ tone: "azure", title: "Download queued", message: `${ref} — document storage is not connected in this prototype.` })
                    }
                  >
                    Get
                  </Button>
                </li>
              );
            })}
            {leaseDocs
              .filter((d) => !lease.documentReferences.includes(d.name))
              .map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-2.5 rounded-md border border-u-line2 bg-u-bg/55 px-3 py-2"
                >
                  <Icon name="file" size={15} className="text-u-muted" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-u-ink2">{doc.name}</span>
                  <span className="u-num text-[11px] text-u-muted">{doc.kind}</span>
                </li>
              ))}
          </ul>
        )}
      </Modal>

      {/* ---- renew ---- */}
      <ConfirmDialog
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
        tone="azure"
        icon="refresh"
        title={`Renew ${lease.leaseNumber}?`}
        confirmLabel="Renew for 12 months"
        body={
          <>
            <p>
              Extends the lease by 12 months from {formatDate(lease.endDate)} and sets the status back to Active.
              {row.ctx.holdover ? " This resolves the holdover flag on the unit." : ""}
            </p>
            <p className="text-[12px] text-u-muted">
              Contractual rent stays at {money(lease.totalContractRent)} — change it on the lease record if the renewal
              is at a new rate.
            </p>
          </>
        }
        onConfirm={() => {
          updateLease(lease.id, {
            endDate: addMonths(new Date(`${lease.endDate}T00:00:00`), 12),
            leaseStatus: "Active",
          });
          pushToast({ tone: "jade", title: "Lease renewed", message: `${lease.leaseNumber} extended by 12 months.` });
          log(row.unit.id, "lease", `${lease.leaseNumber} renewed for 12 months`);
        }}
      />
    </SectionCard>
  );
}

function LeaseHistory({ row, db }: { row: UnitRow; db: Database }) {
  return (
    <div className="animate-u-expand mt-2 overflow-hidden rounded-md border border-u-line2">
      <table className="w-full text-left text-[12px]">
        <thead className="bg-u-s2/70 text-[10px] uppercase tracking-[0.09em] text-u-muted">
          <tr>
            <th className="px-2.5 py-1.5 font-semibold">Lease</th>
            <th className="px-2.5 py-1.5 font-semibold">Status</th>
            <th className="px-2.5 py-1.5 font-semibold">Term</th>
            <th className="px-2.5 py-1.5 font-semibold">Rent (unit)</th>
            <th className="hidden px-2.5 py-1.5 font-semibold sm:table-cell">Tenants</th>
            <th className="px-2.5 py-1.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-u-line2/70 bg-u-bg/40">
          {row.ctx.history.map(({ lease: l, link: lu, status }) => {
            const parties = leasePartiesFor(db, l.id);
            return (
              <tr key={lu.id} className="transition-colors hover:bg-u-card">
                <td className="u-num px-2.5 py-1.5 text-u-ink2">{l.leaseNumber}</td>
                <td className="px-2.5 py-1.5">
                  <Pill tone={leaseTone[status]}>{status}</Pill>
                </td>
                <td className="u-num px-2.5 py-1.5 text-u-muted">
                  {formatDate(l.startDate)} → {formatDate(l.endDate)}
                </td>
                <td className="u-num px-2.5 py-1.5 text-u-ink2">
                  {lu.rentAllocation !== null ? money(lu.rentAllocation) : "—"}
                </td>
                <td className="hidden px-2.5 py-1.5 text-u-muted sm:table-cell">
                  {parties.map((p) => db.tenants.find((t) => t.id === p.tenantId)).filter(Boolean).map((t) => tenantName(t!)).join(", ") || "—"}
                </td>
                <td className="px-2.5 py-1.5 text-right">
                  <ActionLink href={`/leases/${l.id}`} icon="eye">
                    View
                  </ActionLink>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-u-line2 bg-u-card/60 px-2.5 py-1.5 text-[10.5px] text-u-muted">
        Historical leases are retained in full — they are never mistaken for the current lease and are excluded from the
        rent roll.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Lease editor
 * ------------------------------------------------------------------ */

function LeaseEditModal({
  open,
  onClose,
  db,
  lease,
  allocation,
  shared,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  db: Database;
  lease: Lease;
  allocation: number | null;
  linkId?: string | null;
  shared: boolean;
  onSave: (patch: Partial<Lease>) => void;
}) {
  const { updateLeaseUnit } = useStore();
  const [form, setForm] = useState({
    status: lease.leaseStatus,
    startDate: lease.startDate,
    endDate: lease.endDate,
    totalContractRent: String(lease.totalContractRent),
    allocation: allocation === null ? "" : String(allocation),
    dueDay: String(lease.rentDueDay),
    deposit: String(lease.securityDeposit),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const linkId = useMemo(
    () => db.leaseUnits.find((lu) => lu.leaseId === lease.id)?.id ?? null,
    [db.leaseUnits, lease.id],
  );

  function save() {
    const e: Record<string, string> = {};
    const total = Number(form.totalContractRent);
    const alloc = form.allocation === "" ? null : Number(form.allocation);
    if (!form.startDate) e.startDate = "Start date is required.";
    if (!form.endDate) e.endDate = "End date is required.";
    if (form.startDate && form.endDate && form.endDate <= form.startDate) e.endDate = "End date must be after the start date.";
    if (Number.isNaN(total) || total <= 0) e.totalContractRent = "Enter a positive monthly rent.";
    if (alloc !== null && (Number.isNaN(alloc) || alloc < 0)) e.allocation = "Enter a valid allocation.";
    if (alloc !== null && alloc > total) e.allocation = "Allocation cannot exceed the lease total.";
    setErrors(e);
    if (Object.keys(e).length) return;

    onSave({
      leaseStatus: form.status,
      startDate: form.startDate,
      endDate: form.endDate,
      totalContractRent: total,
      rentDueDay: Number(form.dueDay) || 1,
      securityDeposit: Number(form.deposit) || 0,
    });
    if (linkId && alloc !== undefined) updateLeaseUnit(linkId, { rentAllocation: alloc });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${lease.leaseNumber}`}
      subtitle="Lease-level financials only. Editing here never changes unit attributes or tenant associations."
      icon="edit"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="check" onClick={save}>
            Save lease
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Lease status">
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Lease["leaseStatus"] })}
          >
            {["Draft", "Pending", "Active", "Expired", "Terminated"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rent due day" hint="Day of month">
          <TextInput
            type="number"
            min={1}
            max={28}
            value={form.dueDay}
            onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
          />
        </Field>
        <Field label="Start date" required error={errors.startDate}>
          <TextInput
            type="date"
            value={form.startDate}
            invalid={!!errors.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </Field>
        <Field label="End date" required error={errors.endDate}>
          <TextInput type="date" value={form.endDate} invalid={!!errors.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </Field>
        <Field
          label="Contractual rent — whole lease"
          required
          error={errors.totalContractRent}
          hint={shared ? `${unitsOnLease(db, lease.id).length} units share this lease` : "single unit"}
        >
          <TextInput
            type="number"
            min={0}
            step="0.01"
            value={form.totalContractRent}
            invalid={!!errors.totalContractRent}
            onChange={(e) => setForm({ ...form, totalContractRent: e.target.value })}
          />
        </Field>
        <Field
          label="Allocation to this unit"
          error={errors.allocation}
          hint="Used for unit-level reporting"
        >
          <TextInput
            type="number"
            min={0}
            step="0.01"
            placeholder="Leave blank if not recorded"
            value={form.allocation}
            invalid={!!errors.allocation}
            onChange={(e) => setForm({ ...form, allocation: e.target.value })}
          />
        </Field>
        <Field label="Security deposit">
          <TextInput type="number" min={0} step="0.01" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Lease composer — used by vacant units and by "Start a lease"
 * ------------------------------------------------------------------ */

export function LeaseComposer({
  open,
  onClose,
  db,
  unitId,
}: {
  open: boolean;
  onClose: () => void;
  db: Database;
  unitId: string | null;
}) {
  const { createLease, updateUnit, pushToast } = useStore();
  const unit = db.units.find((u) => u.id === unitId) ?? null;
  const [form, setForm] = useState({
    tenantId: "",
    role: "Main Tenant" as "Main Tenant" | "Co-Tenant",
    signatory: true,
    startDate: isoDate(TODAY),
    termMonths: "12",
    rent: "",
    dueDay: "1",
    deposit: "",
    status: "Pending" as Lease["leaseStatus"],
    unitStatus: "Reserved" as "Reserved" | "Occupied" | "Vacant",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // reset when a different unit is targeted
  const [lastUnit, setLastUnit] = useState<string | null>(null);
  if (unitId !== lastUnit) {
    setLastUnit(unitId);
    setForm((f) => ({
      ...f,
      rent: unit?.advertisedRent ? String(unit.advertisedRent) : "",
      deposit: unit?.advertisedRent ? String(unit.advertisedRent) : "",
      startDate: unit?.availabilityDate ?? isoDate(TODAY),
      tenantId: "",
    }));
    setErrors({});
  }

  function submit() {
    const e: Record<string, string> = {};
    if (!form.startDate) e.startDate = "Start date is required.";
    const months = Number(form.termMonths);
    if (Number.isNaN(months) || months < 1) e.termMonths = "Term must be at least 1 month.";
    const rent = Number(form.rent);
    if (!form.rent || Number.isNaN(rent) || rent <= 0) e.rent = "Contractual monthly rent is required.";
    setErrors(e);
    if (Object.keys(e).length || !unit) return;

    const end = addMonths(new Date(`${form.startDate}T00:00:00`), months);
    const lease = createLease({
      unitIds: [unit.id],
      allocations: { [unit.id]: rent },
      startDate: form.startDate,
      endDate: end,
      leaseStatus: form.status,
      totalContractRent: rent,
      rentDueDay: Number(form.dueDay) || 1,
      securityDeposit: Number(form.deposit) || 0,
      parties: form.tenantId
        ? [{ tenantId: form.tenantId, role: form.role, isSignatory: form.signatory }]
        : [],
    });
    // with Supabase this saves the unit's new status; tell the user if the database refused it
    void Promise.resolve(updateUnit(unit.id, { unitStatus: form.unitStatus })).catch((error) =>
      pushToast({ tone: "rose", title: "Unit status not saved", message: error instanceof Error ? error.message : "Please try again." }),
    );
    pushToast({
      tone: "jade",
      title: "Lease created",
      message: `${lease.leaseNumber} · ${money(rent)}/mo · ${unit.unitStatus} → ${form.unitStatus}`,
    });
    onClose();
  }

  return (
    <Modal
      open={open && !!unit}
      onClose={onClose}
      title={unit ? `New lease — unit ${unit.unitNumber}` : "New lease"}
      subtitle={
        unit
          ? `Creates a lease record, links it to ${unit.id} with an explicit rent allocation and associates the tenant as a lease party.`
          : undefined
      }
      icon="key"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="check" onClick={submit}>
            Create lease
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tenant" hint="Optional — a lease may exist before parties are added">
          <Select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>
            <option value="">No tenant yet</option>
            {db.tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {tenantName(t)} — {t.id}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lease status">
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Lease["leaseStatus"] })}
          >
            {["Draft", "Pending", "Active"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start date" required error={errors.startDate}>
          <TextInput type="date" value={form.startDate} invalid={!!errors.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </Field>
        <Field label="Term (months)" required error={errors.termMonths}>
          <TextInput type="number" min={1} value={form.termMonths} invalid={!!errors.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })} />
        </Field>
        <Field label="Contractual monthly rent" required error={errors.rent} hint="CAD">
          <TextInput type="number" min={0} step="0.01" value={form.rent} invalid={!!errors.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} />
        </Field>
        <Field label="Security deposit">
          <TextInput type="number" min={0} step="0.01" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
        </Field>
        <Field label="Rent due day">
          <Select value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })}>
            {[1, 5, 15].map((n) => (
              <option key={n} value={n}>
                Day {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Set unit occupancy status" hint="Keeps status and lease consistent">
          <Select
            value={form.unitStatus}
            onChange={(e) => setForm({ ...form, unitStatus: e.target.value as "Reserved" | "Occupied" | "Vacant" })}
          >
            {["Reserved", "Occupied", "Vacant"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Callout className="mt-3" tone="azure" icon="info">
        Rent allocation is written to the lease-unit link ({money(Number(form.rent) || 0)}), so this unit's share is
        reported correctly even if the lease later covers more units.
      </Callout>
    </Modal>
  );
}
