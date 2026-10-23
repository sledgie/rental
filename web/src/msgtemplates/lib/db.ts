// Supabase access for message templates (tables message_templates and message_template_properties). Content changes bump the version and keep
// a snapshot of every version (message_template_versions) in the database. Row-Level Security decides who may read or write.
import { supabase, toError } from "../../lib/supabase";
import { fetchAll } from "../../lib/financeData";
import type { AutomationRule, AutomationRuleInput, MessageTemplate, TemplateInput } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface Reference {
  properties: { id: string; name: string; address: string; manager: string; units: string[] }[];
  company: { name: string; email: string };
}

/** A problem the user can fix in a field (shown next to it), as opposed to a failure. */
export class FieldProblem extends Error {
  constructor(message: string, public fields: Record<string, string>) { super(message); }
}

const names = new Map<string, string>();

function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "23505") return new FieldProblem("A template with this name already exists.", { name: "A template with this name already exists." });
  if (error.code === "42501") return new Error("You don't have permission to change message templates.");
  return toError(error, fallback);
}

const rowOf = (t: TemplateInput) => ({
  name: t.name.trim(), description: t.description || null, category: t.category, channel: t.channel, subject: t.subject, body: t.body, plain_text_body: t.plainTextBody,
  sender_configuration: t.senderConfiguration, recipient_configuration: t.recipientConfiguration, in_app_configuration: t.inAppConfiguration, available_variables: t.availableVariables,
  required_variables: t.requiredVariables, property_scope: t.propertyScope.type, event_context: t.eventContext, status: t.status, language: t.language, internal_notes: t.internalNotes || null,
  legal_notice: t.legalNotice, jurisdiction: t.jurisdiction || null,
});

const toTemplate = (r: any, propertyIds: string[]): MessageTemplate => ({
  id: r.id, name: r.name, description: r.description ?? "", category: r.category, channel: r.channel, subject: r.subject ?? "", body: r.body ?? "", plainTextBody: r.plain_text_body ?? "",
  senderConfiguration: { fromName: "", fromEmail: "", replyTo: "", cc: "", bcc: "", signature: "", ...(r.sender_configuration ?? {}) },
  recipientConfiguration: { to: "", recipientRule: "", ...(r.recipient_configuration ?? {}) },
  inAppConfiguration: { title: "", actionLabel: "", destinationRoute: "", ...(r.in_app_configuration ?? {}) }, attachments: [],
  availableVariables: r.available_variables ?? [], requiredVariables: r.required_variables ?? [], propertyScope: { type: r.property_scope, propertyIds }, eventContext: r.event_context,
  status: r.status, language: r.language, internalNotes: r.internal_notes ?? "", legalNotice: r.legal_notice, jurisdiction: r.jurisdiction ?? "", version: r.version,
  createdAt: r.created_at, updatedAt: r.updated_at, createdBy: names.get(r.created_by) ?? "Team member", updatedBy: names.get(r.updated_by) ?? "Team member",
});

export async function loadReference(orgId: string): Promise<Reference> {
  const [properties, units, org] = await Promise.all([
    fetchAll("properties", "id, name, address_line1, city, state_province, property_manager_id", orgId, "name"),
    fetchAll("units", "property_id, unit_number", orgId, "unit_number"),
    supabase.from("organizations").select("name, email").eq("id", orgId).maybeSingle(),
  ]);
  const { data: auth } = await supabase.auth.getUser();
  const managerIds = [...new Set(properties.map((p: any) => p.property_manager_id).filter(Boolean))] as string[];
  const managers = new Map<string, string>();
  if (managerIds.length) {
    const p = await supabase.from("profiles").select("id, full_name, email").in("id", managerIds);
    for (const row of p.data ?? []) managers.set(row.id, row.full_name || row.email);
  }
  return {
    properties: properties.map((p: any) => ({
      id: p.id, name: p.name, address: [p.address_line1, p.city, p.state_province].filter(Boolean).join(", "), manager: managers.get(p.property_manager_id) ?? "Unassigned",
      units: units.filter((u: any) => u.property_id === p.id).map((u: any) => u.unit_number),
    })),
    company: { name: org.data?.name ?? "", email: org.data?.email || auth.user?.email || "" },
  };
}

export async function loadTemplates(orgId: string): Promise<MessageTemplate[]> {
  const [templates, links, profiles] = await Promise.all([
    fetchAll("message_templates", "*", orgId, "updated_at"),
    fetchAll("message_template_properties", "template_id, property_id", orgId, "template_id"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  names.clear();
  for (const p of profiles.data ?? []) names.set(p.id, p.full_name || p.email);
  return templates.map((t: any) => toTemplate(t, links.filter((l: any) => l.template_id === t.id).map((l: any) => l.property_id)));
}

async function setProperties(orgId: string, templateId: string, input: TemplateInput) {
  const wanted = input.propertyScope.type === "properties" ? [...new Set(input.propertyScope.propertyIds)] : [];
  const del = await supabase.from("message_template_properties").delete().eq("template_id", templateId);
  if (del.error) throw friendly(del.error, "Unable to save the template's properties.");
  if (wanted.length) {
    const ins = await supabase.from("message_template_properties").insert(wanted.map((property_id) => ({ organization_id: orgId, template_id: templateId, property_id })));
    if (ins.error) throw friendly(ins.error, "Unable to save the template's properties.");
  }
}

export async function insertTemplates(orgId: string, inputs: TemplateInput[]): Promise<MessageTemplate[]> {
  const { data: auth } = await supabase.auth.getUser();
  const out: MessageTemplate[] = [];
  for (const input of inputs) {
    const res = await supabase.from("message_templates").insert({ ...rowOf(input), organization_id: orgId, created_by: auth.user?.id ?? null }).select("*").single();
    if (res.error) throw friendly(res.error, "Unable to save the template.");
    await setProperties(orgId, res.data.id, input);
    out.push(toTemplate(res.data, input.propertyScope.type === "properties" ? input.propertyScope.propertyIds : []));
  }
  return out;
}

export async function updateTemplate(orgId: string, id: string, input: TemplateInput): Promise<MessageTemplate> {
  const res = await supabase.from("message_templates").update(rowOf(input)).eq("id", id).select("*");
  if (res.error) throw friendly(res.error, "Unable to save the template.");
  if (!res.data?.length) throw new Error("You don't have permission to change message templates.");
  await setProperties(orgId, id, input);
  return toTemplate(res.data[0], input.propertyScope.type === "properties" ? input.propertyScope.propertyIds : []);
}

export async function setStatus(id: string, status: "active" | "inactive"): Promise<void> {
  const res = await supabase.from("message_templates").update({ status }).eq("id", id).select("id");
  if (res.error) throw friendly(res.error, "Unable to change the template.");
  if (!res.data?.length) throw new Error("You don't have permission to change message templates.");
}

export async function removeTemplate(id: string): Promise<void> {
  const res = await supabase.from("message_templates").delete().eq("id", id).select("id");
  if (res.error) throw friendly(res.error, "Unable to delete the template.");
  if (!res.data?.length) throw new Error("You don't have permission to delete message templates.");
}

// ------------------------------------------------------------------ automation rules
const ruleRow = (r: AutomationRuleInput) => ({
  name: r.name.trim(), description: r.description || null, event_type: r.eventType, template_id: r.templateId, channel: r.channel, recipient_type: r.recipientRules.type,
  custom_recipients: r.recipientRules.customRecipients || null, property_scope: r.propertyScope.type, delay_amount: Math.max(0, Math.round(r.delayConfiguration.amount || 0)), delay_unit: r.delayConfiguration.unit,
  business_days_only: r.delayConfiguration.businessDaysOnly, send_time: r.delayConfiguration.sendTime || null, cancel_on: r.delayConfiguration.cancelOn || null, timezone: r.timezone,
  duplicate_prevention_key: r.duplicatePreventionKey, dedupe_enabled: r.duplicatePrevention.enabled, dedupe_window_hours: r.duplicatePrevention.windowHours,
  retry_max_attempts: r.retryConfiguration.maxAttempts, retry_backoff_minutes: r.retryConfiguration.backoffMinutes, status: r.status, execution_mode: r.executionMode,
});

const toRule = (r: any, conditions: any[], propertyIds: string[]): AutomationRule => ({
  id: r.id, name: r.name, description: r.description ?? "", eventType: r.event_type,
  conditions: conditions.map((c) => ({ id: c.id, field: c.field, operator: c.operator, value: c.value ?? "" })), templateId: r.template_id ?? null, channel: r.channel,
  recipientRules: { type: r.recipient_type, customRecipients: r.custom_recipients ?? "" }, propertyScope: { type: r.property_scope, propertyIds },
  delayConfiguration: { amount: r.delay_amount, unit: r.delay_unit, businessDaysOnly: r.business_days_only, sendTime: r.send_time ? String(r.send_time).slice(0, 5) : "09:00", cancelOn: r.cancel_on ?? "" },
  timezone: r.timezone, duplicatePreventionKey: r.duplicate_prevention_key, duplicatePrevention: { enabled: r.dedupe_enabled, windowHours: r.dedupe_window_hours },
  retryConfiguration: { maxAttempts: r.retry_max_attempts, backoffMinutes: r.retry_backoff_minutes }, status: r.status, executionMode: r.execution_mode,
  createdAt: r.created_at, updatedAt: r.updated_at, createdBy: names.get(r.created_by) ?? "Team member", updatedBy: names.get(r.updated_by) ?? "Team member",
});

export async function loadRules(orgId: string): Promise<AutomationRule[]> {
  const [rules, conditions, links] = await Promise.all([
    fetchAll("automation_rules", "*", orgId, "updated_at"),
    fetchAll("automation_rule_conditions", "id, rule_id, position, field, operator, value", orgId, "position"),
    fetchAll("automation_rule_properties", "rule_id, property_id", orgId, "rule_id"),
  ]);
  return rules.map((r: any) => toRule(r, conditions.filter((c: any) => c.rule_id === r.id), links.filter((l: any) => l.rule_id === r.id).map((l: any) => l.property_id)));
}

async function setRuleDetails(orgId: string, ruleId: string, input: AutomationRuleInput) {
  const props = input.propertyScope.type === "properties" ? [...new Set(input.propertyScope.propertyIds)] : [];
  const delProps = await supabase.from("automation_rule_properties").delete().eq("rule_id", ruleId);
  if (delProps.error) throw ruleError(delProps.error, "Unable to save the rule's properties.");
  if (props.length) {
    const ins = await supabase.from("automation_rule_properties").insert(props.map((property_id) => ({ organization_id: orgId, rule_id: ruleId, property_id })));
    if (ins.error) throw ruleError(ins.error, "Unable to save the rule's properties.");
  }
  const delCond = await supabase.from("automation_rule_conditions").delete().eq("rule_id", ruleId);
  if (delCond.error) throw ruleError(delCond.error, "Unable to save the rule's conditions.");
  if (input.conditions.length) {
    const ins = await supabase.from("automation_rule_conditions").insert(input.conditions.map((c, position) => ({ organization_id: orgId, rule_id: ruleId, position, field: c.field, operator: c.operator, value: c.value || null })));
    if (ins.error) throw ruleError(ins.error, "Unable to save the rule's conditions.");
  }
}

function ruleError(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "23514") return new Error(error.message || fallback); // e.g. an active rule needs an active template on the same channel
  if (error.code === "42501") return new Error("You don't have permission to change automation rules.");
  return toError(error, fallback);
}

export async function insertRule(orgId: string, input: AutomationRuleInput): Promise<AutomationRule> {
  const { data: auth } = await supabase.auth.getUser();
  const res = await supabase.from("automation_rules").insert({ ...ruleRow(input), organization_id: orgId, created_by: auth.user?.id ?? null }).select("*").single();
  if (res.error) throw ruleError(res.error, "Unable to save the rule.");
  try {
    await setRuleDetails(orgId, res.data.id, input);
  } catch (error) {
    await supabase.from("automation_rules").delete().eq("id", res.data.id); // do not leave a half-saved rule behind
    throw error;
  }
  return toRule(res.data, input.conditions, input.propertyScope.type === "properties" ? input.propertyScope.propertyIds : []);
}

export async function updateRule(orgId: string, id: string, input: AutomationRuleInput): Promise<AutomationRule> {
  const res = await supabase.from("automation_rules").update(ruleRow(input)).eq("id", id).select("*");
  if (res.error) throw ruleError(res.error, "Unable to save the rule.");
  if (!res.data?.length) throw new Error("You don't have permission to change automation rules.");
  await setRuleDetails(orgId, id, input);
  return toRule(res.data[0], input.conditions, input.propertyScope.type === "properties" ? input.propertyScope.propertyIds : []);
}

export async function setRuleStatus(id: string, status: "active" | "inactive"): Promise<void> {
  const res = await supabase.from("automation_rules").update({ status }).eq("id", id).select("id");
  if (res.error) throw ruleError(res.error, "Unable to change the rule.");
  if (!res.data?.length) throw new Error("You don't have permission to change automation rules.");
}

export async function removeRule(id: string): Promise<void> {
  const res = await supabase.from("automation_rules").delete().eq("id", id).select("id");
  if (res.error) throw ruleError(res.error, "Unable to delete the rule.");
  if (!res.data?.length) throw new Error("You don't have permission to delete automation rules.");
}
