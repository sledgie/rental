import {
  useStore,
  partiesOf,
  personOf,
  tenantOf,
  documentsOf,
} from "../../state/store";
import { currency, formatDate } from "../../lib/format";
import { Badge, MockTag, ScreeningStatusBadge } from "../../components/ui/Badge";
import { Button, IconButton } from "../../components/ui/Button";
import { Avatar, Tooltip } from "../../components/ui/Misc";
import { MiniTable, Td, EmptyHint, Note, SubSection } from "./parts";
import {
  IconPencil,
  IconPlus,
  IconTrash,
  IconUser,
  IconExternal,
  IconLock,
} from "../../components/icons";
import type { DialogRequest } from "./dialogTypes";

export function ApplicantsSection({
  applicationId,
  open,
}: {
  applicationId: string;
  open: (d: DialogRequest) => void;
}) {
  const { state } = useStore();
  const all = partiesOf(state, applicationId);
  const applicants = all.filter((p) => p.role !== "Proposed Occupant");
  const occupants = all.filter((p) => p.role === "Proposed Occupant");

  return (
    <div className="space-y-3 rounded-xl border border-u-line bg-u-card/60 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-u-ink">B. Applicant Information</h3>
          <p className="mt-0.5 text-[11.5px] text-u-muted">
            Applicants are linked to person records through <span className="font-mono">ApplicationParty</span> — a
            person's record is never copied into the application.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <MockTag label="Prototype" />
          <Button
            size="xs"
            variant="secondary"
            icon={<IconPlus width={12} height={12} />}
            onClick={() => open({ kind: "addCoApplicant" })}
          >
            Add Co-Applicant
          </Button>
          <Button size="xs" variant="ghost" icon={<IconPlus width={12} height={12} />} onClick={() => open({ kind: "addOccupant" })}>
            Add Proposed Occupant
          </Button>
        </div>
      </div>

      <SubSection
        title="Applicants (people applying as tenants)"
        hint={`${applicants.length} applicant${applicants.length === 1 ? "" : "s"} on this application`}
        actions={
          <Badge tone="indigo">
            {applicants.filter((p) => p.isPrimary).length} primary
          </Badge>
        }
      >
        <MiniTable head={["Applicant", "Contact", "Role", "Screening", "Required Documents", "Signature", "Actions"]}>
          {applicants.map((p) => {
            const person = p.personId ? personOf(state, p.personId) : undefined;
            const tenant = person?.tenantId ? tenantOf(state, person.tenantId) : undefined;
            const docs = documentsOf(state, applicationId).filter((d) => d.applicationPartyId === p.id);
            return (
              <tr key={p.id} className="align-top hover:bg-u-s2/50">
                <Td>
                  <div className="flex items-start gap-2">
                    <Avatar name={p.fullName} size="sm" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium text-u-ink">
                        <span className="truncate">{p.fullName}</span>
                        {p.isPrimary && <Badge tone="indigo">Primary</Badge>}
                      </p>
                      {p.preferredName && (
                        <p className="text-[11px] text-u-muted">Prefers “{p.preferredName}”</p>
                      )}
                      {person?.currentAddress && (
                        <p className="max-w-[220px] truncate text-[11px] text-u-muted">
                          {person.currentAddress}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {tenant ? (
                          <Tooltip
                            label={`Existing tenant record ${tenant.code}\nStatus: ${tenant.status}\nSince ${formatDate(
                              tenant.since,
                            )}${tenant.balanceCents ? `\nBalance: ${currency(tenant.balanceCents / 100)}` : ""}`}
                          >
                            <span className="inline-flex items-center gap-1 rounded border border-u-ok/30 bg-u-ok/8 px-1.5 py-px text-[10px] text-u-ok">
                              <IconUser width={10} height={10} />
                              {tenant.code}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border border-dashed border-u-line2 px-1.5 py-px text-[10px] text-u-muted">
                            No tenant record
                          </span>
                        )}
                        <span className="text-[10px] text-u-muted">{docs.length} doc{docs.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <p className="text-u-ink2">{p.email || "—"}</p>
                  <p className="text-u-muted">{p.phone || "—"}</p>
                  <p className="mt-0.5 text-[11px] text-u-muted">Contact via {p.preferredContact}</p>
                </Td>
                <Td>
                  <Badge tone={p.role === "Primary Applicant" ? "indigo" : "blue"}>{p.role}</Badge>
                  <p className="mt-1 max-w-[140px] text-[11px] text-u-muted">{p.relationship}</p>
                  {p.incomeMonthly != null && (
                    <p className="mt-1 text-[11px] text-u-muted">
                      Stated income {currency(p.incomeMonthly)}/mo
                    </p>
                  )}
                </Td>
                <Td>
                  <ScreeningStatusBadge status={p.screeningStatus} />
                  {p.employment && <p className="mt-1 max-w-[130px] text-[11px] text-u-muted">{p.employment}</p>}
                </Td>
                <Td>
                  {p.requiredDocuments.length === 0 ? (
                    <span className="text-u-muted">None configured</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {p.requiredDocuments.map((doc) => {
                        const satisfied = docs.some(
                          (d) => d.category === doc && (d.status === "Accepted" || d.status === "Under Review"),
                        );
                        return (
                          <li key={doc} className="flex items-start gap-1 text-[11.5px]">
                            <span className={satisfied ? "text-u-ok" : "text-u-warn"}>
                              {satisfied ? "✓" : "•"}
                            </span>
                            <span className={satisfied ? "text-u-muted line-through decoration-u-muted/40" : "text-u-ink2"}>
                              {doc}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Td>
                <Td>
                  <Badge
                    tone={
                      p.signatureStatus === "Signed"
                        ? "emerald"
                        : p.signatureStatus === "Sent"
                          ? "amber"
                          : p.signatureStatus === "Not Applicable"
                            ? "neutral"
                            : "slate"
                    }
                  >
                    {p.signatureStatus}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-0.5">
                    <Tooltip label="Edit applicant details (application copy only)">
                      <IconButton label="Edit applicant details" onClick={() => open({ kind: "editParty", partyId: p.id })}>
                        <IconPencil width={14} height={14} />
                      </IconButton>
                    </Tooltip>
                    {tenant ? (
                      <Tooltip label="View existing tenant profile">
                        <IconButton label="View tenant profile" onClick={() => open({ kind: "viewTenant", partyId: p.id })}>
                          <IconExternal width={14} height={14} />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip label="Create or link a person / tenant record">
                        <IconButton label="Create or link tenant record" onClick={() => open({ kind: "linkTenant", partyId: p.id })}>
                          <IconUser width={14} height={14} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip label="Remove from application (person record is kept)">
                      <IconButton
                        label="Remove applicant from application"
                        tone="danger"
                        onClick={() => open({ kind: "removeParty", partyId: p.id })}
                      >
                        <IconTrash width={14} height={14} />
                      </IconButton>
                    </Tooltip>
                  </div>
                </Td>
              </tr>
            );
          })}
        </MiniTable>
      </SubSection>

      <SubSection
        title="Proposed occupants (not applicants)"
        hint="Household members who will live in the unit but are not financially or contractually responsible."
      >
        {occupants.length === 0 ? (
          <EmptyHint>No proposed occupants recorded for this application.</EmptyHint>
        ) : (
          <MiniTable head={["Occupant", "Relationship", "Age / Notes", "Signature", "Actions"]}>
            {occupants.map((p) => (
              <tr key={p.id} className="hover:bg-u-s2/50">
                <Td>
                  <div className="flex items-center gap-2">
                    <Avatar name={p.fullName} size="sm" tone="muted" />
                    <span className="text-u-ink2">{p.fullName}</span>
                  </div>
                </Td>
                <Td>{p.relationship}</Td>
                <Td>
                  {p.notes ?? <span className="text-u-muted">No additional notes</span>}
                </Td>
                <Td>
                  <Badge tone="neutral">{p.signatureStatus}</Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-0.5">
                    <IconButton label="Edit occupant" onClick={() => open({ kind: "editParty", partyId: p.id })}>
                      <IconPencil width={14} height={14} />
                    </IconButton>
                    <IconButton
                      label="Remove occupant"
                      tone="danger"
                      onClick={() => open({ kind: "removeParty", partyId: p.id })}
                    >
                      <IconTrash width={14} height={14} />
                    </IconButton>
                  </div>
                </Td>
              </tr>
            ))}
          </MiniTable>
        )}
        <div className="mt-2.5">
          <Note>
            <IconLock width={11} height={11} className="mr-1 inline align-[-1px]" />
            Occupants are recorded separately from co-applicants and are never screened as applicants. Adding or
            removing a party here never deletes the underlying person or tenant record.
          </Note>
        </div>
      </SubSection>
    </div>
  );
}
