import { DEFAULT_NOTIFICATION_CONFIGURATION } from "./sample-data";
import { DEFAULT_SENDER } from "./catalog";
import type { AutomationRuleInput, TemplateInput } from "./types";

export function emptyTemplate(senderSignature = DEFAULT_NOTIFICATION_CONFIGURATION.defaultSignature): TemplateInput {
  return {
    name: "", description: "", category: "rent_payments", channel: "email", subject: "", body: "<p>Hello {{tenant_first_name}},</p><p></p>", plainTextBody: "",
    senderConfiguration: { ...DEFAULT_SENDER, signature: senderSignature },
    recipientConfiguration: { to: "{{tenant_email}}", recipientRule: "primary_tenant" },
    inAppConfiguration: { title: "", actionLabel: "View details", destinationRoute: "" }, attachments: [], availableVariables: [], requiredVariables: [],
    propertyScope: { type: "company", propertyIds: [] }, eventContext: "manual", status: "draft", language: "en-CA", internalNotes: "", legalNotice: false, jurisdiction: "",
  };
}

export function emptyRule(templateId: string | null = null): AutomationRuleInput {
  return {
    name: "", description: "", eventType: "invoice.created", conditions: [], templateId, channel: "email",
    recipientRules: { type: "primary_tenant", customRecipients: "" }, propertyScope: { type: "company", propertyIds: [] },
    delayConfiguration: { amount: 0, unit: "minutes", businessDaysOnly: false, sendTime: "09:00", cancelOn: "" },
    timezone: "America/Toronto", duplicatePreventionKey: "{{invoice_number}}", duplicatePrevention: { enabled: true, windowHours: 24 },
    retryConfiguration: { maxAttempts: 3, backoffMinutes: 30 }, status: "inactive", executionMode: "configured",
  };
}
