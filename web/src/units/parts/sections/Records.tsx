import { useState } from "react";
import type { Database } from "../../data/types";
import type { UnitRow } from "../../data/selectors";
import { formatDate, formatDateTime, relativeTime } from "../../lib/format";
import { useStore } from "../../store/appStore";
import { Icon, type IconName } from "../../components/ui/Icon";
import { Button, Pill } from "../../components/ui/primitives";
import { Modal } from "../../components/ui/Modal";
import { EmptyInline, SectionCard } from "./common";

const kindIcon: Record<string, IconName> = {
  Lease: "file",
  Inspection: "clipboard",
  Photo: "image",
  Invoice: "dollar",
  Certificate: "shield",
  Notice: "alert",
};

const activityIcon: Record<string, IconName> = {
  status: "door",
  lease: "key",
  tenant: "users",
  finance: "wallet",
  maintenance: "wrench",
  record: "clipboard",
  system: "activity",
};

export function DocumentsSection({ row, db }: { row: UnitRow; db: Database }) {
  const { pushToast } = useStore();
  const [preview, setPreview] = useState<string | null>(null);
  const docs = db.documents.filter((doc) => doc.unitId === row.unit.id);
  const doc = docs.find((d) => d.id === preview) ?? null;

  return (
    <SectionCard
      icon="file"
      title="Documents"
      meta={`${docs.length} file${docs.length === 1 ? "" : "s"} attached to this unit`}
      actions={
        <Button
          size="xs"
          icon="plus"
          onClick={() =>
            pushToast({
              tone: "azure",
              title: "Upload not connected",
              message: "Document storage is out of scope for this prototype — existing files are listed below.",
            })
          }
        >
          Upload
        </Button>
      }
    >
      {docs.length === 0 ? (
        <EmptyInline
          icon="file"
          title="No documents on this unit"
          compact
          body="Lease agreements, condition reports, certificates and notices will appear here."
        />
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {docs.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setPreview(d.id)}
                className="flex w-full items-center gap-2.5 rounded-md border border-u-line2 bg-u-bg/45 px-2.5 py-2 text-left transition-all hover:-translate-y-px hover:border-u-accent/45 hover:bg-u-card"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-u-line2 bg-u-s2 text-u-accent">
                  <Icon name={kindIcon[d.kind] ?? "file"} size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] text-u-ink">{d.name}</span>
                  <span className="u-num block text-[10.5px] text-u-muted">
                    {d.kind} · {d.sizeKb.toLocaleString("en-CA")} KB · {formatDate(d.uploadedAt)}
                  </span>
                </span>
                <Icon name="chevronRight" size={13} className="shrink-0 text-u-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!doc}
        onClose={() => setPreview(null)}
        title={doc?.name ?? ""}
        subtitle={doc ? `${doc.kind} · uploaded by ${doc.uploadedBy} on ${formatDate(doc.uploadedAt)}` : undefined}
        icon={doc ? (kindIcon[doc.kind] ?? "file") : "file"}
        footer={
          <>
            <Button
              variant="ghost"
              icon="download"
              onClick={() =>
                pushToast({ tone: "azure", title: "Download queued", message: `${doc?.name} — storage is not connected in this prototype.` })
              }
            >
              Download
            </Button>
            <Button onClick={() => setPreview(null)}>Close</Button>
          </>
        }
      >
        {doc && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-md border border-u-line2 bg-white p-6">
              <div className="mx-auto max-w-sm space-y-2">
                <div className="h-3 w-2/3 rounded bg-slate-300" />
                <div className="h-2 w-full rounded bg-slate-200" />
                <div className="h-2 w-11/12 rounded bg-slate-200" />
                <div className="h-2 w-full rounded bg-slate-200" />
                <div className="mt-4 h-2 w-1/2 rounded bg-slate-300" />
                <div className="h-2 w-full rounded bg-slate-200" />
                <div className="h-2 w-10/12 rounded bg-slate-200" />
                <div className="mt-6 flex justify-between">
                  <div className="h-8 w-24 rounded border border-slate-300" />
                  <div className="h-8 w-24 rounded border border-slate-300" />
                </div>
              </div>
              <span className="absolute inset-0 flex items-center justify-center bg-slate-900/5 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Preview unavailable
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.09em] text-u-muted">Document ID</dt>
                <dd className="u-num text-u-ink2">{doc.id}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.09em] text-u-muted">Size</dt>
                <dd className="u-num text-u-ink2">{doc.sizeKb.toLocaleString("en-CA")} KB</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.09em] text-u-muted">Linked lease</dt>
                <dd className="u-num text-u-ink2">{doc.leaseId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.09em] text-u-muted">Uploaded</dt>
                <dd className="u-num text-u-ink2">{formatDate(doc.uploadedAt)}</dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>
    </SectionCard>
  );
}

export function ActivitySection({ row, db }: { row: UnitRow; db: Database }) {
  const events = db.activity
    .filter((a) => a.unitId === row.unit.id)
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <SectionCard icon="activity" title="Activity History" meta={`${events.length} event${events.length === 1 ? "" : "s"}`}>
      {events.length === 0 ? (
        <EmptyInline icon="activity" title="No activity recorded" compact body="Changes to this unit will be logged here." />
      ) : (
        <ol className="relative space-y-3 pl-5">
          <span className="absolute left-[7px] top-1 bottom-1 w-px bg-u-s3" aria-hidden="true" />
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-u-line2 bg-u-card text-u-accent">
                <Icon name={activityIcon[e.kind] ?? "activity"} size={8} />
              </span>
              <p className="text-[12px] leading-snug text-u-ink2">{e.message}</p>
              <p className="u-num mt-0.5 text-[10.5px] text-u-muted">
                {formatDateTime(e.at)} · {relativeTime(e.at)} · {e.actor}
              </p>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

export function RegisterStatePill({ archived }: { archived: boolean }) {
  return archived ? <Pill tone="rose">Archived</Pill> : <Pill tone="jade">Active register</Pill>;
}
