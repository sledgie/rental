import type { Dataset, ReportFilters } from "../types";
import { properties } from "../data/entities";

export function propertyMatches(propertyId: string | null | undefined, filters: ReportFilters, ds?: Dataset): boolean {
  if (filters.propertyId !== "all") {
    return propertyId === filters.propertyId;
  }
  if (filters.ownerId !== "all") {
    if (!propertyId) return false;
    const list = ds?.properties ?? properties;
    const property = list.find((p) => p.propertyId === propertyId);
    return property?.ownerId === filters.ownerId;
  }
  if (filters.portfolioId !== "all") {
    if (!propertyId) return false;
    const list = ds?.properties ?? properties;
    const property = list.find((p) => p.propertyId === propertyId);
    return property?.portfolioId === filters.portfolioId;
  }
  return true;
}

export function propertyLabel(filters: ReportFilters, ds: Dataset): string {
  if (filters.propertyId !== "all") {
    return ds.properties.find((p) => p.propertyId === filters.propertyId)?.propertyName ?? "Selected property";
  }
  if (filters.ownerId !== "all") {
    return ds.owners.find((o) => o.ownerId === filters.ownerId)?.ownerName ?? "Selected owner";
  }
  return "Consolidated portfolio";
}

export function activeFilterChips(filters: ReportFilters, ds: Dataset): Array<{ key: string; label: string }> {
  const chips: Array<{ key: string; label: string }> = [];
  if (filters.propertyId !== "all") {
    chips.push({
      key: "propertyId",
      label: `Property: ${ds.properties.find((p) => p.propertyId === filters.propertyId)?.propertyName ?? filters.propertyId}`,
    });
  }
  if (filters.ownerId !== "all") {
    chips.push({
      key: "ownerId",
      label: `Owner: ${ds.owners.find((o) => o.ownerId === filters.ownerId)?.ownerName ?? filters.ownerId}`,
    });
  }
  if (filters.accountId !== "all") {
    const acct = ds.accounts.find((a) => a.accountId === filters.accountId);
    chips.push({ key: "accountId", label: `Account: ${acct ? `${acct.accountCode} ${acct.accountName}` : filters.accountId}` });
  }
  if (filters.tenantId !== "all") {
    chips.push({
      key: "tenantId",
      label: `Tenant: ${ds.tenants.find((t) => t.tenantId === filters.tenantId)?.tenantName ?? filters.tenantId}`,
    });
  }
  if (filters.vendorId !== "all") {
    chips.push({
      key: "vendorId",
      label: `Vendor: ${ds.vendors.find((v) => v.vendorId === filters.vendorId)?.vendorName ?? filters.vendorId}`,
    });
  }
  if (filters.bankAccountId !== "all") {
    chips.push({
      key: "bankAccountId",
      label: `Bank: ${ds.bankAccounts.find((b) => b.bankAccountId === filters.bankAccountId)?.name ?? filters.bankAccountId}`,
    });
  }
  if (filters.transactionType !== "all") {
    chips.push({ key: "transactionType", label: `Type: ${filters.transactionType}` });
  }
  if (filters.paymentMethod !== "all") {
    chips.push({ key: "paymentMethod", label: `Method: ${filters.paymentMethod}` });
  }
  return chips;
}
