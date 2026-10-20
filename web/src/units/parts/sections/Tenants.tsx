import { useMemo, useState } from "react";
import type { Database, PartyRole } from "../../data/types";
import type { UnitRow } from "../../data/selectors";
import { tenantName } from "../../data/selectors";
import { formatDate, isoDate } from "../../lib/format";
import { TODAY } from "../../data/mockData";
import { useStore } from "../../store/appStore";
import { Icon } from "../../components/ui/Icon";
import { Avatar, Button, Field, Pill, Select, Switch, TextInput } from "../../components/ui/primitives";
import { Modal } from "../../components/ui/Modal";
import { ActionLink, EmptyInline, SectionCard } from "./common";
import { roleTone } from "../status";

const ROLES: PartyRole[] = ["Main Tenant", "Co-Tenant", "Occupant", "Guarantor"];

export function TenantsSection({
  row,
  db,
  onStartLease,
}: {
  row: UnitRow;
  db: Database;
  onStartLease: () => void;
}) {
  const { linkParty, unlinkParty, updateParty, addTenant, pushToast } = useStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const entry = row.ctx.current ?? row.ctx.holdover ?? row.ctx.pending;
  const leaseId = entry?.lease.id ?? null;

  const existingIds = useMemo(() => row.occupants.map((o) => o.tenant.id), [row.occupants]);
  const candidates = db.tenants.filter((t) => !existingIds.includes(t.id));

  /* ---- add existing tenant ---- */
  const [pickId, setPickId] = useState("");
  const [pickRole, setPickRole] = useState<PartyRole>("Co-Tenant");
  const [pickSignatory, setPickSignatory] = useState(true);
  const [pickError, setPickError] = useState<string | null>(null);

  /* ---- create tenant ---- */
  const [draft, setDraft] = useState({ firstName: "", lastName: "", email: "", phone: "", occupation: "" });
  const [draftRole, setDraftRole] = useState<PartyRole>("Main Tenant");
  const [draftSignatory, setDraftSignatory] = useState(true);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});

  function commitAddExisting() {
    if (!leaseId) return;
    if (!pickId) {
      setPickError("Select a tenant to associate.");
      return;
    }
    linkParty({
      leaseId,
      tenantId: pickId,
      role: pickRole,
      isSignatory: pickSignatory,
      startDate: entry?.link.occupancyStartDate ?? isoDate(TODAY),
      unitId: row.unit.id,
    });
    const t = db.tenants.find((x) => x.id === pickId);
    pushToast({
      tone: "jade",
      title: "Tenant associated",
      message: `${t ? tenantName(t) : pickId} added as ${pickRole} on ${entry?.lease.leaseNumber}. No tenant record was duplicated.`,
    });
    setPickerOpen(false);
    setPickId("");
    setPickError(null);
  }

  function commitCreate() {
    const errors: Record<string, string> = {};
    if (!draft.firstName.trim()) errors.firstName = "First name is required.";
    if (!draft.lastName.trim()) errors.lastName = "Last name is required.";
    if (!draft.email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors.email = "Enter a valid email address.";
    if (draft.phone.trim() && draft.phone.replace(/\D/g, "").length < 10) errors.phone = "Enter a valid phone number.";
    setDraftErrors(errors);
    if (Object.keys(errors).length || !leaseId) return;

    const created = addTenant(draft);
    linkParty({
      leaseId,
      tenantId: created.id,
      role: draftRole,
      isSignatory: draftSignatory,
      startDate: entry?.link.occupancyStartDate ?? isoDate(TODAY),
      unitId: row.unit.id,
    });
    pushToast({
      tone: "jade",
      title: "Tenant created",
      message: `${tenantName(created)} (${created.id}) created and linked to ${entry?.lease.leaseNumber} as ${draftRole}.`,
    });
    setCreateOpen(false);
    setDraft({ firstName: "", lastName: "", email: "", phone: "", occupation: "" });
  }

  return (
    <SectionCard
      icon="users"
      step="B"
      title="Tenants & Occupants"
      meta={
        row.occupants.length
          ? `${row.occupants.length} ${row.occupants.length === 1 ? "person" : "people"} linked through ${entry?.lease.leaseNumber}`
          : "No occupancy relationship on record"
      }
      actions={
        leaseId ? (
          <>
            <Button size="xs" icon="plus" onClick={() => setPickerOpen(true)}>
              Add existing tenant
            </Button>
            <Button size="xs" icon="user" onClick={() => setCreateOpen(true)}>
              Create & associate
            </Button>
            <Button size="xs" variant="ghost" icon="sliders" onClick={() => setManageOpen(true)}>
              Manage lease parties
            </Button>
          </>
        ) : (
          <Button size="xs" variant="primary" icon="key" onClick={onStartLease}>
            Start a lease
          </Button>
        )
      }
    >
      {row.occupants.length === 0 ? (
        <EmptyInline
          icon="users"
          title="No current tenant"
          body={
            entry
              ? "This lease has no parties recorded yet. Associate an existing tenant or create a new one."
              : "The unit has no applicable lease. People are linked to units through lease parties — create or associate a lease first."
          }
          actions={
            <>
              {leaseId ? (
                <>
                  <Button size="xs" icon="plus" onClick={() => setPickerOpen(true)}>
                    Add existing tenant
                  </Button>
                  <Button size="xs" icon="user" onClick={() => setCreateOpen(true)}>
                    Create & associate
                  </Button>
                </>
              ) : (
                <Button size="xs" variant="primary" icon="key" onClick={onStartLease}>
                  Begin a new lease
                </Button>
              )}
            </>
          }
        />
      ) : (
        <ul className="divide-y divide-u-line2/70 overflow-hidden rounded-md border border-u-line2">
          {row.occupants.map((o) => (
            <li
              key={o.party.id}
              className="grid gap-2 bg-u-bg/45 px-3 py-2.5 transition-colors hover:bg-u-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <Avatar first={o.tenant.firstName} last={o.tenant.lastName} hue={o.tenant.avatarHue} size={34} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={`#/tenants/${o.tenant.id}`}
                      className="truncate text-[13px] font-600 text-u-ink underline-offset-2 hover:text-u-accent hover:underline"
                    >
                      {tenantName(o.tenant)}
                    </a>
                    <Pill tone={roleTone[o.party.role]}>{o.party.role}</Pill>
                    {o.party.isSignatory ? (
                      <Pill tone="jade" icon="check">
                        Signatory
                      </Pill>
                    ) : (
                      <Pill tone="muted" title="Not legally responsible for rent">
                        Non-signatory
                      </Pill>
                    )}
                    <span className="u-num text-[10.5px] text-u-muted">{o.tenant.id}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-u-muted">
                    {o.tenant.phone ? (
                      <a href={`tel:${o.tenant.phone}`} className="inline-flex items-center gap-1 hover:text-u-ink2">
                        <Icon name="phone" size={11} />
                        <span className="u-num">{o.tenant.phone}</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-u-muted">
                        <Icon name="phone" size={11} /> No phone
                      </span>
                    )}
                    {o.tenant.email ? (
                      <a href={`mailto:${o.tenant.email}`} className="inline-flex items-center gap-1 hover:text-u-ink2">
                        <Icon name="mail" size={11} />
                        <span className="truncate">{o.tenant.email}</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-u-muted">
                        <Icon name="mail" size={11} /> No email
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Icon name="key" size={11} />
                      {o.leaseNumber}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="calendar" size={11} />
                      In since {formatDate(o.occupancyStart)}
                    </span>
                  </div>
                  {o.otherUnits.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10.5px] uppercase tracking-[0.08em] text-u-muted">Also occupies</span>
                      {o.otherUnits.map((ou) => (
                        <a key={ou.unitId} href={`#/units/${ou.unitId}`}>
                          <Pill tone="cyan" icon="layers" className="transition-transform hover:-translate-y-px">
                            {ou.unitNumber} · {ou.propertyName} ({ou.role})
                          </Pill>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 sm:flex-col sm:items-end sm:gap-1">
                <ActionLink href={`/tenants/${o.tenant.id}`} icon="eye">
                  View tenant
                </ActionLink>
                <ActionLink href={`/leases/${o.lease.id}`} icon="file">
                  View lease
                </ActionLink>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-u-muted">
        <Icon name="info" size={11} className="mt-px shrink-0" />
        Associations are derived from lease parties, never stored on the unit. Occupants and non-signatories live at the
        unit but carry no rent liability; the same person can appear on several units without duplicating their record.
      </p>

      {/* ---- add existing tenant ---- */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add existing tenant"
        subtitle={
          leaseId
            ? `Links an existing tenant record to ${entry?.lease.leaseNumber}. No duplicate tenant is created.`
            : "No applicable lease on this unit."
        }
        icon="users"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" onClick={commitAddExisting}>
              Associate tenant
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Tenant" required error={pickError}>
            <Select value={pickId} onChange={(e) => setPickId(e.target.value)} invalid={!!pickError}>
              <option value="">Select a tenant…</option>
              {candidates.map((t) => (
                <option key={t.id} value={t.id}>
                  {tenantName(t)} — {t.id}
                  {t.email ? ` · ${t.email}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Role on this lease" hint="Occupants are not financially responsible">
            <Select value={pickRole} onChange={(e) => setPickRole(e.target.value as PartyRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Switch
            checked={pickSignatory}
            onChange={setPickSignatory}
            label="Lease signatory (legally responsible for rent)"
          />
          {pickId && (
            <div className="rounded-md border border-u-line2 bg-u-bg/60 p-2.5 text-[12px] text-u-muted">
              {(() => {
                const t = db.tenants.find((x) => x.id === pickId)!;
                const otherLinks = db.leaseUnits.filter((lu) =>
                  db.leaseParties.some((lp) => lp.leaseId === lu.leaseId && lp.tenantId === t.id),
                );
                return (
                  <>
                    <span className="text-u-ink">{tenantName(t)}</span> · {t.email || "no email"} ·{" "}
                    {t.phone || "no phone"}
                    <br />
                    Tenant since {formatDate(t.tenantSince)} · {otherLinks.length} unit association
                    {otherLinks.length === 1 ? "" : "s"} on file
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </Modal>

      {/* ---- create tenant ---- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create tenant & associate"
        subtitle="Creates one tenant record and links it to the applicable lease on this unit."
        icon="user"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" onClick={commitCreate}>
              Create & associate
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required error={draftErrors.firstName}>
            <TextInput
              value={draft.firstName}
              invalid={!!draftErrors.firstName}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
            />
          </Field>
          <Field label="Last name" required error={draftErrors.lastName}>
            <TextInput
              value={draft.lastName}
              invalid={!!draftErrors.lastName}
              onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
            />
          </Field>
          <Field label="Email" required error={draftErrors.email}>
            <TextInput
              type="email"
              value={draft.email}
              invalid={!!draftErrors.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>
          <Field label="Phone" error={draftErrors.phone}>
            <TextInput
              value={draft.phone}
              invalid={!!draftErrors.phone}
              placeholder="+1 (416) 555-0100"
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </Field>
          <Field label="Occupation" className="sm:col-span-2">
            <TextInput value={draft.occupation} onChange={(e) => setDraft({ ...draft, occupation: e.target.value })} />
          </Field>
          <Field label="Role on this lease">
            <Select value={draftRole} onChange={(e) => setDraftRole(e.target.value as PartyRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end pb-1">
            <Switch checked={draftSignatory} onChange={setDraftSignatory} label="Lease signatory" />
          </div>
        </div>
      </Modal>

      {/* ---- manage parties ---- */}
      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage lease parties"
        subtitle={entry ? `${entry.lease.leaseNumber} — roles and signatories` : "No applicable lease"}
        icon="sliders"
        width="md"
        footer={<Button onClick={() => setManageOpen(false)}>Done</Button>}
      >
        <ul className="space-y-2">
          {row.occupants.map((o) => (
            <li
              key={o.party.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-u-line2 bg-u-bg/55 px-3 py-2"
            >
              <Avatar first={o.tenant.firstName} last={o.tenant.lastName} hue={o.tenant.avatarHue} size={28} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-u-ink">{tenantName(o.tenant)}</span>
              <Select
                aria-label={`Role for ${tenantName(o.tenant)}`}
                value={o.party.role}
                className="h-7 w-36 text-[12px]"
                onChange={(e) => {
                  updateParty(o.party.id, { role: e.target.value as PartyRole });
                  pushToast({
                    tone: "azure",
                    title: "Role updated",
                    message: `${tenantName(o.tenant)} is now ${e.target.value} on ${o.leaseNumber}.`,
                  });
                }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
              <Button
                size="xs"
                variant="ghost"
                icon="x"
                onClick={() => {
                  unlinkParty(o.party.id, row.unit.id);
                  pushToast({
                    tone: "amber",
                    title: "Association ended",
                    message: `${tenantName(o.tenant)} is no longer linked to ${o.leaseNumber}. The tenant record is kept.`,
                  });
                }}
              >
                End
              </Button>
            </li>
          ))}
        </ul>
      </Modal>
    </SectionCard>
  );
}
