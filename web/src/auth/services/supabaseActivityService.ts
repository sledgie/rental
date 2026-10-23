import { supabase, toError } from "../../lib/supabase";
import type { ActivityRow } from "./mockActivityService";
import { activityTypeFromEvent, humanizeAction } from "./supabaseMappers";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

/** Reads the organization's hash-chained audit trail. RLS requires the "view_audit_log" permission. */
export async function listOrganizationActivity(organizationId: string): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("activity_events")
    .select("id, organization_id, occurred_at, actor_id, actor_display_name, action, description, entity_type")
    .eq("organization_id", organizationId)
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (error) throw toError(error);
  return (data ?? []).map((event: any) => ({
    id: event.id,
    organizationId: event.organization_id,
    actorUserId: event.actor_id ?? "",
    action: humanizeAction(event.action),
    detail: event.description,
    type: activityTypeFromEvent(event),
    createdAt: event.occurred_at,
    actorName: event.actor_display_name,
  }));
}
