import { useMemo, useRef, useState } from "react";
import { useStore, documentsOf, partiesOf } from "../../state/store";
import { PERMISSIONS, DOCUMENT_CATEGORIES, type DocumentCategory } from "../../data/types";
import { fileSize, fileExt, formatDate } from "../../lib/format";
import { Badge, DocumentStatusBadge, MockTag, RestrictedTag } from "../../components/ui/Badge";
import { Button, IconButton } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Overlay";
import { Input, Select } from "../../components/ui/Form";
import { EmptyHint, MiniTable, Note, SubSection, Td } from "./parts";
import { Tooltip } from "../../components/ui/Misc";
import {
  IconArchive,
  IconDownload,
  IconEye,
  IconFile,
  IconLayers,
  IconLock,
  IconPencil,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from "../../components/icons";
import type { DialogRequest } from "./dialogTypes";
import { cn } from "../../utils/cn";

interface Staged {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  title: string;
  category: DocumentCategory;
  partyId?: string;
  notes?: string;
  status: "Ready" | "Uploading" | "Failed";
}

export function DocumentsSection({
  applicationId,
  open,
}: {
  applicationId: string;
  open: (d: DialogRequest) => void;
}) {
  const { state, dispatch, can, toast, uid } = useStore();
  const all = documentsOf(state, applicationId);
  const parties = partiesOf(state, applicationId);
  const allowed = can(PERMISSIONS.documents);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      all.filter((d) => {
        if (category !== "All" && d.category !== category) return false;
        if (statusFilter !== "All" && d.status !== statusFilter) return false;
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return `${d.title} ${d.fileName} ${d.notes ?? ""} ${d.uploadedBy}`.toLowerCase().includes(q);
      }),
    [all, category, statusFilter, query],
  );

  const needsAttention = all.filter((d) => d.status === "Needs Replacement").length;
  const archived = all.filter((d) => d.status === "Archived").length;
  const versions = all.reduce((acc, d) => acc + d.versions.length, 0);

  const stageFiles = (files: FileList | null) => {
    if (!files || !allowed) return;
    const next: Staged[] = Array.from(files).map((f, i) => ({
      id: `staged-${Date.now()}-${i}`,
      fileName: f.name,
      fileSize: f.size,
      fileType: fileExt(f.name),
      title: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
      category: guessCategory(f.name),
      status: "Ready",
    }));
    setStaged((s) => [...s, ...next]);
  };

  const commitUpload = () => {
    if (!staged.length) return;
    setUploading(true);
    setStaged((s) => s.map((f) => ({ ...f, status: "Uploading" })));
    const batch = staged;
    window.setTimeout(() => {
      dispatch({
        type: "ADD_DOCUMENTS",
        uploadedBy: `${state.currentUser.name} (Staff upload)`,
        documents: batch.map((f) => ({
          applicationId,
          applicationPartyId: f.partyId,
          title: f.title,
          category: f.category,
          fileName: f.fileName,
          fileType: f.fileType,
          fileSize: f.fileSize,
          uploadedAt: new Date().toISOString().slice(0, 10),
          notes: f.notes,
          id: uid("doc"),
        })),
      });
      setStaged([]);
      setUploading(false);
      toast({
        variant: "warn",
        title: `${batch.length} document${batch.length === 1 ? "" : "s"} recorded`,
        description:
          "Metadata saved in client state only. File storage is not connected in this prototype, so nothing was uploaded.",
        simulated: true,
      });
    }, 750);
  };

  return (
    <div className="space-y-3 rounded-xl border border-u-line bg-u-card/60 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-u-ink">E. Documents</h3>
            <Badge tone="blue">{all.length} active</Badge>
            {versions > all.length && <Badge tone="indigo">{versions} versions</Badge>}
            {archived > 0 && <Badge tone="slate">{archived} archived</Badge>}
            {needsAttention > 0 && <Badge tone="red">{needsAttention} need replacement</Badge>}
            {!allowed && <RestrictedTag label="Document access required" />}
          </div>
          <p className="mt-0.5 text-[11.5px] text-u-muted">
            Multiple documents per application with version history. Required items are configurable per application —
            applicants are never required to provide every possible document.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <MockTag label="Storage not connected" />
          <Button size="xs" variant="secondary" icon={<IconUpload width={12} height={12} />} onClick={() => open({ kind: "uploadDocs" })}>
            Upload Documents
          </Button>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          stageFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
          dragging ? "border-u-accent bg-u-accent/8" : "border-u-line2 bg-u-s2/40",
          !allowed && "pointer-events-none opacity-50",
        )}
      >
        <IconFile className="mx-auto mb-2 text-u-muted" width={20} height={20} />
        <p className="text-[13px] font-medium text-u-ink">Drag and drop files here</p>
        <p className="mx-auto mt-1 max-w-lg text-[11.5px] leading-relaxed text-u-muted">
          Multiple file selection is supported. Files are read for name, size, and type only — no bytes leave the
          browser because document storage is not connected in this prototype.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
          <Button size="xs" variant="secondary" icon={<IconUpload width={12} height={12} />} onClick={() => inputRef.current?.click()}>
            Browse Files
          </Button>
          <Button size="xs" variant="primary" disabled={!staged.length || uploading} onClick={commitUpload}>
            {uploading ? "Uploading…" : `Upload Documents${staged.length ? ` (${staged.length})` : ""}`}
          </Button>
          {staged.length > 0 && !uploading && (
            <Button size="xs" variant="ghost" icon={<IconX width={12} height={12} />} onClick={() => setStaged([])}>
              Clear
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              stageFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Staged uploads */}
      {staged.length > 0 && (
        <SubSection
          title={`Pending upload — ${staged.length} file${staged.length === 1 ? "" : "s"}`}
          hint="Assign a title, category, and applicant before saving."
          actions={<MockTag label="Simulated upload" />}
        >
          <MiniTable head={["Document Title", "Category", "File", "Size", "Upload Status", ""]}>
            {staged.map((f) => (
              <tr key={f.id}>
                <Td>
                  <Input
                    value={f.title}
                    onChange={(e) =>
                      setStaged((s) => s.map((x) => (x.id === f.id ? { ...x, title: e.target.value } : x)))
                    }
                    className="min-w-[180px]"
                  />
                </Td>
                <Td>
                  <Select
                    value={f.category}
                    onChange={(e) =>
                      setStaged((s) =>
                        s.map((x) => (x.id === f.id ? { ...x, category: e.target.value as DocumentCategory } : x)),
                      )
                    }
                    className="min-w-[160px]"
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <p className="max-w-[200px] truncate font-mono text-[11.5px]">{f.fileName}</p>
                  <p className="text-[11px] text-u-muted">{f.fileType}</p>
                </Td>
                <Td>{fileSize(f.fileSize)}</Td>
                <Td>
                  <Badge tone={f.status === "Ready" ? "blue" : f.status === "Uploading" ? "amber" : "red"}>
                    {f.status === "Uploading" ? "Uploading…" : f.status}
                  </Badge>
                </Td>
                <Td>
                  <IconButton
                    label="Remove staged file"
                    tone="danger"
                    onClick={() => setStaged((s) => s.filter((x) => x.id !== f.id))}
                  >
                    <IconX width={13} height={13} />
                  </IconButton>
                </Td>
              </tr>
            ))}
          </MiniTable>
        </SubSection>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-u-muted" width={14} height={14} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents by title, file name, or notes"
            className="pl-8"
          />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto min-w-[170px]">
          <option value="All">All categories</option>
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto min-w-[140px]">
          <option value="All">All statuses</option>
          {["Received", "Under Review", "Accepted", "Needs Replacement", "Archived"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Badge tone="neutral">{filtered.length} shown</Badge>
      </div>

      {/* Document table */}
      {filtered.length === 0 ? (
        <EmptyHint>
          {all.length === 0
            ? "No documents attached to this application yet. Use the dropzone above to record the first document."
            : "No documents match the current search or category filter."}
        </EmptyHint>
      ) : (
        <MiniTable
          head={[
            "Document Title",
            "Category",
            "File",
            "Size",
            "Uploaded",
            "Uploaded By",
            "Status",
            "Notes",
            "Actions",
          ]}
        >
          {filtered.map((doc) => {
            const owner = parties.find((p) => p.id === doc.applicationPartyId);
            return (
              <tr key={doc.id} className={cn("hover:bg-u-s2/50", doc.status === "Archived" && "opacity-70")}>
                <Td>
                  <p className="flex items-center gap-1.5 font-medium text-u-ink">
                    <IconFile width={13} height={13} className="shrink-0 text-u-muted" />
                    <span className="max-w-[200px] truncate">{doc.title}</span>
                  </p>
                  {owner && <p className="ml-[21px] text-[11px] text-u-muted">{owner.fullName}</p>}
                  <p className="ml-[21px] text-[11px] text-u-muted">
                    v{doc.versionNumber}
                    {doc.versions.length > 1 && ` · ${doc.versions.length} versions`}
                  </p>
                </Td>
                <Td>
                  <Badge tone="neutral">{doc.category}</Badge>
                </Td>
                <Td>
                  <Tooltip label={doc.fileName}>
                    <span className="block max-w-[160px] truncate font-mono text-[11.5px]">{doc.fileName}</span>
                  </Tooltip>
                  <span className="text-[11px] text-u-muted">{doc.fileType}</span>
                </Td>
                <Td>{fileSize(doc.fileSize)}</Td>
                <Td>
                  {formatDate(doc.uploadedAt)}
                  <p className="text-[11px] text-u-muted">retire {formatDate(doc.retentionUntil)}</p>
                </Td>
                <Td>
                  <span className="block max-w-[140px] truncate text-[11.5px]">{doc.uploadedBy}</span>
                </Td>
                <Td>
                  <DocumentStatusBadge status={doc.status} />
                </Td>
                <Td>
                  <Tooltip label={doc.notes || "No notes"}>
                    <span className="block max-w-[160px] truncate text-[11.5px] text-u-muted">
                      {doc.notes || "—"}
                    </span>
                  </Tooltip>
                </Td>
                <Td>
                  <div className="flex items-center gap-0.5">
                    <Tooltip label="Preview (requires connected storage)">
                      <IconButton
                        label="Preview document"
                        disabled={!allowed}
                        onClick={() => setPreview(doc.id)}
                      >
                        <IconEye width={14} height={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip label="Download (simulated)">
                      <IconButton
                        label="Download document"
                        disabled={!allowed}
                        onClick={() =>
                          toast({
                            variant: "warn",
                            title: "Download simulated",
                            description: `${doc.fileName} — no object storage is connected, so no file was fetched.`,
                            simulated: true,
                          })
                        }
                      >
                        <IconDownload width={14} height={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip label="Edit title and metadata">
                      <IconButton
                        label="Edit document metadata"
                        disabled={!allowed}
                        onClick={() => open({ kind: "documentMeta", documentId: doc.id })}
                      >
                        <IconPencil width={14} height={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip label="Replace with a new version (previous version is kept)">
                      <IconButton
                        label="Replace with new version"
                        disabled={!allowed}
                        onClick={() => open({ kind: "replaceDocument", documentId: doc.id })}
                      >
                        <IconLayers width={14} height={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip label="Version history">
                      <IconButton
                        label="View version history"
                        disabled={!allowed}
                        onClick={() => open({ kind: "versionHistory", documentId: doc.id })}
                      >
                        <IconArchive width={14} height={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip label={doc.status === "Archived" ? "Restore document" : "Archive document"}>
                      <IconButton
                        label="Archive document"
                        disabled={!allowed}
                        onClick={() =>
                          dispatch({
                            type: "SET_DOCUMENT_STATUS",
                            id: doc.id,
                            status: doc.status === "Archived" ? "Received" : "Archived",
                            updatedBy: state.currentUser.name,
                            note: doc.status === "Archived" ? "Restored from archive" : undefined,
                          })
                        }
                      >
                        <IconArchive width={14} height={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip label="Delete (soft delete pending retention)">
                      <IconButton
                        label="Delete document"
                        tone="danger"
                        disabled={!allowed || !can("applications.manage")}
                        onClick={() => open({ kind: "deleteDocument", documentId: doc.id })}
                      >
                        <IconTrash width={14} height={14} />
                      </IconButton>
                    </Tooltip>
                  </div>
                </Td>
              </tr>
            );
          })}
        </MiniTable>
      )}

      <div className="grid gap-2 lg:grid-cols-2">
        <Note tone="warn">
          <IconLock width={11} height={11} className="mr-1 inline align-[-1px]" />
          Rental applications hold sensitive personal data. Access is role-restricted, records carry a retention date,
          and deletion is a two-step workflow (soft delete, then storage purge by a backend job).
        </Note>
        <Note>
          Replacing a document keeps the previous version in history with its own uploader, timestamp, and notes —
          nothing is silently overwritten. Lease documents live in the Leases module and can be copied, not moved.
        </Note>
      </div>

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Document preview"
        description="A real preview streams the file from object storage. Storage is not connected in this prototype."
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setPreview(null)}>
            Close
          </Button>
        }
      >
        {(() => {
          const doc = all.find((d) => d.id === preview);
          if (!doc) return null;
          return (
            <div className="space-y-3">
              <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-u-line2 bg-u-s2/60">
                <div className="text-center">
                  <IconFile className="mx-auto text-u-muted" width={28} height={28} />
                  <p className="mt-2 font-mono text-[12px] text-u-ink2">{doc.fileName}</p>
                  <p className="text-[11px] text-u-muted">
                    {doc.fileType} · {fileSize(doc.fileSize)} · v{doc.versionNumber}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <dt className="text-u-muted">Title</dt>
                  <dd className="text-u-ink">{doc.title}</dd>
                </div>
                <div>
                  <dt className="text-u-muted">Category</dt>
                  <dd className="text-u-ink">{doc.category}</dd>
                </div>
                <div>
                  <dt className="text-u-muted">Storage reference</dt>
                  <dd className="font-mono text-[11.5px] text-u-muted">{doc.storageReference ?? "not connected"}</dd>
                </div>
                <div>
                  <dt className="text-u-muted">Status</dt>
                  <dd className="text-u-ink">{doc.status}</dd>
                </div>
              </dl>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function guessCategory(fileName: string): DocumentCategory {
  const n = fileName.toLowerCase();
  if (/(paystub|pay-stub|pay_stub|income|salary|w2|w-2|1099|bank)/.test(n)) return "Proof of Income";
  if (/(employ|offer-letter|hr-letter)/.test(n)) return "Employment Letter";
  if (/(reference|landlord)/.test(n)) return "Reference";
  if (/(credit|authorization|auth)/.test(n)) return "Credit Authorization";
  if (/(id|passport|license|identity)/.test(n)) return "Identity Verification";
  if (/(application|lease-form|rental-app)/.test(n)) return "Rental Application Form";
  return "Supporting Document";
}
