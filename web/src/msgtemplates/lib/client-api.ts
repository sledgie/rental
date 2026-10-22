// In-memory stand-in for the original /api routes and Postgres service. Same call shapes as the original client, so the
// components are unchanged; everything lives for the browser session (module scope, so it survives page navigation).
import { getProvider } from "./providers";
import { previewTemplate, sanitizeMessageHtml } from "./renderer";
import { analyzeSms, getTemplateVariables, relatedEntityForEvent, validateMergeFields, validateTemplateInput } from "./engine";
import { evaluateAutomationRule } from "./automation-engine";
import { DEFAULT_NOTIFICATION_CONFIGURATION, SAMPLE_SCENARIOS } from "./sample-data";
import { buildSeedAutomationRules, buildSeedTemplates } from "./seed-data";
import type { AutomationRule, AutomationRuleInput, CommunicationEvent, CommunicationLog, MessageTemplate, NotificationConfiguration, PreviewResult, TemplateInput } from "./types";

const ACTOR = "Alex Morgan";

export class ApiError extends Error {
  constructor(message: string, public status: number, public payload: Record<string, any>) { super(message); }
}

type Store = { templates: MessageTemplate[]; rules: AutomationRule[]; logs: CommunicationLog[]; settings: NotificationConfiguration; seeded: boolean; counter: number; listeners: Set<() => void>; version: number };
const store: Store = { templates: [], rules: [], logs: [], settings: DEFAULT_NOTIFICATION_CONFIGURATION, seeded: false, counter: 0, listeners: new Set(), version: 0 };

const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++store.counter).toString(36)}`;
const now = () => new Date().toISOString();
const emit = () => { store.version += 1; store.listeners.forEach((fn) => fn()); };
export const subscribeTemplates = (fn: () => void) => { store.listeners.add(fn); return () => { store.listeners.delete(fn); }; };
export const templatesVersion = () => store.version;

function prepared(input: TemplateInput): TemplateInput {
  const body = input.channel === "email" ? sanitizeMessageHtml(input.body) : input.body;
  const senderConfiguration = { ...input.senderConfiguration, signature: sanitizeMessageHtml(input.senderConfiguration.signature ?? "") };
  return { ...input, body, senderConfiguration, availableVariables: getTemplateVariables({ ...input, body, senderConfiguration }) };
}

function insertTemplate(input: TemplateInput, offsetMs = 0): MessageTemplate {
  const stamp = new Date(Date.now() - offsetMs).toISOString();
  const template: MessageTemplate = { ...prepared(input), id: nextId("tpl"), version: 1, createdAt: stamp, updatedAt: stamp, createdBy: ACTOR, updatedBy: ACTOR };
  store.templates.push(template);
  return template;
}

/** Seeds the example library and inactive automation rules the first time the page is opened. */
export function ensureSeeded() {
  if (store.seeded) return;
  buildSeedTemplates().forEach((input, index) => insertTemplate(input, index * 3_600_000));
  buildSeedAutomationRules(store.templates).forEach((input) => store.rules.push({ ...input, id: nextId("rule"), createdAt: now(), updatedAt: now(), createdBy: ACTOR, updatedBy: ACTOR }));
  store.seeded = true;
}

function withAutomation(template: MessageTemplate): MessageTemplate {
  const linked = store.rules.filter((rule) => rule.templateId === template.id);
  return { ...template, automationIds: linked.map((rule) => rule.id), automationNames: linked.map((rule) => rule.name) };
}
export function listTemplates(): MessageTemplate[] {
  ensureSeeded();
  return [...store.templates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(withAutomation);
}
export function findTemplate(id: string): MessageTemplate | null {
  ensureSeeded();
  const found = store.templates.find((item) => item.id === id);
  return found ? withAutomation(found) : null;
}
export function getSettings(): NotificationConfiguration { return store.settings; }

function failValidation(errors: Record<string, string>): never {
  throw new ApiError("Please correct the highlighted fields.", 422, { fields: errors });
}
const notFound = () => new ApiError("Template not found.", 404, {});

export const communicationApi = {
  async createTemplate(template: TemplateInput) {
    ensureSeeded();
    const input = { ...template, availableVariables: getTemplateVariables(template) };
    const errors = validateTemplateInput(input);
    if (Object.keys(errors).length) failValidation(errors);
    const created = insertTemplate(input);
    emit();
    return { template: created };
  },
  async updateTemplate(id: string, template: TemplateInput) {
    const index = store.templates.findIndex((item) => item.id === id);
    if (index < 0) throw notFound();
    const input = { ...template, availableVariables: getTemplateVariables(template) };
    const errors = validateTemplateInput(input);
    if (Object.keys(errors).length) failValidation(errors);
    const current = store.templates[index];
    store.templates[index] = { ...current, ...prepared(input), version: current.version + 1, updatedAt: now(), updatedBy: ACTOR };
    emit();
    return { template: store.templates[index] };
  },
  async duplicateTemplate(id: string) {
    const original = store.templates.find((item) => item.id === id);
    if (!original) throw notFound();
    const { id: _id, version: _v, createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub, automationIds: _ai, automationNames: _an, ...input } = original;
    const copy = insertTemplate({ ...input, name: `Copy of ${original.name}`, status: "draft" });
    emit();
    return { template: copy };
  },
  async deleteTemplate(id: string) {
    if (!store.templates.some((item) => item.id === id)) throw notFound();
    store.templates = store.templates.filter((item) => item.id !== id);
    // Rules stay but lose their template selection, as the original warns.
    store.rules = store.rules.map((rule) => (rule.templateId === id ? { ...rule, templateId: null } : rule));
    emit();
    return { ok: true };
  },
  async setTemplateStatus(id: string, active: boolean) {
    const index = store.templates.findIndex((item) => item.id === id);
    if (index < 0) throw notFound();
    if (active) {
      const errors = validateTemplateInput(store.templates[index]);
      if (Object.keys(errors).length) throw new ApiError("Complete template validation before activation.", 422, { fields: errors });
    }
    store.templates[index] = { ...store.templates[index], status: active ? "active" : "inactive", updatedAt: now(), updatedBy: ACTOR };
    emit();
    return { template: store.templates[index] };
  },
  async previewTemplate(template: MessageTemplate | TemplateInput, scenarioId: string): Promise<{ preview: PreviewResult }> {
    return { preview: previewTemplate({ template, scenarioId }) };
  },
  async seedTemplates() {
    ensureSeeded();
    const names = new Set(store.templates.map((item) => item.name));
    const missing = buildSeedTemplates().filter((item) => !names.has(item.name));
    missing.forEach((input) => insertTemplate(input));
    if (missing.length) emit();
    return { added: missing.length, templates: listTemplates(), message: missing.length ? `Added ${missing.length} example templates.` : "All example templates are already in your library." };
  },
  async dispatchMessage(payload: { template: MessageTemplate | TemplateInput; templateId?: string; templateVersion?: number; scenarioId?: string; recipient?: { name: string; email: string; phone: string }; confirmMissing?: boolean; mode?: "test" | "manual" }) {
    const template = payload.template;
    if (!template) throw new ApiError("Select a template.", 400, {});
    const scenario = SAMPLE_SCENARIOS.find((item) => item.id === payload.scenarioId) ?? SAMPLE_SCENARIOS[0];
    const recipient = payload.recipient ?? { name: scenario.data.tenant_full_name, email: scenario.recipient, phone: scenario.data.tenant_phone };
    const fieldErrors = validateTemplateInput(template);
    if (Object.keys(fieldErrors).length) throw new ApiError("Template validation failed.", 422, { fields: fieldErrors });
    if (template.channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) throw new ApiError("Enter a valid recipient email address.", 422, { fields: { recipient: "A valid email is required." } });
    if (template.channel === "sms" && recipient.phone.replace(/\D/g, "").length < 10) throw new ApiError("Enter a valid recipient phone number.", 422, { fields: { recipient: "A valid phone number is required." } });

    const preview = previewTemplate({ template, scenarioId: scenario.id });
    const related = relatedEntityForEvent(template.eventContext, scenario.data);
    if (template.channel === "sms" && analyzeSms(preview.plainTextBody).units > 1600) throw new ApiError("The rendered SMS exceeds the 1,600-unit safety limit after merge fields were resolved.", 422, {});
    if (template.channel === "in_app" && preview.plainTextBody.length > 500) throw new ApiError("The rendered in-app message exceeds 500 characters after merge fields were resolved.", 422, {});
    if (preview.unknownVariables.length || preview.unavailableVariables.length || preview.missingRequiredVariables.length) throw new ApiError("Resolve template variable errors before sending.", 422, { validation: preview });
    if (preview.missingVariables.length && !payload.confirmMissing) throw new ApiError("Some optional values are missing. Confirm that blank values are acceptable before continuing.", 409, { code: "CONFIRM_MISSING", validation: preview });

    const result = await getProvider(template.channel).dispatch({
      channel: template.channel, recipient, subject: preview.renderedSubject,
      body: template.channel === "email" ? preview.renderedBody : preview.plainTextBody,
      sender: template.channel === "email" ? { name: template.senderConfiguration.fromName, email: template.senderConfiguration.fromEmail, replyTo: template.senderConfiguration.replyTo } : undefined,
    });
    const stamp = now();
    const status = result.ok ? "sent" : "failed";
    const log: CommunicationLog = {
      id: nextId("log"), templateId: payload.templateId ?? ("id" in template ? template.id : null), templateVersion: payload.templateVersion ?? ("version" in template ? template.version : 1),
      automationRuleId: null, recipient, relatedEntityType: related.type, relatedEntityId: related.id,
      propertyId: scenario.id === "lease" ? "prop-harbour" : scenario.id === "maintenance" ? "prop-willow" : "prop-sutherland",
      propertyName: scenario.data.property_name, unitId: `unit-${scenario.data.unit_number}`, unitNumber: scenario.data.unit_number,
      tenantId: `tenant-${scenario.data.tenant_first_name.toLowerCase()}`, tenantName: scenario.data.tenant_full_name,
      renderedSubject: preview.renderedSubject || preview.inAppTitle || preview.plainTextBody.slice(0, 140) || template.name,
      renderedBody: template.channel === "email" ? preview.renderedBody : preview.plainTextBody,
      channel: template.channel, category: template.category, status, triggerSource: payload.mode === "manual" ? "manual" : "test",
      attemptCount: result.ok ? 1 : 0, providerMessageId: result.providerMessageId ?? null,
      providerResponse: { provider: result.provider, acceptedByProvider: result.ok, code: result.code ?? null },
      timestamps: { createdAt: stamp, ...(result.ok ? { queuedAt: stamp, sentAt: stamp } : { failedAt: stamp }) },
      attempts: [{ at: stamp, status, detail: result.ok ? "Accepted by provider; delivery to recipient is not yet confirmed." : result.message ?? "Dispatch stopped before provider handoff." }],
      errorDetails: result.ok ? null : { code: result.code, message: result.message, resolution: `Configure a ${template.channel === "in_app" ? "realtime notification" : template.channel.toUpperCase()} provider and retry from a connected worker.` },
      isMock: true, initiatedBy: ACTOR, createdAt: stamp, updatedAt: stamp,
    };
    store.logs.unshift(log);
    return {
      ok: result.ok,
      disposition: (result.ok ? "accepted_by_provider" : "not_sent") as "accepted_by_provider" | "not_sent",
      message: result.ok ? "Accepted by the provider. Delivery has not been confirmed." : "Validation completed and the request was recorded as failed. No message was sent.",
      log,
      preview,
    };
  },
};

export function listRules(): AutomationRule[] {
  ensureSeeded();
  return [...store.rules].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Port of the original rule-validation: an active rule needs an existing, active, channel-matched template whose merge fields fit the trigger. */
function activationError(rule: Pick<AutomationRuleInput, "templateId" | "channel" | "eventType">) {
  if (!rule.templateId) return "Select a template before activating this rule.";
  const template = store.templates.find((item) => item.id === rule.templateId);
  if (!template || template.status !== "active") return "The associated template must exist and be active before the rule can be activated.";
  if (template.channel !== rule.channel) return "The rule channel must match the associated template channel.";
  const validation = validateMergeFields({ ...template, eventContext: rule.eventType }, {});
  if (validation.unknownVariables.length) return `Resolve unknown template variables before activation: ${validation.unknownVariables.join(", ")}.`;
  if (validation.unavailableVariables.length) return `These template variables are unavailable for ${rule.eventType}: ${validation.unavailableVariables.join(", ")}.`;
  return null;
}

function ruleFieldErrors(input: AutomationRuleInput) {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) errors.name = "Enter a rule name.";
  if (!input.eventType) errors.eventType = "Select a trigger event.";
  if (!input.templateId) errors.templateId = "Select the template this rule uses.";
  if (input.propertyScope.type === "properties" && !input.propertyScope.propertyIds.length) errors.propertyScope = "Select at least one property.";
  if (input.delayConfiguration.amount < 0) errors.delay = "Delay cannot be negative.";
  return errors;
}
const ruleNotFound = () => new ApiError("Rule not found.", 404, {});

export const ruleApi = {
  async createAutomationRule(input: AutomationRuleInput) {
    ensureSeeded();
    const errors = ruleFieldErrors(input);
    if (Object.keys(errors).length) throw new ApiError("Complete the required rule settings.", 422, { fields: errors });
    if (input.status === "active") { const message = activationError(input); if (message) throw new ApiError(message, 422, {}); }
    const rule: AutomationRule = { ...input, executionMode: "configured", id: nextId("rule"), createdAt: now(), updatedAt: now(), createdBy: ACTOR, updatedBy: ACTOR };
    store.rules.push(rule);
    emit();
    return { rule };
  },
  async updateAutomationRule(id: string, input: AutomationRuleInput) {
    const index = store.rules.findIndex((item) => item.id === id);
    if (index < 0) throw ruleNotFound();
    if (input.status === "active") { const message = activationError(input); if (message) throw new ApiError(message, 422, {}); }
    store.rules[index] = { ...store.rules[index], ...input, executionMode: "configured", updatedAt: now(), updatedBy: ACTOR };
    emit();
    return { rule: store.rules[index] };
  },
  async setAutomationStatus(id: string, active: boolean) {
    const index = store.rules.findIndex((item) => item.id === id);
    if (index < 0) throw ruleNotFound();
    if (active) { const message = activationError(store.rules[index]); if (message) throw new ApiError(message, 422, {}); }
    store.rules[index] = { ...store.rules[index], status: active ? "active" : "inactive", updatedAt: now(), updatedBy: ACTOR };
    emit();
    return { rule: store.rules[index], notice: active ? "Rule activated for event selection. No background worker or delivery provider is connected, so it will not send messages yet." : undefined };
  },
  async duplicateAutomationRule(id: string) {
    const original = store.rules.find((item) => item.id === id);
    if (!original) throw ruleNotFound();
    const { id: _id, createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub, ...input } = original;
    const rule: AutomationRule = { ...input, name: `Copy of ${original.name}`, status: "inactive", executionMode: "configured", id: nextId("rule"), createdAt: now(), updatedAt: now(), createdBy: ACTOR, updatedBy: ACTOR };
    store.rules.push(rule);
    emit();
    return { rule };
  },
  async deleteAutomationRule(id: string) {
    if (!store.rules.some((item) => item.id === id)) throw ruleNotFound();
    store.rules = store.rules.filter((item) => item.id !== id);
    emit();
    return { ok: true };
  },
  async simulateAutomationRule(id: string, event: CommunicationEvent) {
    const rule = store.rules.find((item) => item.id === id);
    if (!rule) throw ruleNotFound();
    if (event.eventType !== rule.eventType) throw new ApiError(`This rule expects ${rule.eventType}; the supplied event was ${event.eventType}.`, 422, {});
    return { evaluation: evaluateAutomationRule(rule, event) as unknown as Record<string, unknown>, simulated: true };
  },
};
