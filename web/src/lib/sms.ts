// Sends a text message through the `send-sms` Supabase Edge Function (Twilio). The browser never sees the Twilio credentials;
// the function checks that the signed-in user may send for the organization, records the delivery, and returns the outcome.
import { supabase } from "./supabase";
import { getActiveOrgId } from "./activeOrg";

export interface SmsRequest {
  to: string;
  body: string;
  recipientName?: string;
  tenantId?: string | null;
  templateId?: string | null;
  templateVersion?: number | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  triggerSource?: "manual" | "test";
  category?: string | null;
}
export interface SmsResult {
  ok: boolean;
  logId?: string;
  status?: string;
  providerMessageId?: string;
  error?: string;
}

export async function sendSms(request: SmsRequest): Promise<SmsResult> {
  const organizationId = getActiveOrgId();
  if (!organizationId) return { ok: false, error: "Select an organization first." };
  const { data, error } = await supabase.functions.invoke("send-sms", { body: { ...request, organizationId } });
  if (!error) return data as SmsResult;
  // a refusal from the function carries its reason in the response body
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === "function") {
    try {
      return (await context.json()) as SmsResult;
    } catch {
      /* fall through */
    }
  }
  return { ok: false, error: /not found|404/i.test(error.message) ? "SMS is not set up yet: the send-sms function has not been deployed." : error.message };
}
