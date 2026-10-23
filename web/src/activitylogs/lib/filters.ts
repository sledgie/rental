import { ACTOR_TYPES, ACTIONS, CATEGORIES, DEFAULT_FILTERS, ENTITY_TYPES, OUTCOMES, SEVERITIES, type ActivityFilters } from "./types";

export const GROUPS = ["financial", "propertyTenant", "documentLease", "security", "failedDenied"] as const;
const sorts = new Set(["occurredAt", "actorDisplayName", "action", "category", "outcome", "severity"]);
const pageSizes = new Set([10, 25, 50, 100]);

export function parseActivityFilters(params: URLSearchParams): ActivityFilters {
  const value = (key: string) => params.get(key)?.trim() ?? "";
  const allowed = (key: string, values: readonly string[]) => {
    const candidate = value(key);
    return values.includes(candidate) ? candidate : "";
  };
  const page = Math.max(1, Number.parseInt(value("page") || "1", 10) || 1);
  const requestedSize = Number.parseInt(value("pageSize") || "10", 10);
  return {
    ...DEFAULT_FILTERS,
    q: value("q").slice(0, 200),
    from: value("from"),
    to: value("to"),
    actorId: value("actorId"),
    actorType: allowed("actorType", ACTOR_TYPES),
    category: allowed("category", CATEGORIES),
    action: allowed("action", ACTIONS),
    propertyId: value("propertyId"),
    unitId: value("unitId"),
    entityType: allowed("entityType", ENTITY_TYPES),
    entityId: value("entityId"),
    outcome: allowed("outcome", OUTCOMES),
    severity: allowed("severity", SEVERITIES),
    group: allowed("group", GROUPS),
    sort: sorts.has(value("sort")) ? value("sort") : "occurredAt",
    direction: value("direction") === "asc" ? "asc" : "desc",
    page,
    pageSize: pageSizes.has(requestedSize) ? requestedSize : 10,
  };
}

export function filtersToSearchParams(filters: ActivityFilters, includePagination = true) {
  const params = new URLSearchParams();
  const keys: (keyof ActivityFilters)[] = [
    "q", "from", "to", "actorId", "actorType", "category", "action", "propertyId", "unitId",
    "entityType", "entityId", "outcome", "severity", "group", "sort", "direction",
  ];
  for (const key of keys) {
    const value = String(filters[key]);
    if (value && !(key === "sort" && value === "occurredAt") && !(key === "direction" && value === "desc")) params.set(key, value);
  }
  if (includePagination) {
    if (filters.page > 1) params.set("page", String(filters.page));
    if (filters.pageSize !== 10) params.set("pageSize", String(filters.pageSize));
  }
  return params;
}
