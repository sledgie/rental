import type { AutomationRule, CommunicationEvent, RuleCondition } from "./types";

function compare(actual: unknown, operator: string, expected: string): boolean {
  if (["greater_than", "greater_or_equal", "less_than", "less_or_equal"].includes(operator)) {
    const left = Number(actual);
    const right = Number(expected);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (operator === "greater_than") return left > right;
    if (operator === "greater_or_equal") return left >= right;
    if (operator === "less_than") return left < right;
    return left <= right;
  }
  if (operator === "contains") return String(actual ?? "").toLowerCase().includes(expected.toLowerCase());
  if (operator === "is_empty") return actual === undefined || actual === null || actual === "";
  if (operator === "is_not_empty") return actual !== undefined && actual !== null && actual !== "";
  const normalize = (value: unknown) => {
    if (typeof value === "boolean") return String(value);
    return String(value ?? "").toLowerCase();
  };
  if (operator === "not_equals") return normalize(actual) !== normalize(expected);
  return normalize(actual) === normalize(expected);
}

export function evaluateCondition(condition: RuleCondition, data: Record<string, unknown>) {
  const actual = data[condition.field];
  return { ...condition, actual: actual === undefined ? null : actual, passed: compare(actual, condition.operator, condition.value) };
}

export function evaluateAutomationRule(rule: AutomationRule, event: CommunicationEvent) {
  const eventMatches = rule.eventType === event.eventType;
  const propertyMatches = rule.propertyScope.type === "company" || rule.propertyScope.propertyIds.includes(event.propertyId);
  const entityMatches = !rule.recipientRules.entityId || ((rule.recipientRules.entityType ?? event.entityType) === event.entityType && rule.recipientRules.entityId === event.entityId);
  const conditionResults = rule.conditions.map((condition) => evaluateCondition(condition, event.data));
  const conditionsPassed = conditionResults.every((condition) => condition.passed);
  const eligible = rule.status === "active" && rule.executionMode !== "simulated" && eventMatches && propertyMatches && entityMatches && conditionsPassed && Boolean(rule.templateId);
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    eligible,
    eventMatches,
    propertyMatches,
    entityMatches,
    conditionsPassed,
    conditionResults,
    templateSelected: Boolean(rule.templateId),
    duplicateKey: `${rule.id}:${event.entityType}:${event.entityId}:${rule.duplicatePreventionKey}`,
    dispatch: {
      executed: false as const,
      reason: "Evaluation only. Connect the background event worker and a delivery provider to execute this plan.",
      scheduledAfterMinutes: rule.delayConfiguration.unit === "days" ? rule.delayConfiguration.amount * 1440 : rule.delayConfiguration.unit === "hours" ? rule.delayConfiguration.amount * 60 : rule.delayConfiguration.amount,
    },
  };
}
