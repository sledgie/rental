import { EXPIRY_WARNING_DAYS } from "../../data/mockData";
import type { UnitRow } from "../../data/selectors";
import { formatDate, money } from "../../lib/format";
import type { Database } from "../../data/types";
import { Icon } from "../../components/ui/Icon";
import { Pill, Thumb } from "../../components/ui/primitives";
import { Callout } from "../../components/ui/Modal";
import { ActionLink, Def, DefGrid, SectionCard } from "./common";
import { conditionTone, inspectionTone, LeaseStatusPill, UnitStatusPill } from "../status";

function spec(unit: UnitRow["unit"], key: "bedrooms" | "bathrooms" | "squareFootage", suffix: string) {
  const v = unit[key];
  if (v === null || v === undefined) return <span className="text-u-muted">Not recorded</span>;
  if (key === "bedrooms" && v === 0) return <>Studio</>;
  return (
    <>
      {v} {suffix}
    </>
  );
}

export function UnitOverview({
  row,
  db,
  variant = "compact",
  onEdit,
}: {
  row: UnitRow;
  db: Database;
  variant?: "compact" | "full";
  onEdit?: () => void;
}) {
  const { unit, property } = row;
  const inspection = unit.inspection;

  return (
    <SectionCard
      icon="door"
      step="A"
      title="Unit Overview"
      meta={property ? `${property.propertyName} · ${property.city}, ${property.province}` : "Property not linked"}
      actions={
        <>
          <ActionLink href={`/properties/${unit.propertyId}`} icon="external">
            View property
          </ActionLink>
          {onEdit && (
            <ActionLink onClick={onEdit} icon="edit">
              Edit unit
            </ActionLink>
          )}
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,230px)_minmax(0,1fr)]">
        {/* identity */}
        <div className="rounded-md border border-u-line2 bg-u-bg/50 p-3">
          <div className="flex items-start gap-3">
            <Thumb
              src={unit.imageUrl ?? property?.imageUrl}
              alt={`Unit ${unit.unitNumber}`}
              fallbackIcon="door"
              className="h-14 w-16"
            />
            <div className="min-w-0">
              <p className="font-display text-[22px] font-700 leading-none text-u-ink">{unit.unitNumber}</p>
              <p className="u-num mt-1 text-[11px] text-u-muted">{unit.id}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-u-muted">{unit.unitType}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <UnitStatusPill status={unit.unitStatus} pulse={unit.unitStatus === "Occupied"} />
            <Pill tone={conditionTone[unit.unitCondition]}>{unit.unitCondition}</Pill>
            <LeaseStatusPill status={row.ctx.derivedStatus} />
          </div>
          {property && (
            <p className="mt-3 border-t border-u-line2 pt-2.5 text-[11.5px] leading-relaxed text-u-muted">
              {property.address}
              <br />
              {property.city}, {property.province} {property.postalCode}
              <br />
              <span className="text-u-muted">Managed by {property.manager}</span>
            </p>
          )}
        </div>

        {/* specification grid */}
        <div className="min-w-0">
          <DefGrid cols={4}>
            <Def label="Unit ID" mono>
              {unit.id}
            </Def>
            <Def label="Unit number">{unit.unitNumber}</Def>
            <Def label="Property">
              <a
                href={`#/properties/${unit.propertyId}`}
                className="text-u-accent underline-offset-2 hover:text-u-accent hover:underline"
              >
                {property?.propertyName ?? "—"}
              </a>
            </Def>
            <Def label="Unit type">{unit.unitType}</Def>
            <Def label="Bedrooms">{spec(unit, "bedrooms", "bedrooms")}</Def>
            <Def label="Bathrooms">{spec(unit, "bathrooms", "baths")}</Def>
            <Def label="Square footage" mono>
              {unit.squareFootage ? `${unit.squareFootage.toLocaleString("en-CA")} sq ft` : <span className="text-u-muted">Not measured</span>}
            </Def>
            <Def label="Floor / level">{unit.floor ?? <span className="text-u-muted">—</span>}</Def>
            <Def label="Furnished">{unit.furnished}</Def>
            <Def label="Parking">{unit.parkingDetails ?? <span className="text-u-muted">No allocation</span>}</Def>
            <Def label="Storage">{unit.storageDetails ?? <span className="text-u-muted">None</span>}</Def>
            <Def label="Condition">
              <Pill tone={conditionTone[unit.unitCondition]}>{unit.unitCondition}</Pill>
            </Def>

            {unit.yearRenovated !== undefined && <Def label="Year renovated" mono>{unit.yearRenovated}</Def>}
            {unit.appliances && unit.appliances.length > 0 && (
              <Def label="Appliances" span>
                <span className="flex flex-wrap gap-1">
                  {unit.appliances.map((a) => (
                    <Pill key={a} tone="neutral">
                      {a}
                    </Pill>
                  ))}
                </span>
              </Def>
            )}
            {unit.utilitiesIncluded && unit.utilitiesIncluded.length > 0 && (
              <Def label="Utilities included" span>
                <span className="flex flex-wrap gap-1">
                  {unit.utilitiesIncluded.map((u) => (
                    <Pill key={u} tone="cyan">
                      {u}
                    </Pill>
                  ))}
                </span>
              </Def>
            )}
            {unit.accessibilityFeatures && unit.accessibilityFeatures.length > 0 && (
              <Def label="Accessibility" span>
                <span className="flex flex-wrap gap-1">
                  {unit.accessibilityFeatures.map((f) => (
                    <Pill key={f} tone="jade">
                      {f}
                    </Pill>
                  ))}
                </span>
              </Def>
            )}
            {inspection && (
              <Def label="Inspection status" span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={inspectionTone[inspection.status]} dot={inspection.status === "Overdue"} pulse={inspection.status === "Overdue"}>
                    {inspection.status}
                  </Pill>
                  {inspection.lastInspectionDate && (
                    <span className="text-[11.5px] text-u-muted">Last {formatDate(inspection.lastInspectionDate)}</span>
                  )}
                  {inspection.nextInspectionDate && (
                    <span className="text-[11.5px] text-u-muted">Next {formatDate(inspection.nextInspectionDate)}</span>
                  )}
                  {inspection.inspector && <span className="text-[11px] text-u-muted">· {inspection.inspector}</span>}
                </span>
              </Def>
            )}
            {variant === "full" && (
              <>
                <Def label="Advertised rent" mono>
                  {unit.advertisedRent ? money(unit.advertisedRent) : <span className="text-u-muted">Not listed</span>}
                </Def>
                <Def label="Available from">
                  {unit.availabilityDate ? formatDate(unit.availabilityDate) : <span className="text-u-muted">—</span>}
                </Def>
                <Def label="Created" mono>
                  {formatDate(unit.createdAt)}
                </Def>
                <Def label="Last updated" mono>
                  {formatDate(unit.updatedAt)}
                </Def>
                <Def label="Register state">
                  {unit.archived ? <Pill tone="rose">Archived</Pill> : <Pill tone="jade">Active register</Pill>}
                </Def>
                <Def label="Units on this property" mono>
                  {db.units.filter((u) => u.propertyId === unit.propertyId).length}
                </Def>
              </>
            )}
          </DefGrid>
        </div>
      </div>

      {unit.notes && (
        <div className="mt-3 flex gap-2 rounded-md border border-u-line2 bg-u-bg/45 px-3 py-2.5">
          <Icon name="clipboard" size={13} className="mt-0.5 shrink-0 text-u-muted" />
          <p className="text-[12px] leading-relaxed text-u-muted">
            <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-u-muted">
              Internal notes
            </span>
            {unit.notes}
          </p>
        </div>
      )}

      {row.conflicts.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {row.conflicts.map((c) => (
            <Callout key={c} tone="amber" icon="alert" title="Status review required">
              {c}
            </Callout>
          ))}
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-u-muted">
        <Icon name="info" size={11} />
        Property address, manager and descriptive fields are read from the Property record — they are not stored on the
        unit. Lease expiry warning period: {EXPIRY_WARNING_DAYS} days.
      </p>
    </SectionCard>
  );
}
