import { Check, ChevronDown, Crown, Lock, UserPlus } from "lucide-react";
import { cn } from "@lf/utils/cn";
import { LogoMark } from "@lf/components/brand/Logo";
import { AppWindow, Avatar, Crumbs, StatusPill, type Tone } from "./primitives";

/* Illustrative sample team — names, emails and roles are examples. */
const MEMBERS: { name: string; email: string; initials: string; role: string; status: string; tone: Tone; avatar: number; owner?: boolean }[] = [
  { name: "Alex Morgan", email: "alex@northgate.example", initials: "AM", role: "Owner", status: "Active", tone: "green", avatar: 0, owner: true },
  { name: "Rachel Adams", email: "rachel@northgate.example", initials: "RA", role: "Administrator", status: "Active", tone: "green", avatar: 3 },
  { name: "Priya Natarajan", email: "priya@northgate.example", initials: "PN", role: "Property Manager", status: "Active", tone: "green", avatar: 2 },
  { name: "Sam Chen", email: "sam@northgate.example", initials: "SC", role: "Bookkeeper", status: "Active", tone: "green", avatar: 5 },
  { name: "Luis Ortega", email: "luis@northgate.example", initials: "LO", role: "Maintenance Staff", status: "Invited", tone: "amber", avatar: 1 },
  { name: "Owen Brooks", email: "owen@northgate.example", initials: "OB", role: "Read-Only", status: "Suspended", tone: "rose", avatar: 4 },
];

const COLS = "grid-cols-[minmax(0,1fr)_4.75rem] @md:grid-cols-[minmax(0,1fr)_8.75rem_4.75rem]";

export function TeamPreview() {
  return (
    <div>
      <AppWindow
        label="Illustrative team management screen with sample data: six members of Northgate Rentals with roles from Owner to Read-Only, access statuses including Active, Invited and Suspended, an Invite member action, and a note that every organization keeps at least one owner."
        toolbar={<Crumbs items={["Settings", "Team members"]} />}
      >
        <div className="bg-canvas p-3 @lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-ink">Team members</div>
              <div className="text-3xs text-muted">Northgate Rentals · 6 members</div>
            </div>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-forest px-2.5 text-2xs font-semibold text-white shadow-button">
              <UserPlus className="size-3.5" /> Invite member
            </span>
          </div>

          <div className="@container mt-3 overflow-hidden rounded-lg border border-line bg-white">
            <div
              className={cn(
                "grid items-center gap-x-3 border-b border-line bg-[#fafaf7] px-3 py-1.5 text-3xs font-medium uppercase tracking-[0.06em] text-muted",
                COLS,
              )}
            >
              <span>Member</span>
              <span className="hidden @md:block">Role</span>
              <span className="text-right @md:text-left">Status</span>
            </div>
            {MEMBERS.map((member) => (
              <div key={member.email} className={cn("grid items-center gap-x-3 border-b border-line/60 px-3 py-2 last:border-b-0", COLS)}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar initials={member.initials} tone={member.avatar} className="size-7 text-[10px]" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-2xs font-medium text-ink">
                      <span className="truncate">{member.name}</span>
                      {member.owner && <Crown className="size-3 shrink-0 text-amber" />}
                    </span>
                    <span className="block truncate text-3xs text-muted">
                      <span className="@md:hidden">{member.role} · </span>
                      {member.email}
                    </span>
                  </span>
                </span>
                <span className="hidden @md:block">
                  <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-3xs text-ink">
                    <span className="truncate">{member.role}</span>
                    <ChevronDown className="size-3 shrink-0 text-muted" />
                  </span>
                </span>
                <span className="flex justify-end @md:justify-start">
                  <StatusPill tone={member.tone}>{member.status}</StatusPill>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-start gap-2 text-3xs text-muted">
            <Lock className="mt-px size-3 shrink-0 text-forest" />
            The last owner can&rsquo;t be removed or demoted — every organization keeps at least one owner.
          </div>
        </div>
      </AppWindow>

      <div aria-hidden="true" className="mt-4 grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div className="rounded-card border border-line bg-white p-3.5 shadow-card">
          <div className="text-3xs font-semibold uppercase tracking-[0.06em] text-muted">Switch workspace</div>
          <ul className="mt-2 space-y-1">
            <li className="flex items-center gap-2 rounded-md bg-sage-soft px-2 py-1.5">
              <LogoMark className="size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-2xs font-semibold text-ink">Northgate Rentals</span>
                <span className="block text-3xs text-muted">Owner</span>
              </span>
              <Check className="size-3.5 shrink-0 text-forest" strokeWidth={2.5} />
            </li>
            <li className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded bg-amber-soft text-[8px] font-bold text-amber-ink">
                CR
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-2xs font-medium text-ink">Cedar Row Holdings</span>
                <span className="block text-3xs text-muted">Bookkeeper</span>
              </span>
            </li>
          </ul>
          <div className="mt-2 border-t border-line pt-2 text-3xs text-muted">One account · roles set per organization</div>
        </div>

        <div className="rounded-card border border-line bg-white p-3.5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <span className="text-3xs font-semibold uppercase tracking-[0.06em] text-muted">New invitation</span>
            <StatusPill tone="amber">Pending</StatusPill>
          </div>
          <div className="mt-2 flex h-7 items-center truncate rounded-md border border-line px-2 text-2xs text-ink">
            luis@northgate.example
          </div>
          <div className="mt-1.5 flex h-7 items-center justify-between rounded-md border border-line px-2 text-2xs text-ink">
            Maintenance Staff <ChevronDown className="size-3 text-muted" />
          </div>
          <div className="mt-2 text-3xs text-muted">Created by Alex Morgan · May 12</div>
        </div>
      </div>
    </div>
  );
}
