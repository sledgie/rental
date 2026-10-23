// Supabase Edge Function: receives Twilio's delivery receipts (StatusCallback) and updates the matching communication log.
// Deployed WITHOUT JWT verification (Twilio cannot sign in); instead every request must carry a valid X-Twilio-Signature, computed
// with TWILIO_AUTH_TOKEN over this function's URL and the posted fields. Unsigned or wrongly signed requests are rejected.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const STATUS: Record<string, { status: string; at: string } | undefined> = {
  queued: undefined, accepted: undefined, sending: undefined,
  sent: { status: "sent", at: "sent_at" },
  delivered: { status: "delivered", at: "delivered_at" },
  read: { status: "opened", at: "opened_at" },
  undelivered: { status: "failed", at: "failed_at" },
  failed: { status: "failed", at: "failed_at" },
  canceled: { status: "cancelled", at: "cancelled_at" },
};

/** Twilio's request signature: base64(HMAC-SHA1(authToken, url + sorted key/value pairs)). */
async function validSignature(token: string, url: string, params: URLSearchParams, signature: string): Promise<boolean> {
  const data = url + [...params.keys()].sort().map((k) => k + (params.get(k) ?? "")).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  const expected = btoa(String.fromCharCode(...mac));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Use POST.", { status: 405 });
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!token) return new Response("Not configured.", { status: 503 });

  const params = new URLSearchParams(await req.text());
  const publicUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-status`;
  if (!(await validSignature(token, publicUrl, params, req.headers.get("X-Twilio-Signature") ?? ""))) {
    return new Response("Invalid signature.", { status: 403 });
  }

  const sid = params.get("MessageSid") ?? "";
  const mapped = STATUS[(params.get("MessageStatus") ?? "").toLowerCase()];
  if (!sid || !mapped) return new Response("ok"); // an in-between state: nothing to record

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: log } = await admin.from("communication_logs").select("id, organization_id").eq("provider_message_id", sid).maybeSingle();
  if (!log) return new Response("ok");
  const errorCode = params.get("ErrorCode");
  await admin.from("communication_logs").update({
    status: mapped.status, [mapped.at]: new Date().toISOString(),
    ...(mapped.status === "failed" ? { error_details: { code: errorCode ?? "UNDELIVERED", message: params.get("ErrorMessage") ?? "The carrier did not deliver the message." } } : {}),
  }).eq("id", log.id);
  await admin.from("communication_log_attempts").insert({
    organization_id: log.organization_id, log_id: log.id, status: mapped.status,
    detail: `Twilio reported ${params.get("MessageStatus")}${errorCode ? ` (error ${errorCode})` : ""}.`,
  });
  return new Response("ok");
});
