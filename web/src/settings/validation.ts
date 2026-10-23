import type { CategoryId } from "./types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function required(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

function numeric(value: unknown, min: number, max: number): boolean {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

export function validateCategory(category: CategoryId, value: any): Record<string, string> {
  const errors: Record<string, string> = {};

  if (category === "general") {
    if (!required(value.reportingPeriod)) errors.reportingPeriod = "Select a reporting period.";
    if (!numeric(value.tablePageSize, 10, 100)) errors.tablePageSize = "Page size must be between 10 and 100 rows.";
  }

  if (category === "financial") {
    ["chartOfAccounts", "incomeAccount", "operatingExpenseAccount", "repairExpenseAccount", "depositLiabilityAccount", "bankAccount"].forEach((key) => {
      if (!required(value[key])) errors[key] = "Select an account.";
    });
    if (!/^[A-Za-z0-9-]{2,12}$/.test(value.invoicePrefix ?? "")) {
      errors.invoicePrefix = "Use 2–12 letters, numbers or hyphens.";
    }
    if (!numeric(value.nextInvoiceNumber, 1, 999999)) errors.nextInvoiceNumber = "Enter a number between 1 and 999,999.";
    if (!numeric(value.rentDueDay, 1, 28)) errors.rentDueDay = "Rent due day must be between 1 and 28.";
    if (!numeric(value.gracePeriod, 0, 30)) errors.gracePeriod = "Grace period must be between 0 and 30 days.";
    if (value.lateFeeMethod === "Fixed amount" && !numeric(value.lateFeeAmount, 0, 1000)) {
      errors.lateFeeAmount = "Late fee must be between $0 and $1,000.";
    }
    if (value.lateFeeMethod === "Percentage of rent" && !numeric(value.lateFeePercent, 0, 20)) {
      errors.lateFeePercent = "Percentage must be between 0% and 20%.";
    }
    if (value.lateFeeMethod === "Percentage of rent" && !numeric(value.lateFeeCap, 0, 5000)) {
      errors.lateFeeCap = "Late-fee cap must be between $0 and $5,000.";
    }
    if (!numeric(value.taxRate, 0, 30)) errors.taxRate = "Tax rate must be between 0% and 30%.";
    if (!required(value.paymentInstructions)) errors.paymentInstructions = "Payment instructions are required.";
    if (!numeric(value.approvalThreshold, 0, 100000000)) errors.approvalThreshold = "Enter a valid approval threshold.";
  }

  if (category === "property") {
    if (!numeric(value.leaseDuration, 1, 60)) errors.leaseDuration = "Lease duration must be between 1 and 60 months.";
    if (!numeric(value.rentDueDay, 1, 28)) errors.rentDueDay = "Rent due day must be between 1 and 28.";
    if (!numeric(value.renewalNoticeDays, 0, 365)) errors.renewalNoticeDays = "Notice period must be between 0 and 365 days.";
    if (!numeric(value.renewalReminderDays, 0, 365)) errors.renewalReminderDays = "Reminder timing must be between 0 and 365 days.";
    if (!required(value.leaseTemplate)) errors.leaseTemplate = "Select a default lease template.";
    (["moveInChecklist", "moveOutChecklist"] as const).forEach((key) => {
      const items = value[key] ?? [];
      if (!items.length) errors[key] = "Add at least one checklist item.";
      else if (items.some((item: { label: string }) => !item.label.trim())) errors[key] = "Checklist items cannot be blank.";
    });
  }

  if (category === "maintenance") {
    if (!/^[A-Za-z0-9-]{2,10}$/.test(value.workOrderPrefix ?? "")) errors.workOrderPrefix = "Use 2–10 letters, numbers or hyphens.";
    if (!numeric(value.nextWorkOrderNumber, 1, 999999)) errors.nextWorkOrderNumber = "Enter a number between 1 and 999,999.";
    if (!(value.categories ?? []).some((item: { enabled?: boolean; label: string }) => item.enabled !== false && item.label.trim())) {
      errors.categories = "Keep at least one maintenance category enabled.";
    }
    (["lowResponse", "normalResponse", "highResponse", "emergencyResponse"] as const).forEach((key) => {
      if (!numeric(value[key], 0, 720)) errors[key] = "Response target must be 0–720 hours.";
    });
    if (!numeric(value.approvalThreshold, 0, 1000000)) errors.approvalThreshold = "Enter a valid spending threshold.";
    if (!required(value.emergencyInstructions)) errors.emergencyInstructions = "Emergency instructions are required.";
  }

  if (category === "projects") {
    if (!/^[A-Za-z0-9-]{2,10}$/.test(value.projectPrefix ?? "")) errors.projectPrefix = "Use 2–10 letters, numbers or hyphens.";
    if (!numeric(value.nextProjectNumber, 1, 999999)) errors.nextProjectNumber = "Enter a number between 1 and 999,999.";
    if (!(value.categories ?? []).some((item: { enabled?: boolean }) => item.enabled !== false)) errors.categories = "Keep at least one project category enabled.";
    if (!(value.statuses ?? []).some((item: { enabled?: boolean }) => item.enabled !== false)) errors.statuses = "Keep at least one project status enabled.";
    if (!numeric(value.budgetWarningThreshold, 1, 100)) errors.budgetWarningThreshold = "Warning threshold must be 1–100%.";
    if (!numeric(value.approvalThreshold, 0, 10000000)) errors.approvalThreshold = "Enter a valid approval threshold.";
  }

  if (category === "notifications") {
    if (!(value.senderName ?? "").trim()) errors.senderName = "Sender display name is required.";
    if (!emailPattern.test(value.replyTo ?? "")) errors.replyTo = "Enter a valid reply-to email address.";
    if (!value.communicationStart || !value.communicationEnd) errors.communicationEnd = "Set both communication hours.";
    else if (value.communicationStart >= value.communicationEnd) errors.communicationEnd = "End time must be later than start time.";
  }

  if (category === "tasks") {
    if (!required(value.timezone)) errors.timezone = "Select a scheduling time zone.";
    if (!value.windowStart || !value.windowEnd) errors.windowEnd = "Set both execution window times.";
    else if (value.windowStart >= value.windowEnd) errors.windowEnd = "Window end must be later than window start.";
    if (!numeric(value.retryCount, 0, 10)) errors.retryCount = "Retries must be between 0 and 10.";
    if (!numeric(value.retryIntervalMinutes, 1, 1440)) errors.retryIntervalMinutes = "Retry interval must be 1–1,440 minutes.";
    if (!numeric(value.retentionMonths, 1, 120)) errors.retentionMonths = "History retention must be 1–120 months.";
  }

  if (category === "workflow") {
    if (!numeric(value.retryCount, 0, 10)) errors.retryCount = "Retries must be between 0 and 10.";
    if (!numeric(value.retentionMonths, 1, 60)) errors.retentionMonths = "Retention must be 1–60 months.";
    if (!numeric(value.maxRunsPerDay, 1, 10000)) errors.maxRunsPerDay = "Daily limit must be 1–10,000.";
    if (!numeric(value.maxConcurrent, 1, 100)) errors.maxConcurrent = "Concurrent limit must be 1–100.";
  }

  if (category === "documents") {
    if (!(value.categories ?? []).some((item: { enabled?: boolean }) => item.enabled !== false)) errors.categories = "Keep at least one document category enabled.";
    if (!/\{(property|tenant|documentType|date)\}/.test(value.namingConvention ?? "")) {
      errors.namingConvention = "Include at least one token such as {documentType}.";
    }
    if (!(value.allowedTypes ?? []).length) errors.allowedTypes = "Allow at least one file type.";
    if (!numeric(value.maxUploadMb, 1, 100)) errors.maxUploadMb = "Upload limit must be 1–100 MB.";
    if (!numeric(value.signatureExpiryDays, 1, 365)) errors.signatureExpiryDays = "Expiration must be 1–365 days.";
    if (!numeric(value.signerReminderDays, 1, 30)) errors.signerReminderDays = "Reminder interval must be 1–30 days.";
    if (!required(value.leaseTemplate)) errors.leaseTemplate = "Select a default lease template.";
  }

  if (category === "security") {
    if (!numeric(value.invitationExpiryDays, 1, 90)) errors.invitationExpiryDays = "Invitation expiry must be 1–90 days.";
    if (!required(value.sessionTimeout)) errors.sessionTimeout = "Select a session timeout.";
    if (!required(value.documentAccess)) errors.documentAccess = "Select a document access policy.";
    if (!value.matrix) errors.matrix = "Configure at least one role permission.";
    else if (Object.values(value.matrix.Owner ?? {}).some((enabled) => !enabled)) {
      errors.matrix = "The Owner role must retain all permissions. The last Owner cannot be demoted.";
    }
  }

  if (category === "data") {
    if (!numeric(value.retentionYears, 1, 25)) errors.retentionYears = "Retention must be 1–25 years.";
    if (!numeric(value.activityRetentionMonths, 1, 120)) errors.activityRetentionMonths = "Activity retention must be 1–120 months.";
    if (!numeric(value.archiveAfterMonths, 1, 60)) errors.archiveAfterMonths = "Archive timing must be 1–60 months.";
  }

  return errors;
}

export function friendlyErrorList(errors: Record<string, string>): string[] {
  return Object.values(errors).slice(0, 3);
}
