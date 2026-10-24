// After a text goes out from the popup, file it where people look for it: the person's text thread in Messages and their activity feed.
import { supabase } from "../lib/supabase";
import { reloadTenantDb } from "../tenants/store";

export type Contact = { kind: "tenant" | "vendor"; id: string; name: string; detail: string };

/** Adds the sent text to the person's SMS conversation (creating it the first time) and returns an error message if any step failed. */
async function addToMessages(org: string, contact: Contact, body: string): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return "sign in again";
  const col = contact.kind === "tenant" ? "tenant_id" : "vendor_id";

  // reuse the open text thread with this person, if there is one
  const mine = await supabase.from("conversation_participants").select("conversation_id").eq("organization_id", org).eq(col, contact.id);
  if (mine.error) return mine.error.message;
  const ids = (mine.data ?? []).map((r: { conversation_id: string }) => r.conversation_id);
  let conversationId: string | null = null;
  if (ids.length) {
    const found = await supabase.from("conversations").select("id").eq("organization_id", org).in("id", ids).eq("primary_channel", "sms").eq("visibility", "external")
      .in("status", ["open", "in_progress", "waiting_for_reply"]).order("updated_at", { ascending: false }).limit(1);
    if (found.error) return found.error.message;
    conversationId = found.data?.[0]?.id ?? null;
  }

  if (!conversationId) {
    conversationId = crypto.randomUUID();
    const made = await supabase.from("conversations").insert({
      id: conversationId, organization_id: org, subject: `Text messages: ${contact.name}`, category: contact.kind === "vendor" ? "Vendor Coordination" : "General Inquiry",
      primary_channel: "sms", visibility: "external", status: "waiting_for_reply", related_entity_type: contact.kind, related_entity_id: contact.id, created_by: me, assigned_to: me, assigned_by: me, assigned_at: new Date().toISOString(),
    });
    if (made.error) return made.error.message;
    const people = await supabase.from("conversation_participants").insert([
      { organization_id: org, conversation_id: conversationId, participant_type: "staff", user_id: me },
      { organization_id: org, conversation_id: conversationId, participant_type: contact.kind, [col]: contact.id },
    ]);
    if (people.error) return people.error.message;
  }

  const sent = await supabase.from("messages").insert({
    organization_id: org, conversation_id: conversationId, sender_type: "staff", sender_user_id: me, body, channel: "sms", delivery_status: "sent", is_internal_note: false,
  });
  return sent.error ? sent.error.message : null;
}

async function addToActivity(org: string, contact: Contact, display: string, body: string): Promise<string | null> {
  const preview = body.length > 80 ? `${body.slice(0, 80)}…` : body;
  const { error } = await supabase.rpc("record_activity", {
    p_org: org, p_action: `${contact.kind}.text_sent`, p_category: "Communications", p_description: `Text message sent to ${display}: "${preview}"`,
    p_entity_type: contact.kind, p_entity_id: contact.id, p_label: contact.name, p_source_module: "Messaging", p_tenant_id: contact.kind === "tenant" ? contact.id : null,
  });
  return error ? error.message : null;
}

/** Files a sent text under the contact. Returns the problems found (empty when everything was saved). */
export async function fileSentText(org: string, contact: Contact, display: string, body: string): Promise<string[]> {
  const problems: string[] = [];
  const [thread, activity] = await Promise.all([
    addToMessages(org, contact, body).catch((e) => (e instanceof Error ? e.message : "failed")),
    addToActivity(org, contact, display, body).catch((e) => (e instanceof Error ? e.message : "failed")),
  ]);
  if (thread) problems.push(`Messages: ${thread}`);
  if (activity) problems.push(`Activity: ${activity}`);
  // the Tenants page keeps its own copy of the data: refresh it so the new activity shows without a page reload
  if (contact.kind === "tenant") void reloadTenantDb(true);
  return problems;
}
