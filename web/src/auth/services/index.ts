/**
 * Single switch between the two backends. With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set the app talks to
 * Supabase; otherwise it keeps running on the in-browser mock data. Both implementations export the same functions.
 */
import { isSupabaseConfigured } from "../../lib/supabase";
import * as mockAuth from "./mockAuthService";
import * as mockOrganization from "./mockOrganizationService";
import * as mockMembership from "./mockMembershipService";
import * as mockInvitation from "./mockInvitationService";
import * as mockActivity from "./mockActivityService";
import * as mockUser from "./mockUserService";
import * as sbAuth from "./supabaseAuthService";
import * as sbOrganization from "./supabaseOrganizationService";
import * as sbMembership from "./supabaseMembershipService";
import * as sbInvitation from "./supabaseInvitationService";
import * as sbActivity from "./supabaseActivityService";
import * as sbUser from "./supabaseUserService";

export type { MembershipWithUser, UserWorkspace } from "./mockMembershipService";
export type { InvitationWithContext } from "./mockInvitationService";
export type { ActivityRow } from "./mockActivityService";

export const usingSupabase = isSupabaseConfigured;

export const authService: typeof mockAuth = isSupabaseConfigured ? sbAuth : mockAuth;
export const organizationService: typeof mockOrganization = isSupabaseConfigured ? sbOrganization : mockOrganization;
export const membershipService: typeof mockMembership = isSupabaseConfigured ? sbMembership : mockMembership;
export const invitationService: typeof mockInvitation = isSupabaseConfigured ? sbInvitation : mockInvitation;
export const activityService: Pick<typeof mockActivity, "listOrganizationActivity"> = isSupabaseConfigured ? sbActivity : mockActivity;
export const userService: typeof mockUser = isSupabaseConfigured ? sbUser : mockUser;
