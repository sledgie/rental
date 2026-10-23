import { isSupabaseConfigured } from "../../lib/supabase";
import type { Lease, Property, ServiceProvider, Tenant, Unit } from "../types";

export const properties: Property[] = [
  {
    id: "prop-maple",
    name: "Maple Court Apartments",
    address: "124 Maple Street",
    city: "Toronto, ON",
    type: "Multi-residential",
    units: 4,
  },
  {
    id: "prop-harbour",
    name: "Harbourview Townhomes",
    address: "88 Queens Quay West",
    city: "Toronto, ON",
    type: "Townhomes",
    units: 2,
  },
  {
    id: "prop-oakridge",
    name: "Oakridge Duplex",
    address: "45 Oakridge Drive",
    city: "Mississauga, ON",
    type: "Duplex",
    units: 2,
  },
];

export const units: Unit[] = [
  { id: "unit-maple-101", propertyId: "prop-maple", name: "Unit 101", beds: 1, status: "occupied" },
  { id: "unit-maple-102", propertyId: "prop-maple", name: "Unit 102", beds: 1, status: "occupied" },
  { id: "unit-maple-201", propertyId: "prop-maple", name: "Unit 201", beds: 2, status: "occupied" },
  { id: "unit-maple-202", propertyId: "prop-maple", name: "Unit 202", beds: 2, status: "vacant" },
  { id: "unit-harbour-a", propertyId: "prop-harbour", name: "Townhome A", beds: 3, status: "occupied" },
  { id: "unit-harbour-b", propertyId: "prop-harbour", name: "Townhome B", beds: 3, status: "occupied" },
  { id: "unit-oak-1", propertyId: "prop-oakridge", name: "Unit 1", beds: 2, status: "occupied" },
  { id: "unit-oak-2", propertyId: "prop-oakridge", name: "Unit 2", beds: 2, status: "occupied" },
];

export const tenants: Tenant[] = [
  {
    id: "ten-sarah",
    name: "Sarah Chen",
    email: "sarah.chen@email.com",
    phone: "416-555-0142",
    unitId: "unit-maple-101",
    leaseId: "lease-sarah",
  },
  {
    id: "ten-james",
    name: "James Okonkwo",
    email: "james.okonkwo@email.com",
    phone: "416-555-0198",
    unitId: "unit-maple-102",
    leaseId: "lease-james",
  },
  {
    id: "ten-priya",
    name: "Priya Patel",
    email: "priya.patel@email.com",
    phone: "647-555-0110",
    unitId: "unit-maple-201",
    leaseId: "lease-priya",
  },
  {
    id: "ten-michael",
    name: "Michael Brennan",
    email: "m.brennan@email.com",
    phone: "416-555-0177",
    unitId: "unit-harbour-a",
    leaseId: "lease-michael",
  },
  {
    id: "ten-emma",
    name: "Emma Walsh",
    email: "emma.walsh@email.com",
    phone: "647-555-0133",
    unitId: "unit-harbour-b",
    leaseId: "lease-emma",
  },
  {
    id: "ten-david",
    name: "David Kim",
    email: "david.kim@email.com",
    phone: "905-555-0164",
    unitId: "unit-oak-1",
    leaseId: "lease-david",
  },
  {
    id: "ten-lisa",
    name: "Lisa Nguyen",
    email: "lisa.nguyen@email.com",
    phone: "905-555-0188",
    unitId: "unit-oak-2",
    leaseId: "lease-lisa",
  },
];

export const leases: Lease[] = [
  {
    id: "lease-sarah",
    tenantId: "ten-sarah",
    unitId: "unit-maple-101",
    startDate: "2025-05-01",
    endDate: "2026-04-30",
    rent: 1850,
    utilityClause: "Tenant pays 30% of electricity (Hydro). Landlord covers remaining utilities except internet.",
  },
  {
    id: "lease-james",
    tenantId: "ten-james",
    unitId: "unit-maple-102",
    startDate: "2025-08-01",
    endDate: "2026-07-31",
    rent: 1795,
    utilityClause: "Tenant reimburses 40% of unit hydro. Water is shared equally among occupied units.",
  },
  {
    id: "lease-priya",
    tenantId: "ten-priya",
    unitId: "unit-maple-201",
    startDate: "2024-11-01",
    endDate: "2026-10-31",
    rent: 2350,
    utilityClause: "Water shared equally among occupied Maple Court units. Hydro billed separately.",
  },
  {
    id: "lease-michael",
    tenantId: "ten-michael",
    unitId: "unit-harbour-a",
    startDate: "2025-01-15",
    endDate: "2026-01-14",
    rent: 3200,
    utilityClause: "Tenant contributes a fixed $30.00 toward internet. Gas and hydro remain landlord responsibility unless otherwise noted.",
  },
  {
    id: "lease-emma",
    tenantId: "ten-emma",
    unitId: "unit-harbour-b",
    startDate: "2025-09-01",
    endDate: "2026-08-31",
    rent: 3150,
    utilityClause: "Tenant responsible for 50% of electricity. Internet billed to landlord.",
  },
  {
    id: "lease-david",
    tenantId: "ten-david",
    unitId: "unit-oak-1",
    startDate: "2025-03-01",
    endDate: "2026-02-28",
    rent: 2100,
    utilityClause: "No tenant recovery on property insurance or property tax. Internet split as a fixed $25.",
  },
  {
    id: "lease-lisa",
    tenantId: "ten-lisa",
    unitId: "unit-oak-2",
    startDate: "2025-06-01",
    endDate: "2026-05-31",
    rent: 2050,
    utilityClause: "No tenant recovery on insurance. Internet contribution $25 fixed.",
  },
];

export const providers: ServiceProvider[] = [
  {
    id: "prov-hydro",
    name: "Toronto Hydro",
    category: "hydro",
    email: "billing@torontohydro.com",
    phone: "416-542-8000",
    website: "torontohydro.com",
  },
  {
    id: "prov-enbridge",
    name: "Enbridge Gas",
    category: "gas",
    email: "customerservice@enbridge.com",
    phone: "1-877-362-7434",
    website: "enbridgegas.com",
  },
  {
    id: "prov-water-to",
    name: "City of Toronto Water",
    category: "water",
    email: "revenue@toronto.ca",
    phone: "416-338-0338",
  },
  {
    id: "prov-rogers",
    name: "Rogers Communications",
    category: "internet",
    email: "business@rogers.com",
    phone: "1-888-764-3771",
  },
  {
    id: "prov-intact",
    name: "Intact Insurance",
    category: "insurance",
    email: "commercial@intact.net",
    phone: "1-866-941-5094",
  },
  {
    id: "prov-miss",
    name: "City of Mississauga",
    category: "property_tax",
    email: "tax@mississauga.ca",
    phone: "905-615-4311",
  },
  {
    id: "prov-cam",
    name: "Northline Property Services",
    category: "maintenance",
    email: "accounts@northline.ca",
    phone: "416-555-0201",
  },
  {
    id: "prov-alectra",
    name: "Alectra Utilities",
    category: "hydro",
    email: "billing@alectrautilities.com",
    phone: "1-833-253-2872",
  },
];

/** Replaces the lists in place (the rest of the module imports these arrays directly). */
export function replaceCatalog(next: { properties: Property[]; units: Unit[]; tenants: Tenant[]; leases: Lease[]; providers: ServiceProvider[] }) {
  properties.splice(0, properties.length, ...next.properties);
  units.splice(0, units.length, ...next.units);
  tenants.splice(0, tenants.length, ...next.tenants);
  leases.splice(0, leases.length, ...next.leases);
  providers.splice(0, providers.length, ...next.providers);
}

// With Supabase the sample properties, tenants and providers must never show: the lists start empty and are filled by replaceCatalog.
if (isSupabaseConfigured) replaceCatalog({ properties: [], units: [], tenants: [], leases: [], providers: [] });

export function getProperty(id: string) {
  return properties.find((p) => p.id === id);
}

export function getUnit(id: string) {
  return units.find((u) => u.id === id);
}

export function getTenant(id: string) {
  return tenants.find((t) => t.id === id);
}

export function getProvider(id: string) {
  return providers.find((p) => p.id === id);
}

export function getLease(id: string) {
  return leases.find((l) => l.id === id);
}

export function tenantsInUnit(unitId: string) {
  return tenants.filter((t) => t.unitId === unitId);
}

export function unitsForProperty(propertyId: string) {
  return units.filter((u) => u.propertyId === propertyId);
}

export function propertyLabel(propertyId: string, unitIds: string[] = []): string {
  const property = getProperty(propertyId);
  if (!property) return "Unknown property";
  if (!unitIds.length) return property.name;
  const names = unitIds
    .map((id) => getUnit(id)?.name)
    .filter(Boolean)
    .join(", ");
  return names ? `${property.name} · ${names}` : property.name;
}
