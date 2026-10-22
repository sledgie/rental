export type Channel = "email" | "sms" | "in_app";
export type TemplateStatus = "active" | "draft" | "inactive";
export type LogStatus = "draft" | "queued" | "sending" | "sent" | "delivered" | "opened" | "bounced" | "failed" | "cancelled";

export type PropertyScope = { type: "company" | "properties"; propertyIds: string[] };
export type SenderConfiguration = {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  cc: string;
  bcc: string;
  signature: string;
};
export type RecipientConfiguration = { to: string; recipientRule: string };
export type InAppConfiguration = { title: string; actionLabel: string; destinationRoute: string };
export type AttachmentMeta = { id: string; name: string; size: number; type: string };

export type MessageTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  channel: Channel;
  subject: string;
  body: string;
  plainTextBody: string;
  senderConfiguration: SenderConfiguration;
  recipientConfiguration: RecipientConfiguration;
  inAppConfiguration: InAppConfiguration;
  attachments: AttachmentMeta[];
  availableVariables: string[];
  requiredVariables: string[];
  propertyScope: PropertyScope;
  eventContext: string;
  status: TemplateStatus;
  language: string;
  internalNotes: string;
  legalNotice: boolean;
  jurisdiction: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  automationIds?: string[];
  automationNames?: string[];
};

export type TemplateInput = Omit<MessageTemplate, "id" | "version" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "automationIds" | "automationNames">;

export type RuleCondition = { id: string; field: string; operator: string; value: string };
export type AutomationRule = {
  id: string;
  name: string;
  description: string;
  eventType: string;
  conditions: RuleCondition[];
  templateId: string | null;
  channel: Channel;
  recipientRules: { type: string; customRecipients: string; entityType?: string; entityId?: string };
  propertyScope: PropertyScope;
  delayConfiguration: { amount: number; unit: "minutes" | "hours" | "days"; businessDaysOnly: boolean; sendTime: string; cancelOn: string };
  timezone: string;
  duplicatePreventionKey: string;
  duplicatePrevention: { enabled: boolean; windowHours: number };
  retryConfiguration: { maxAttempts: number; backoffMinutes: number };
  status: "active" | "inactive";
  executionMode: "configured" | "simulated" | "live";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};
export type AutomationRuleInput = Omit<AutomationRule, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">;

export type CommunicationLog = {
  id: string;
  templateId: string | null;
  templateVersion: number;
  automationRuleId: string | null;
  recipient: { name: string; email: string; phone: string };
  relatedEntityType: string;
  relatedEntityId: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  tenantId: string;
  tenantName: string;
  renderedSubject: string;
  renderedBody: string;
  channel: Channel;
  category: string;
  status: LogStatus;
  triggerSource: string;
  attemptCount: number;
  providerMessageId: string | null;
  providerResponse: Record<string, unknown> | null;
  timestamps: { createdAt?: string; queuedAt?: string; sentAt?: string; deliveredAt?: string; openedAt?: string; failedAt?: string; cancelledAt?: string };
  attempts: { at: string; status: string; detail: string }[];
  errorDetails: { code?: string; message?: string; resolution?: string } | null;
  isMock: boolean;
  initiatedBy: string;
  createdAt: string;
  updatedAt: string;
  templateName?: string | null;
  automationName?: string | null;
};

export type TenantPreference = { id: string; name: string; property: string; email: boolean; sms: boolean; inApp: boolean; consent: "granted" | "withdrawn" | "not_required"; marketingOptOut: boolean };
export type PropertyOverride = { propertyId: string; enabled: boolean; senderEmail: string; quietStart: string; quietEnd: string; timezone: string };
export type NotificationConfiguration = {
  companyName: string;
  defaultSenderName: string;
  defaultSenderEmail: string;
  senderIdentities: { id: string; name: string; email: string; verified: boolean }[];
  replyTo: string;
  defaultSignature: string;
  allowedChannels: { email: boolean; sms: boolean; inApp: boolean };
  quietHours: { enabled: boolean; start: string; end: string };
  timezone: string;
  reminderIntervals: { upcomingDays: number; overdueDays: number; leaseExpiryDays: number };
  retryPolicy: { maxAttempts: number; backoffMinutes: number };
  dailySendingLimit: number;
  testRecipients: string;
  requireBulkConfirmation: boolean;
  maxBulkRecipients: number;
  consentRequired: boolean;
  unsubscribeFooter: boolean;
  propertyOverrides: PropertyOverride[];
  tenantPreferences: TenantPreference[];
};

export type PreviewResult = {
  renderedSubject: string;
  renderedBody: string;
  plainTextBody: string;
  inAppTitle: string;
  usedVariables: string[];
  unknownVariables: string[];
  unavailableVariables: string[];
  missingVariables: string[];
  missingRequiredVariables: string[];
  sms: { characters: number; encoding: "GSM-7" | "UCS-2"; segments: number; segmentSize: number };
  sampleLabel: string;
};

export type CommunicationEvent = {
  eventType: string;
  occurredAt: string;
  propertyId: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
};
