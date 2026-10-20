import { useStore, propertyOf, unitOf, staffName } from "../../state/store";
import { currency, formatDate } from "../../lib/format";
import { Badge, UnitStatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Info, InfoGrid } from "../../components/ui/Misc";
import { Note, SubSection } from "./parts";
import { IconBuilding, IconExternal, IconHome } from "../../components/icons";
import type { DialogRequest } from "./dialogTypes";

export function PropertyUnitSection({
  applicationId,
  open,
}: {
  applicationId: string;
  open: (d: DialogRequest) => void;
}) {
  const { state } = useStore();
  const app = state.applications.find((a) => a.id === applicationId);
  if (!app) return null;
  const property = propertyOf(state, app.propertyId);
  const unit = unitOf(state, app.unitId);
  const otherApplications = state.applications.filter(
    (a) => a.unitId === app.unitId && a.id !== app.id && a.status !== "Archived" && a.status !== "Draft",
  );

  return (
    <div className="rounded-xl border border-u-line bg-u-card/60 p-3.5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-u-ink">C. Property and Unit Details</h3>
          <p className="mt-0.5 text-[11.5px] text-u-muted">
            Referenced from the Properties and Units modules. Availability is the live unit status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="xs" variant="secondary" icon={<IconBuilding width={12} height={12} />} onClick={() => open({ kind: "viewProperty" })}>
            View Property
          </Button>
          <Button size="xs" variant="secondary" icon={<IconHome width={12} height={12} />} onClick={() => open({ kind: "viewUnit" })}>
            View Unit
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SubSection title="Property" hint="Existing property record">
          <InfoGrid cols={2}>
            <Info label="Property Name" value={property?.name ?? "—"} />
            <Info label="Property Type" value={property?.propertyType ?? "—"} />
            <Info
              label="Property Address"
              value={
                property
                  ? `${property.addressLine1}, ${property.city}, ${property.state} ${property.postalCode}`
                  : "—"
              }
              className="sm:col-span-2"
            />
            <Info label="Year Built" value={property?.yearBuilt ?? "—"} />
            <Info label="Managed By" value={property?.managerId ? staffName(state, property.managerId) : "—"} />
          </InfoGrid>
        </SubSection>

        <SubSection title="Unit" hint="Existing unit record">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[13px] font-medium text-u-ink">Unit {unit?.unitNumber}</span>
            {unit && <UnitStatusBadge status={unit.status} />}
          </div>
          <InfoGrid cols={2}>
            <Info label="Unit Type" value={unit?.unitType ?? "—"} />
            <Info label="Size" value={unit ? `${unit.squareFeet} sq ft · ${unit.bedrooms} bd / ${unit.bathrooms} ba` : "—"} />
            <Info label="Advertised Monthly Rent" value={currency(unit?.advertisedRent ?? app.advertisedRent)} />
            <Info
              label="Proposed Monthly Rent"
              value={
                app.proposedRent != null && app.proposedRent !== app.advertisedRent ? (
                  <span className="text-u-warn">{currency(app.proposedRent)}</span>
                ) : (
                  "Same as advertised"
                )
              }
            />
            <Info label="Available From" value={formatDate(unit?.availableFrom)} />
            <Info
              label="Parking"
              value={
                unit
                  ? `${unit.parkingSpaces} space${unit.parkingSpaces === 1 ? "" : "s"}${
                      unit.parkingFee ? ` · ${currency(unit.parkingFee)}/mo` : " · no fee"
                    }`
                  : "—"
              }
            />
          </InfoGrid>
        </SubSection>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <SubSection title="Requested tenancy">
          <InfoGrid cols={2}>
            <Info label="Requested Move-in Date" value={formatDate(app.requestedMoveInDate)} />
            <Info label="Requested Lease Term" value={`${app.requestedLeaseTerm} months`} />
            <Info label="Proposed Occupants" value={`${app.proposedOccupants}`} />
            <Info label="Parking Requirement" value={app.parkingRequired || "—"} />
            <Info label="Pet Information" value={app.petInfo || "None reported"} className="sm:col-span-2" />
            <Info label="Additional Rental Preferences" value={app.rentalPreferences || "—"} className="sm:col-span-2" />
          </InfoGrid>
        </SubSection>

        <SubSection title="Unit availability & reservation" hint="Approving an application never reserves the unit or marks it occupied.">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-u-line bg-u-s2/50 px-2.5 py-2">
              <span className="text-[11.5px] text-u-muted">Unit status</span>
              {unit && <UnitStatusBadge status={unit.status} />}
              <span className="text-[11.5px] text-u-muted">
                · available {formatDate(unit?.availableFrom)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-u-line bg-u-s2/50 px-2.5 py-2">
              <span className="text-[11.5px] text-u-muted">Reservation</span>
              <Badge tone={app.unitReservation === "None" ? "neutral" : "cyan"}>{app.unitReservation}</Badge>
              <span className="text-[11px] text-u-muted">
                Tracked separately from the application and the unit record.
              </span>
            </div>
            <div className="rounded-lg border border-u-line bg-u-s2/50 px-2.5 py-2">
              <p className="text-[11.5px] text-u-muted">
                Other active applications for Unit {unit?.unitNumber}:{" "}
                {otherApplications.length === 0 ? (
                  <span className="text-u-ink2">none</span>
                ) : (
                  <span className="text-u-ink2">
                    {otherApplications.map((a) => a.applicationNumber).join(", ")}
                  </span>
                )}
              </p>
              <p className="mt-1 text-[11px] text-u-muted">
                Multiple applications per unit are expected — staff choose which one to advance.
              </p>
            </div>
          </div>
        </SubSection>
      </div>

      <div className="mt-3">
        <Note>
          <IconExternal width={11} height={11} className="mr-1 inline align-[-1px]" />
          Unit occupancy only changes through the lease move-in process in the Leases module.
        </Note>
      </div>
    </div>
  );
}
