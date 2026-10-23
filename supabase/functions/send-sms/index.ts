// Supabase Edge Function: sends one SMS through Twilio on behalf of a signed-in staff member.
//
// The Twilio credentials never reach the browser: they are read from the function's secrets
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either TWILIO_FROM_NUMBER (+15551234567) or TWILIO_MESSAGING_SERVICE_SID.
// Who may send is decided by the database: the delivery record is first written AS THE CALLER, so Row-Level Security
// (manage_communications) refuses people without that permission. A tenant who turned SMS off (or withdrew consent) is not texted.
// Every attempt is kept in communication_logs / communication_log_attempts; Twilio's delivery receipts arrive at ../twilio-status.
//
// Request (POST, JSON, Authorization: Bearer <user access token>):
//   { organizationId, to, body, recipientName?, tenantId?, templateId?, templateVersion?, relatedEntityType?, relatedEntityId?,
//     triggerSource?: "manual" | "test", category? }
// Response: { ok, logId, status, providerMessageId?, error? }
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** E.164 (+15551234567). Ten-digit North American numbers get +1. */
function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "Use POST." });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  const service = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
  if (!sid || !token || (!from && !service)) {
    return json(503, { ok: false, error: "SMS is not set up yet: the Twilio secrets are missing on the server." });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth.user) return json(401, { ok: false, error: "Sign in again to send messages." });

  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json(400, { ok: false, error: "The request was not valid JSON." }); }
  const organizationId = String(input.organizationId ?? "");
  const body = String(input.body ?? "").trim();
  const to = normalizePhone(String(input.to ?? ""));
  if (!UUID.test(organizationId)) return json(400, { ok: false, error: "Select an organization first." });
  if (!to) return json(422, { ok: false, error: "Enter a valid mobile number (for example +1 416 555 0123)." });
  if (!body) return json(422, { ok: false, error: "The message is empty." });
  if (body.length > 1600) return json(422, { ok: false, error: "The message is longer than 1,600 characters." });
  const tenantId = UUID.test(String(input.tenantId ?? "")) ? String(input.tenantId) : null;

  // a tenant who turned SMS off, or withdrew consent, is not texted
  if (tenantId) {
    const { data: pref } = await asUser.from("tenant_communication_preferences").select("sms_enabled, consent").eq("tenant_id", tenantId).maybeSingle();
    if (pref && (!pref.sms_enabled || pref.consent === "withdrawn")) {
      return json(409, { ok: false, error: "This tenant has turned off text messages, so nothing was sent." });
    }
  }

  // 1. the delivery record, written as the caller: Row-Level Security decides whether they may send
  const now = new Date().toISOString();
  const { data: log, error: logError } = await asUser.from("communication_logs").insert({
    organization_id: organizationId, template_id: UUID.test(String(input.templateId ?? "")) ? input.templateId : null,
    template_version: Number.isInteger(input.templateVersion) ? input.templateVersion : null, recipient_name: input.recipientName ?? null, recipient_phone: to,
    related_entity_type: input.relatedEntityType ?? null, related_entity_id: input.relatedEntityId ?? null, tenant_id: tenantId, rendered_subject: "",
    rendered_body: body, channel: "sms", category: input.category ?? null, status: "sending", trigger_source: input.triggerSource === "test" ? "test" : "manual",
    attempt_count: 1, queued_at: now, is_mock: false, initiated_by: auth.user.id,
  }).select("id").single();
  if (logError || !log) return json(403, { ok: false, error: "You don't have permission to send messages for this organization." });

  // 2. hand the message to Twilio
  const statusCallback = `${url}/functions/v1/twilio-status`;
  const form = new URLSearchParams({ To: to, Body: body, StatusCallback: statusCallback });
  if (service) form.set("MessagingServiceSid", service); else form.set("From", from!);
  let twilio: Record<string, unknown> = {};
  let ok = false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST", headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form,
    });
    twilio = await res.json().catch(() => ({}));
    ok = res.ok;
  } catch (error) {
    twilio = { message: error instanceof Error ? error.message : "Twilio could not be reached." };
  }

  // 3. record the outcome (service role: the caller's permission was already proven by step 1)
  const admin = createClient(url, serviceKey);
  const stamp = new Date().toISOString();
  const providerMessageId = ok ? String(twilio.sid ?? "") : null;
  const errorMessage = ok ? null : String(twilio.message ?? "Twilio refused the message.");
  await admin.from("communication_logs").update(
    ok
      ? { status: "sent", sent_at: stamp, provider_message_id: providerMessageId, provider_response: { provider: "twilio", status: twilio.status ?? null } }
      : { status: "failed", failed_at: stamp, provider_response: { provider: "twilio" }, error_details: { code: String(twilio.code ?? "TWILIO_ERROR"), message: errorMessage } },
  ).eq("id", log.id);
  await admin.from("communication_log_attempts").insert({
    organization_id: organizationId, log_id: log.id, attempted_at: stamp, status: ok ? "sent" : "failed",
    detail: ok ? `Accepted by Twilio (${twilio.status ?? "queued"}).` : errorMessage,
  });

  return ok
    ? json(200, { ok: true, logId: log.id, status: "sent", providerMessageId })
    : json(502, { ok: false, logId: log.id, status: "failed", error: errorMessage });
});
