import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Download,
  History,
  Mail,
  Search,
  ShieldCheck,
  UserCog,
  Wallet,
  Wrench,
} from "lucide-react";
import { Alert, Avatar, Badge, Button, Card, EmptyState, Skeleton } from "../../components/ui";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useToast } from "../../contexts/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDateTime, relativeTime } from "../../lib/format";
import { activityService, type ActivityRow } from "../../services";
import type { ActivityType } from "../../lib/types";
import { SettingsHeader } from "./SettingsChrome";
import { cn } from "../../utils/cn";

const typeMeta: Record<ActivityType, { label: string; icon: typeof History; tone: string; badge: string }> = {
  organization: { label: "Organization", icon: Building2, tone: "bg-u-accent-soft text-u-accent ring-u-accent/30", badge: "bg-u-accent-soft text-u-accent ring-u-accent/30" },
  member: { label: "Members", icon: UserCog, tone: "bg-u-violet/15 text-u-violet ring-u-violet/30", badge: "bg-u-violet/15 text-u-violet ring-u-violet/30" },
  invitation: { label: "Invitations", icon: Mail, tone: "bg-u-blue-soft text-u-blue ring-u-blue/30", badge: "bg-u-blue-soft text-u-blue ring-u-blue/30" },
  billing: { label: "Billing", icon: Wallet, tone: "bg-u-warn-soft text-u-warn ring-u-warn/30", badge: "bg-u-warn-soft text-u-warn ring-u-warn/30" },
  property: { label: "Properties", icon: Wrench, tone: "bg-u-ok-soft text-u-ok ring-u-ok/30", badge: "bg-u-ok-soft text-u-ok ring-u-ok/30" },
  auth: { label: "Authentication", icon: ShieldCheck, tone: "bg-u-s3 text-u-muted ring-u-line", badge: "bg-u-s3 text-u-ink2 ring-u-line" },
};

type Filter = "all" | ActivityType;

export default function ActivityLogsPage() {
  useDocumentTitle("Activity logs");
  const { activeOrganization, revision } = useOrganization();
  const { toast } = useToast();
  const [entries, setEntries] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const organizationId = activeOrganization?.id;

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setError(null);
    activityService.listOrganizationActivity(organizationId)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load activity.");
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, revision]);

  const counts = useMemo(() => {
    const list = entries ?? [];
    return {
      total: list.length,
      members: list.filter((entry) => entry.type === "member").length,
      invitations: list.filter((entry) => entry.type === "invitation").length,
      last: list[0]?.createdAt,
    };
  }, [entries]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesType = filter === "all" || entry.type === filter;
      const matchesQuery =
        !query ||
        entry.action.toLowerCase().includes(query) ||
        entry.detail.toLowerCase().includes(query) ||
        entry.actorName.toLowerCase().includes(query);
      return matchesType && matchesQuery;
    });
  }, [entries, filter, search]);

  function exportLog() {
    if (!filtered.length || !activeOrganization) return;
    const rows = [
      ["Timestamp", "Actor", "Action", "Detail", "Type"],
      ...filtered.map((entry) => [
        new Date(entry.createdAt).toISOString(),
        entry.actorName,
        entry.action,
        entry.detail.replace(/,/g, ";"),
        entry.type,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeOrganization.name.toLowerCase().replace(/\s+/g, "-")}-activity.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ title: "Activity log exported", description: `${filtered.length} mock entries downloaded as CSV.`, variant: "success" });
  }

  return (
    <div className="space-y-5">
      <SettingsHeader
        title="Activity logs"
        description="An organization-scoped audit trail of membership, invitation, and workspace changes made in this prototype."
        actions={<Button size="sm" variant="secondary" icon={Download} onClick={exportLog} disabled={!filtered.length}>Export log</Button>}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Total events", value: counts.total },
          { label: "Member events", value: counts.members },
          { label: "Invitation events", value: counts.invitations },
          { label: "Last activity", value: counts.last ? relativeTime(counts.last) : "—" },
        ].map((stat) => (
          <Card key={stat.label} className="p-3">
            <p className="text-[15px] font-semibold tracking-[-0.02em] text-u-ink">{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-u-muted">{stat.label}</p>
          </Card>
        ))}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-u-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-[280px]">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-u-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activity…"
              aria-label="Search activity"
              className="h-8.5 w-full rounded-md border border-u-line bg-u-s2/70 pr-3 pl-8 text-[11.5px] text-u-ink2 transition placeholder:text-u-muted focus:border-u-accent/60 focus:bg-u-card focus:ring-[3px] focus:ring-u-accent/10 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {(["all", "member", "invitation", "organization", "billing", "property"] as Filter[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilter(type)}
                className={cn(
                  "rounded px-2 py-1 text-[10px] font-medium capitalize transition",
                  filter === type ? "bg-u-ink2 text-u-onaccent" : "text-u-muted hover:bg-u-s3"
                )}
              >
                {type === "all" ? "All" : type}
              </button>
            ))}
          </div>
        </div>

        {!entries ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-52" />
                  <Skeleton className="h-2.5 w-72" />
                </div>
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={History}
            title={entries.length === 0 ? "No activity yet" : "No matching activity"}
            description={
              entries.length === 0
                ? "Actions like inviting members, changing roles, and updating settings will appear here."
                : "Try clearing the search or category filter."
            }
            action={
              entries.length > 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-u-line">
            {filtered.map((entry) => {
              const meta = typeMeta[entry.type];
              return (
                <div key={entry.id} className="group flex items-start gap-3 px-4 py-3 transition hover:bg-u-s2/50">
                  <div className="relative">
                    <Avatar name={entry.actorName} size="sm" />
                    <span className={cn("absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full ring-2 ring-white", meta.tone)}>
                      <meta.icon className="size-2.5" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-[11.5px] font-medium text-u-ink">{entry.action}</p>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[8.5px] font-medium ring-1", meta.badge)}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-u-muted">{entry.detail}</p>
                    <p className="mt-0.5 text-[9px] text-u-muted">{entry.actorName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[9.5px] font-medium text-u-muted">{relativeTime(entry.createdAt)}</p>
                    <p className="mt-0.5 text-[8.5px] text-u-muted">{formatDateTime(entry.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-u-line bg-u-s2/50 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[9.5px] text-u-muted">
            <ShieldCheck className="size-3" />
            Audit records are isolated to {activeOrganization?.name} and stored locally.
          </span>
          <Badge tone="slate">{filtered.length} events</Badge>
        </div>
      </Card>
    </div>
  );
}
