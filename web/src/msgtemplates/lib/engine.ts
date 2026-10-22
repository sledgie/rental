import { EVENT_MAP } from "./catalog";
import type { MessageTemplate, PreviewResult, TemplateInput } from "./types";
import { SAMPLE_SCENARIOS } from "./sample-data";
import { ALL_VARIABLE_NAMES, VARIABLE_MAP } from "./variables";

export const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractPlaceholders(...parts: string[]): string[] {
  const found = new Set<string>();
  for (const part of parts) {
    for (const match of part.matchAll(PLACEHOLDER_PATTERN)) found.add(match[1]);
  }
  return [...found];
}

export function templateContent(template: Pick<MessageTemplate, "channel" | "subject" | "body" | "plainTextBody" | "senderConfiguration" | "inAppConfiguration">) {
  const signature = template.channel === "email" ? template.senderConfiguration?.signature ?? "" : "";
  return {
    subject: template.channel === "email" ? template.subject : template.inAppConfiguration?.title ?? "",
    body: `${template.body ?? ""}${signature ? `<div class="email-signature">${signature}</div>` : ""}`,
    plainText: template.plainTextBody ?? "",
    inAppTitle: template.inAppConfiguration?.title ?? "",
  };
}

export function getTemplateVariables(template: Parameters<typeof templateContent>[0]) {
  const content = templateContent(template);
  return extractPlaceholders(content.subject, content.body, content.plainText, content.inAppTitle);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderMergeFields(source: string, data: Record<string, unknown>, missingMarker = "") {
  const missing = new Set<string>();
  const unknown = new Set<string>();
  const rendered = source.replace(PLACEHOLDER_PATTERN, (_token, name: string) => {
    if (!VARIABLE_MAP[name]) {
      unknown.add(name);
      return `[Unknown variable: ${name}]`;
    }
    const value = data[name];
    if (value === undefined || value === null || value === "") {
      missing.add(name);
      return missingMarker;
    }
    return escapeHtml(value);
  });
  return { rendered, missing: [...missing], unknown: [...unknown] };
}

export function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€";

export function analyzeSms(value: string) {
  let encoding: "GSM-7" | "UCS-2" = "GSM-7";
  let units = 0;
  for (const character of value) {
    if (GSM_BASIC.includes(character)) units += 1;
    else if (GSM_EXTENDED.includes(character)) units += 2;
    else {
      encoding = "UCS-2";
      units = [...value].length;
      break;
    }
  }
  const singleLimit = encoding === "GSM-7" ? 160 : 70;
  const multipartLimit = encoding === "GSM-7" ? 153 : 67;
  const segments = units === 0 ? 0 : units <= singleLimit ? 1 : Math.ceil(units / multipartLimit);
  return { characters: [...value].length, encoding, segments, segmentSize: segments > 1 ? multipartLimit : singleLimit, units };
}

export function availableVariablesForEvent(eventType: string) {
  const event = EVENT_MAP[eventType] ?? EVENT_MAP.manual;
  const contexts: readonly string[] = event.contexts;
  return ALL_VARIABLE_NAMES.filter((name) => contexts.includes(VARIABLE_MAP[name].group.toLowerCase()));
}

export function validateMergeFields(template: Parameters<typeof templateContent>[0] & { eventContext: string; requiredVariables?: string[] }, data: Record<string, unknown>) {
  const content = templateContent(template);
  const usedVariables = extractPlaceholders(content.subject, content.body, content.plainText, content.inAppTitle);
  const unknownVariables = usedVariables.filter((name) => !VARIABLE_MAP[name]);
  const allowed = availableVariablesForEvent(template.eventContext);
  const unavailableVariables = usedVariables.filter((name) => VARIABLE_MAP[name] && !allowed.includes(name));
  const missingVariables = usedVariables.filter((name) => VARIABLE_MAP[name] && (data[name] === undefined || data[name] === null || data[name] === ""));
  const required = template.requiredVariables ?? [];
  const missingRequiredVariables = required.filter((name) => missingVariables.includes(name));
  return { usedVariables, unknownVariables, unavailableVariables, missingVariables, missingRequiredVariables };
}

export function renderPreview(template: MessageTemplate | TemplateInput, scenarioId = "rent", sanitizedBody?: string): PreviewResult {
  const scenario = SAMPLE_SCENARIOS.find((item) => item.id === scenarioId) ?? SAMPLE_SCENARIOS[0];
  const content = templateContent(template);
  const validation = validateMergeFields(template, scenario.data);
  const subject = renderMergeFields(content.subject, scenario.data, "—").rendered;
  const rawBody = renderMergeFields(content.body, scenario.data, "—").rendered;
  const plainSource = content.plainText || htmlToPlainText(content.body);
  const plainTextBody = htmlToPlainText(renderMergeFields(plainSource, scenario.data, "").rendered);
  const inAppTitle = renderMergeFields(content.inAppTitle, scenario.data, "—").rendered;
  return {
    renderedSubject: htmlToPlainText(subject),
    renderedBody: sanitizedBody ?? rawBody,
    plainTextBody,
    inAppTitle: htmlToPlainText(inAppTitle),
    ...validation,
    sms: analyzeSms(plainTextBody),
    sampleLabel: scenario.label,
  };
}

export function relatedEntityForEvent(eventType: string, data: Record<string, string>) {
  const prefix = eventType.split(".")[0];
  if (["invoice", "balance"].includes(prefix)) return { type: "invoice", id: data.invoice_number };
  if (prefix === "payment") return { type: "payment", id: data.payment_reference };
  if (["lease", "tenancy", "signature"].includes(prefix)) return { type: "lease", id: data.lease_document_name };
  if (prefix === "maintenance") return { type: "maintenance", id: data.work_order_number || data.maintenance_request_number };
  if (prefix === "project") return { type: "project", id: data.project_number };
  if (prefix === "document") return { type: "document", id: data.document_name };
  if (["user", "account"].includes(prefix)) return { type: "account", id: data.tenant_email };
  if (prefix === "scheduled") return { type: "summary", id: `${data.current_date} · ${data.property_name}` };
  return { type: prefix || "record", id: data.unit_number || data.property_name };
}

export function validateTemplateInput(template: TemplateInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!template.name.trim()) errors.name = "Enter a descriptive template name.";
  if (!template.category) errors.category = "Select a category.";
  if (!template.eventContext) errors.eventContext = "Select a data context.";
  if (template.propertyScope.type === "properties" && template.propertyScope.propertyIds.length === 0) errors.propertyScope = "Select at least one property or choose company-wide availability.";
  if (template.channel === "email") {
    if (!template.subject.trim()) errors.subject = "Email templates require a subject.";
    if (!template.body.trim() || !htmlToPlainText(template.body)) errors.body = "Add content to the email body.";
    if (!template.senderConfiguration.fromName.trim()) errors.fromName = "Enter a sender name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(template.senderConfiguration.fromEmail)) errors.fromEmail = "Select a valid configured sender identity.";
    if (template.senderConfiguration.replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(template.senderConfiguration.replyTo)) errors.replyTo = "Enter a valid reply-to address.";
    const validEmailList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean).every((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
    if (template.senderConfiguration.cc && !validEmailList(template.senderConfiguration.cc)) errors.cc = "Use comma-separated, valid email addresses.";
    if (template.senderConfiguration.bcc && !validEmailList(template.senderConfiguration.bcc)) errors.bcc = "Use comma-separated, valid email addresses.";
    if (template.recipientConfiguration.recipientRule === "custom" && !validEmailList(template.recipientConfiguration.to)) errors.recipientTo = "Enter one or more valid custom recipient emails.";
    if (template.legalNotice && !template.jurisdiction) errors.jurisdiction = "Select the jurisdiction reviewed for this legal notice.";
  }
  if (template.channel === "sms") {
    if (!template.body.trim()) errors.body = "Add an SMS message.";
    const analysis = analyzeSms(template.body);
    if (analysis.units > 1600) errors.body = "SMS content exceeds the 1,600-unit safety limit.";
  }
  if (template.channel === "in_app") {
    if (!template.inAppConfiguration.title.trim()) errors.inAppTitle = "Add a notification title.";
    if (template.inAppConfiguration.title.length > 100) errors.inAppTitle = "Keep the notification title under 100 characters.";
    if (!template.body.trim()) errors.body = "Add a notification message.";
    if (template.body.length > 500) errors.body = "Keep in-app messages under 500 characters.";
    if (template.inAppConfiguration.destinationRoute && !template.inAppConfiguration.destinationRoute.startsWith("/")) errors.destinationRoute = "Use an application-relative route beginning with /.";
  }
  return errors;
}
