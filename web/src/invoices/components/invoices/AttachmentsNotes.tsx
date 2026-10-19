import { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Plus,
  StickyNote,
} from "lucide-react";
import { Button } from "@inv/components/ui/Button";
import { useToast } from "@inv/components/ui/Toast";
import { formatDateTime } from "@inv/lib/format";
import type { Invoice, InvoiceAttachment } from "@inv/types/invoice";

const kindIcon: Record<InvoiceAttachment["kind"], React.ReactNode> = {
  pdf: <FileText className="size-4" />,
  image: <ImageIcon className="size-4" />,
  sheet: <FileSpreadsheet className="size-4" />,
  doc: <FileText className="size-4" />,
};

export function AttachmentsNotes({
  invoice,
  onAddNote,
}: {
  invoice: Invoice;
  onAddNote: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const toast = useToast();

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    onAddNote(body);
    setDraft("");
  };

  return (
    <section
      aria-label="Attachments and notes"
      className="grid grid-cols-1 gap-4 xl:grid-cols-2"
    >
      {/* Attachments */}
      <div className="rounded-xl border border-line bg-surface">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Paperclip className="size-4 text-ink-faint" />
          <h2 className="text-[14px] font-semibold text-ink">Attachments</h2>
          <span className="ml-auto text-[11.5px] text-ink-faint tabular-nums">
            {invoice.attachments.length} files
          </span>
        </header>
        <ul className="divide-y divide-line">
          {invoice.attachments.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-muted">
                {kindIcon[file.kind]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink">{file.name}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-ink-faint">
                  {file.size} · {file.uploadedBy} · {formatDateTime(file.uploadedAt)}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  toast({
                    kind: "info",
                    title: "Attachment preview unavailable",
                    body: `${file.name} is demonstration data — no file is stored.`,
                  })
                }
              >
                View
              </Button>
            </li>
          ))}
        </ul>
        <div className="border-t border-line bg-surface-2/40 px-4 py-2.5 rounded-b-xl">
          <p className="text-[11.5px] leading-snug text-ink-faint">
            File uploads are disabled in this demonstration build.
          </p>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-line bg-surface">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <StickyNote className="size-4 text-ink-faint" />
          <h2 className="text-[14px] font-semibold text-ink">Internal notes</h2>
          <span className="ml-auto text-[11.5px] text-ink-faint tabular-nums">
            {invoice.notes.length} {invoice.notes.length === 1 ? "note" : "notes"}
          </span>
        </header>

        <div className="max-h-[280px] overflow-y-auto scrollbar-thin">
          {invoice.notes.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">
              No internal notes on this invoice yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {invoice.notes.map((note) => (
                <li key={note.id} className="px-4 py-3">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[12.5px] font-medium text-ink">{note.author}</p>
                    {note.pinned ? (
                      <span className="rounded border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-ink">
                        Pinned
                      </span>
                    ) : null}
                    <time
                      dateTime={note.createdAt}
                      className="ml-auto text-[11.5px] text-ink-faint tabular-nums"
                    >
                      {formatDateTime(note.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{note.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line p-3">
          <label htmlFor="new-note" className="sr-only">
            Add an internal note
          </label>
          <textarea
            id="new-note"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="Add a note for your team… (⌘/Ctrl + Enter to save)"
            className="w-full resize-none rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-ink-faint">
              Notes are visible to staff only, never to tenants.
            </span>
            <Button size="sm" variant="primary" onClick={submit} disabled={!draft.trim()}>
              <Plus className="size-3.5" />
              Add note
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}


