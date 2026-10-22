import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Info, Plus } from "lucide-react";
import { Button as TnButton, EmptyState, IconButton } from "../tenants/components/ui";
import { FilterField, FilterPopover, SearchField } from "../shell/directory";
import "./documents.css";
import {
  allEntityOptions,
  categoryOptions,
  creationMethodLabels,
  documentStatuses,
  documentTypeOptions,
  initialDocuments,
  mockActor,
  mockBusinessRecords,
  originModuleRegistry,
  type CreationMethod,
  type DocumentActivity,
  type DocumentRecord,
  type DocumentStatus,
  type EntityReference,
  type MockBusinessRecord,
  type RecordReference,
  type RelatedRecord,
} from "./data";

type IconName =
  | "archive"
  | "building"
  | "calendar"
  | "check"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "clock"
  | "close"
  | "download"
  | "edit"
  | "external"
  | "eye"
  | "file"
  | "filter"
  | "image"
  | "info"
  | "link"
  | "plus"
  | "restore"
  | "search"
  | "upload"
  | "user";

type SortKey =
  | "name"
  | "documentType"
  | "originModule"
  | "primaryRecord"
  | "relatedEntities"
  | "createdAt"
  | "creationMethod"
  | "createdBy"
  | "status";

interface Filters {
  originModule: string;
  documentType: string;
  creationMethod: string;
  status: string;
  property: string;
  tenant: string;
  datePreset: string;
  dateFrom: string;
  dateTo: string;
}

interface FormValues {
  name: string;
  documentType: string;
  category: string;
  originModule: string;
  creationMethod: CreationMethod;
  primaryRecordKey: string;
  relatedRecordKeys: string[];
  description: string;
  tagsText: string;
  selectedFile: File | null;
}

interface ConfirmationState {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

const defaultFilters: Filters = {
  originModule: "",
  documentType: "",
  creationMethod: "",
  status: "active",
  property: "",
  tenant: "",
  datePreset: "",
  dateFrom: "",
  dateTo: "",
};

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "active", label: "Active documents" },
  { key: "archived", label: "Archived" },
  { key: "", label: "All documents" },
];

const uploadRules = {
  maxSizeBytes: 15 * 1024 * 1024,
  allowedExtensions: ["pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx", "csv", "txt"],
};

const creationMethodValues: CreationMethod[] = [
  "system_generated",
  "manual_upload",
  "imported",
];

function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "archive":
      return <svg {...common}><path d="M3 7h18v13H3z" /><path d="M2 4h20v3H2zM9 11h6" /></svg>;
    case "building":
      return <svg {...common}><path d="M4 21V5l8-3 8 3v16" /><path d="M2 21h20M8 8h1m6 0h1M8 12h1m6 0h1M10 21v-5h4v5" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    case "chevronDown":
      return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
    case "chevronLeft":
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case "chevronRight":
      return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "close":
      return <svg {...common}><path d="m18 6-12 12M6 6l12 12" /></svg>;
    case "download":
      return <svg {...common}><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 17v4h14v-4" /></svg>;
    case "edit":
      return <svg {...common}><path d="m15 5 4 4M4 20l4-.8L19 8a2.12 2.12 0 0 0-3-3L5 16l-1 4Z" /></svg>;
    case "external":
      return <svg {...common}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></svg>;
    case "eye":
      return <svg {...common}><path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
    case "file":
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></svg>;
    case "filter":
      return <svg {...common}><path d="M4 6h16M7 12h10m-7 6h4" /><circle cx="8" cy="6" r="1.4" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>;
    case "image":
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></svg>;
    case "link":
      return <svg {...common}><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "restore":
      return <svg {...common}><path d="M3 11a9 9 0 1 1 2.6 6.4M3 4v7h7" /><path d="M12 7v5l3 2" /></svg>;
    case "search":
      return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>;
    case "upload":
      return <svg {...common}><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M4 16v4h16v-4" /></svg>;
    case "user":
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>;
  }
}

function recordKey(reference: RecordReference) {
  return `${reference.module}::${reference.recordId}`;
}

function recordFromKey(key: string): RecordReference | null {
  return mockBusinessRecords.find((item) => recordKey(item.reference) === key)?.reference ?? null;
}

function findBusinessRecord(reference: RecordReference): MockBusinessRecord | undefined {
  return mockBusinessRecords.find(
    (item) => item.reference.module === reference.module && item.reference.recordId === reference.recordId,
  );
}

function getDocumentReferences(document: DocumentRecord) {
  return [document.primaryRecord, ...document.relatedRecords].filter(
    (item): item is RecordReference => item !== null,
  );
}

function uniqueEntities(entities: EntityReference[]) {
  const found = new Map<string, EntityReference>();
  entities.forEach((entity) => found.set(`${entity.entityType}:${entity.entityId}`, entity));
  return Array.from(found.values());
}

function entitiesForReferences(references: RecordReference[]) {
  return uniqueEntities(
    references.flatMap((reference) => findBusinessRecord(reference)?.relatedEntities ?? []),
  );
}

function formatDate(value?: string) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value?: number) {
  if (!value) return "Not available";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function removeFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function extensionFor(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function validateLocalFile(file: File) {
  const extension = extensionFor(file.name);
  if (!uploadRules.allowedExtensions.includes(extension)) {
    return `Unsupported file type. Choose ${uploadRules.allowedExtensions.map((item) => item.toUpperCase()).join(", ")}.`;
  }
  if (file.size > uploadRules.maxSizeBytes) {
    return "This file is larger than the 15 MB local upload limit.";
  }
  return "";
}

function FileMark({ document }: { document: DocumentRecord }) {
  const extension = document.file.extension.toLowerCase();
  const kind = ["png", "jpg", "jpeg"].includes(extension) ? "image" : extension === "pdf" ? "pdf" : "file";
  return (
    <span className={`file-mark file-mark-${kind}`} aria-label={extension ? `${extension.toUpperCase()} file` : "No local file"}>
      <Icon name={kind === "image" ? "image" : "file"} size={18} />
      <span>{extension ? extension.toUpperCase() : "META"}</span>
    </span>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  active = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  const id = `filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label className={`filter-field ${active ? "is-active" : ""} ${className}`} htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      <Icon name="chevronDown" size={14} />
    </label>
  );
}

function SortableHeader({
  label,
  column,
  current,
  direction,
  onSort,
}: {
  label: string;
  column: SortKey;
  current: SortKey;
  direction: "asc" | "desc";
  onSort: (column: SortKey) => void;
}) {
  const selected = column === current;
  return (
    <th aria-sort={selected ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button className={`sort-button ${selected ? "is-sorted" : ""}`} onClick={() => onSort(column)} type="button">
        {label}
        <span className="sort-mark" aria-hidden="true">{selected ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`dm-status-badge dm-status-${status}`}>
      <span className="dm-status-dot" />
      {documentStatuses[status]}
    </span>
  );
}

function MethodLabel({ method }: { method: CreationMethod }) {
  return (
    <span className={`method-label method-${method}`}>
      <span className="method-dot" />
      {creationMethodLabels[method]}
    </span>
  );
}

function RecordLink({ reference, onOpen }: { reference: RecordReference; onOpen: (reference: RecordReference) => void }) {
  return (
    <button className="record-link" type="button" onClick={() => onOpen(reference)}>
      <span>{reference.recordId}</span>
      <Icon name="external" size={13} />
    </button>
  );
}

function RelatedEntitySummary({ entities }: { entities: EntityReference[] }) {
  if (!entities.length) return <span className="muted-text">No linked entities</span>;
  const visible = entities.slice(0, 2);
  const remaining = entities.length - visible.length;
  return (
    <span className="entity-summary" title={entities.map((item) => item.entityLabel).join(", ")}>
      {visible.map((item) => item.entityLabel).join(" · ")}
      {remaining > 0 && <span className="entity-more">+{remaining}</span>}
    </span>
  );
}

function DocumentActions({
  document,
  onView,
  onEdit,
  onDownload,
  onArchive,
  onRestore,
}: {
  document: DocumentRecord;
  onView: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="dm-row-actions" aria-label={`Actions for ${document.name}`}>
      <button className="dm-icon-button" type="button" aria-label="View document details" title="View details" onClick={onView}>
        <Icon name="eye" size={16} />
      </button>
      <button className="dm-icon-button" type="button" aria-label="Edit document metadata" title="Edit metadata" onClick={onEdit}>
        <Icon name="edit" size={16} />
      </button>
      <button className="dm-icon-button" type="button" aria-label="Download document" title="Download" onClick={onDownload}>
        <Icon name="download" size={16} />
      </button>
      {document.status === "active" ? (
        <button className="dm-icon-button icon-button-warn" type="button" aria-label="Archive document" title="Archive" onClick={onArchive}>
          <Icon name="archive" size={16} />
        </button>
      ) : (
        <button className="dm-icon-button icon-button-restore" type="button" aria-label="Restore document" title="Restore" onClick={onRestore}>
          <Icon name="restore" size={16} />
        </button>
      )}
    </div>
  );
}

function DocumentFormDialog({
  initialDocument,
  onClose,
  onSave,
}: {
  initialDocument: DocumentRecord | null;
  onClose: () => void;
  onSave: (values: FormValues, initialDocument: DocumentRecord | null) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => ({
    name: initialDocument?.name ?? "",
    documentType: initialDocument?.documentType ?? "",
    category: initialDocument?.category ?? "",
    originModule: initialDocument?.originModule ?? "",
    creationMethod: initialDocument?.creationMethod ?? "manual_upload",
    primaryRecordKey: initialDocument?.primaryRecord ? recordKey(initialDocument.primaryRecord) : "",
    relatedRecordKeys: initialDocument?.relatedRecords.map(recordKey) ?? [],
    description: initialDocument?.description ?? "",
    tagsText: initialDocument?.tags.join(", ") ?? "",
    selectedFile: null,
  }));
  const [relatedCandidate, setRelatedCandidate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const primaryRecordOptions = mockBusinessRecords.filter(
    (item) => values.originModule === "Manual Upload" || item.reference.module === values.originModule,
  );
  const relatedRecordOptions = mockBusinessRecords.filter((item) => {
    const key = recordKey(item.reference);
    return key !== values.primaryRecordKey && !values.relatedRecordKeys.includes(key);
  });

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handlePrimaryChange(nextKey: string) {
    setValues((current) => {
      let relatedKeys = [...current.relatedRecordKeys];
      if (current.primaryRecordKey && nextKey && current.primaryRecordKey !== nextKey) {
        if (!relatedKeys.includes(current.primaryRecordKey)) relatedKeys.push(current.primaryRecordKey);
      }
      relatedKeys = relatedKeys.filter((key) => key !== nextKey);
      return { ...current, primaryRecordKey: nextKey, relatedRecordKeys: relatedKeys };
    });
  }

  function handleOriginChange(originModule: string) {
    setValues((current) => {
      const currentPrimary = recordFromKey(current.primaryRecordKey);
      const primaryStillAllowed =
        currentPrimary && (originModule === "Manual Upload" || currentPrimary.module === originModule);
      return {
        ...current,
        originModule,
        primaryRecordKey: primaryStillAllowed ? current.primaryRecordKey : "",
      };
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateLocalFile(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setError("");
    setValues((current) => ({
      ...current,
      selectedFile: file,
      name: current.name || removeFileExtension(file.name),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requiredFields: Array<[string, string]> = [
      [values.name.trim(), "Enter a document name."],
      [values.documentType, "Choose a document type."],
      [values.category, "Choose a category."],
      [values.originModule, "Choose an origin module."],
      [values.creationMethod, "Choose a creation method."],
    ];
    const missing = requiredFields.find(([value]) => !value);
    if (missing) {
      setError(missing[1]);
      return;
    }

    if (values.selectedFile) {
      const fileError = validateLocalFile(values.selectedFile);
      if (fileError) {
        setError(fileError);
        return;
      }
    }

    const primary = values.primaryRecordKey ? recordFromKey(values.primaryRecordKey) : null;
    if (primary && values.originModule !== "Manual Upload" && primary.module !== values.originModule) {
      setError("The primary record must belong to the selected origin module.");
      return;
    }

    if (initialDocument?.primaryRecord && !primary) {
      const accepted = window.confirm(
        `Remove the primary link to ${initialDocument.primaryRecord.recordId}? The business record itself will not be changed.`,
      );
      if (!accepted) return;
    }

    setError("");
    onSave(values, initialDocument);
  }

  return (
    <div className="dm-modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="document-form-title">
        <div className="dialog-heading">
          <div>
            <span className="dm-eyebrow">DOCUMENT REGISTRY</span>
            <h2 id="document-form-title">{initialDocument ? "Edit document metadata" : "Upload document"}</h2>
            <p>{initialDocument ? `Update ${initialDocument.id} and its record links.` : "Add a document reference to the central registry."}</p>
          </div>
          <button className="dm-icon-button dialog-close" type="button" aria-label="Close dialog" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <form className="document-form" onSubmit={handleSubmit}>
          <div className="form-scroll-area">
            <div className="dm-form-grid two-columns">
              <label className="dm-form-field form-field-wide">
                <span>Document name <b>*</b></span>
                <input
                  autoFocus
                  value={values.name}
                  onChange={(event) => setField("name", event.target.value)}
                  placeholder="e.g. Signed lease agreement"
                  required
                />
              </label>
              <label className="dm-form-field">
                <span>Document type <b>*</b></span>
                <select value={values.documentType} onChange={(event) => setField("documentType", event.target.value)} required>
                  <option value="">Select document type</option>
                  {documentTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="dm-form-field">
                <span>Category <b>*</b></span>
                <select value={values.category} onChange={(event) => setField("category", event.target.value)} required>
                  <option value="">Select category</option>
                  {categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="dm-form-field">
                <span>Origin module <b>*</b></span>
                <select value={values.originModule} onChange={(event) => handleOriginChange(event.target.value)} required>
                  <option value="">Select origin module</option>
                  {originModuleRegistry.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
                <small>Where the document belongs, not how it arrived.</small>
              </label>
              <label className="dm-form-field">
                <span>Creation method <b>*</b></span>
                <select value={values.creationMethod} onChange={(event) => setField("creationMethod", event.target.value as CreationMethod)} required>
                  {creationMethodValues.map((method) => <option key={method} value={method}>{creationMethodLabels[method]}</option>)}
                </select>
              </label>
              <label className="dm-form-field form-field-wide">
                <span>Primary linked record</span>
                <select value={values.primaryRecordKey} onChange={(event) => handlePrimaryChange(event.target.value)}>
                  <option value="">No primary business record</option>
                  {primaryRecordOptions.map((item) => (
                    <option key={recordKey(item.reference)} value={recordKey(item.reference)}>
                      {item.reference.module} / {item.reference.recordId} / {item.reference.recordLabel}
                    </option>
                  ))}
                </select>
                <small>Choose a record in the origin module. An unlinked document is allowed.</small>
              </label>
              <div className="dm-form-field form-field-wide">
                <span id="related-records-label">Additional linked records</span>
                <div className="related-picker">
                  <select
                    aria-labelledby="related-records-label"
                    value={relatedCandidate}
                    onChange={(event) => setRelatedCandidate(event.target.value)}
                  >
                    <option value="">Choose a record to link</option>
                    {relatedRecordOptions.map((item) => (
                      <option key={recordKey(item.reference)} value={recordKey(item.reference)}>
                        {item.reference.module} / {item.reference.recordId} / {item.reference.recordLabel}
                      </option>
                    ))}
                  </select>
                  <button
                    className="dm-button dm-button-secondary add-related-button"
                    type="button"
                    disabled={!relatedCandidate}
                    onClick={() => {
                      if (!relatedCandidate || values.relatedRecordKeys.includes(relatedCandidate)) return;
                      setField("relatedRecordKeys", [...values.relatedRecordKeys, relatedCandidate]);
                      setRelatedCandidate("");
                    }}
                  >
                    <Icon name="plus" size={15} /> Add link
                  </button>
                </div>
                {values.relatedRecordKeys.length > 0 ? (
                  <ul className="form-related-list">
                    {values.relatedRecordKeys.map((key) => {
                      const reference = recordFromKey(key);
                      if (!reference) return null;
                      return (
                        <li key={key}>
                          <span className="linked-record-type">{reference.module}</span>
                          <span className="linked-record-id">{reference.recordId}</span>
                          <span className="linked-record-description">{reference.recordLabel}</span>
                          <button
                            className="remove-link-button"
                            type="button"
                            aria-label={`Remove link to ${reference.recordId}`}
                            onClick={() => setField("relatedRecordKeys", values.relatedRecordKeys.filter((item) => item !== key))}
                          >
                            <Icon name="close" size={14} /> Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <small>No additional records linked.</small>
                )}
              </div>
              <label className="dm-form-field form-field-wide">
                <span>Description or notes</span>
                <textarea
                  rows={3}
                  value={values.description}
                  onChange={(event) => setField("description", event.target.value)}
                  placeholder="Add context for other team members"
                />
              </label>
              <label className="dm-form-field form-field-wide">
                <span>Tags <small>(comma separated)</small></span>
                <input
                  value={values.tagsText}
                  onChange={(event) => setField("tagsText", event.target.value)}
                  placeholder="e.g. renewal, 2026, signed"
                />
              </label>
              <div className="dm-form-field form-field-wide">
                <span>Local file</span>
                <label className="file-drop-zone">
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={handleFileChange} />
                  <span className="file-drop-icon"><Icon name="upload" size={19} /></span>
                  <span className="file-drop-copy">
                    <strong>{values.selectedFile?.name ?? (initialDocument?.file.localPreviewUrl ? initialDocument.file.fileName : "Choose a file")}</strong>
                    <small>
                      {values.selectedFile
                        ? `${formatBytes(values.selectedFile.size)} selected`
                        : initialDocument?.file.localPreviewUrl
                          ? "Select another file to replace the current local preview."
                          : "Optional. PDF, image, Office, CSV or text file, up to 15 MB."}
                    </small>
                  </span>
                  <span className="file-choose-action">Browse</span>
                </label>
                {initialDocument && !initialDocument.file.localPreviewUrl && !values.selectedFile && (
                  <small>The existing mock record has metadata only; no source file is stored.</small>
                )}
              </div>
            </div>
            <div className="local-operation-note">
              <Icon name="info" size={16} />
              <span>Local mock operation only. Selected files are available in this browser session and are not uploaded to a server or permanently stored.</span>
            </div>
            {error && <p className="dm-form-error" role="alert">{error}</p>}
          </div>
          <div className="dialog-footer">
            <button className="dm-button dm-button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="dm-button dm-button-primary" type="submit">
              {initialDocument ? "Save changes" : "Add to documents"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DetailDrawer({
  document,
  isCovered = false,
  onClose,
  onEdit,
  onDownload,
  onArchive,
  onRestore,
  onOpenRecord,
}: {
  document: DocumentRecord;
  isCovered?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onOpenRecord: (reference: RecordReference) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCovered) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCovered, onClose]);

  const previewKind = document.file.extension.toLowerCase();
  const hasLocalFile = Boolean(document.file.localPreviewUrl);
  const timeline = [...document.activity].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="dm-drawer-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="drawer-header">
          <div className="drawer-heading-copy">
            <span className="dm-eyebrow">DOCUMENT DETAILS</span>
            <h2 id="detail-title">{document.name}</h2>
            <div className="drawer-id-line"><span>{document.id}</span><StatusBadge status={document.status} /></div>
          </div>
          <button className="dm-icon-button dialog-close" type="button" aria-label="Close document details" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer-action-bar">
          <button className="dm-button dm-button-secondary" type="button" onClick={onEdit}><Icon name="edit" size={16} /> Edit metadata</button>
          <button className="dm-button dm-button-secondary" type="button" onClick={onDownload}><Icon name="download" size={16} /> Download</button>
          {document.status === "active" ? (
            <button className="dm-button button-quiet-warn" type="button" onClick={onArchive}><Icon name="archive" size={16} /> Archive</button>
          ) : (
            <button className="dm-button button-quiet-restore" type="button" onClick={onRestore}><Icon name="restore" size={16} /> Restore</button>
          )}
        </div>
        <div className="drawer-content">
          <section className="dm-detail-section preview-section">
            <div className="section-heading">
              <h3>File preview</h3>
              <span>{hasLocalFile ? "Local file" : "Metadata only"}</span>
            </div>
            {hasLocalFile && ["png", "jpg", "jpeg"].includes(previewKind) ? (
              <div className="preview-image-wrap"><img src={document.file.localPreviewUrl} alt={`Local preview of ${document.name}`} /></div>
            ) : hasLocalFile && previewKind === "pdf" ? (
              <iframe className="pdf-preview-frame" src={document.file.localPreviewUrl} title={`Local PDF preview of ${document.name}`} />
            ) : (
              <div className="preview-placeholder">
                <FileMark document={document} />
                <strong>{document.file.extension ? `${document.file.extension.toUpperCase()} preview unavailable` : "No file attached"}</strong>
                <p>{hasLocalFile ? "This file type does not have an in-page preview." : "This mock record contains file metadata only. No source file is stored."}</p>
              </div>
            )}
            <div className="dm-preview-file-meta">
              <span>{document.file.fileName || "No local file reference"}</span>
              <span>{formatBytes(document.file.sizeBytes)}</span>
            </div>
          </section>

          <section className="dm-detail-section">
            <div className="section-heading"><h3>Document information</h3></div>
            <dl className="detail-info-grid">
              <div><dt>Document ID</dt><dd>{document.id}</dd></div>
              <div><dt>Document type</dt><dd>{document.documentType}</dd></div>
              <div><dt>Category</dt><dd>{document.category}</dd></div>
              <div><dt>Origin module</dt><dd>{document.originModule}</dd></div>
              <div><dt>Creation method</dt><dd><MethodLabel method={document.creationMethod} /></dd></div>
              <div><dt>Document status</dt><dd><StatusBadge status={document.status} /></dd></div>
              <div><dt>File extension</dt><dd>{document.file.extension ? document.file.extension.toUpperCase() : "Not attached"}</dd></div>
              <div><dt>File size</dt><dd>{formatBytes(document.file.sizeBytes)}</dd></div>
              <div><dt>MIME type</dt><dd>{document.file.mimeType ?? "Not available"}</dd></div>
              <div><dt>Created / uploaded</dt><dd>{formatDateTime(document.createdAt)}</dd></div>
              <div><dt>Created / uploaded by</dt><dd>{document.createdBy}</dd></div>
              <div><dt>Last metadata update</dt><dd>{document.updatedAt ? `${formatDateTime(document.updatedAt)} by ${document.updatedBy}` : "No edits recorded"}</dd></div>
            </dl>
            {document.description && <div className="description-block"><h4>Description / notes</h4><p>{document.description}</p></div>}
            {document.tags.length > 0 && <div className="tag-list"><h4>Tags</h4><p>{document.tags.join(", ")}</p></div>}
          </section>

          <section className="dm-detail-section">
            <div className="section-heading"><h3>Primary linked record</h3></div>
            {document.primaryRecord ? (
              <div className="linked-record-panel">
                <span className="linked-record-module">{document.primaryRecord.module} / {document.primaryRecord.recordType}</span>
                <div className="linked-record-title-row">
                  <strong>{document.primaryRecord.recordId}</strong>
                  <button className="text-action" type="button" onClick={() => onOpenRecord(document.primaryRecord!)}>
                    Open record <Icon name="external" size={14} />
                  </button>
                </div>
                <p>{findBusinessRecord(document.primaryRecord)?.description ?? document.primaryRecord.recordLabel}</p>
              </div>
            ) : (
              <div className="no-record-state"><Icon name="link" size={17} /><span>This document is not linked to a primary business record.</span></div>
            )}
          </section>

          <section className="dm-detail-section">
            <div className="section-heading">
              <div><h3>Related records</h3><p>Additional links reference this same document record.</p></div>
              <button className="text-action" type="button" onClick={onEdit}><Icon name="edit" size={14} /> Manage links</button>
            </div>
            {document.relatedRecords.length ? (
              <ul className="detail-related-list">
                {document.relatedRecords.map((reference) => (
                  <li key={recordKey(reference)}>
                    <span className="linked-record-module">{reference.module} / {reference.recordType}</span>
                    <div className="linked-record-title-row">
                      <strong>{reference.recordId}</strong>
                      <button className="text-action" type="button" onClick={() => onOpenRecord(reference)}>
                        Open <Icon name="external" size={14} />
                      </button>
                    </div>
                    <span className="related-record-label">{reference.recordLabel}</span>
                    {reference.relationshipType && <span className="relationship-kind">{reference.relationshipType}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="no-record-state"><Icon name="link" size={17} /><span>No additional records are linked.</span></div>
            )}
          </section>

          {document.relatedEntities.length > 0 && (
            <section className="dm-detail-section">
              <div className="section-heading"><h3>Related entities</h3></div>
              <ul className="entity-detail-list">
                {document.relatedEntities.map((item) => (
                  <li key={`${item.entityType}:${item.entityId}`}>
                    <span>{item.entityType}</span><strong>{item.entityLabel}</strong><small>{item.entityId}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="dm-detail-section activity-section">
            <div className="section-heading"><div><h3>Activity history</h3><p>Mock activity for this local record, not a production audit log.</p></div></div>
            <ol className="dm-activity-timeline">
              {timeline.map((item) => <ActivityEntry key={item.id} activity={item} />)}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}

function ActivityEntry({ activity }: { activity: DocumentActivity }) {
  return (
    <li>
      <span className="activity-marker"><Icon name={activity.action.toLowerCase().includes("download") ? "download" : activity.action.toLowerCase().includes("link") ? "link" : "clock"} size={13} /></span>
      <div className="activity-copy">
        <strong>{activity.action}</strong>
        {activity.detail && <span>{activity.detail}</span>}
        <small>{formatDateTime(activity.at)} / {activity.actor}</small>
      </div>
    </li>
  );
}

function RecordDetailDialog({
  record,
  documents,
  onClose,
  onOpenDocument,
}: {
  record: MockBusinessRecord;
  documents: DocumentRecord[];
  onClose: () => void;
  onOpenDocument: (id: string) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const linkedDocuments = documents.filter((document) =>
    getDocumentReferences(document).some((reference) => recordKey(reference) === recordKey(record.reference)),
  );

  return (
    <div className="dm-modal-backdrop record-modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="record-dialog" role="dialog" aria-modal="true" aria-labelledby="record-dialog-title">
        <div className="dialog-heading">
          <div>
            <span className="dm-eyebrow">{record.reference.module} / {record.reference.recordType}</span>
            <h2 id="record-dialog-title">{record.reference.recordId}</h2>
            <p>{record.reference.recordLabel}</p>
          </div>
          <button className="dm-icon-button dialog-close" type="button" aria-label="Close record detail" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="record-detail-content">
          <div className="record-summary-panel">
            <span className="linked-record-module">{record.reference.module} record</span>
            <p>{record.description}</p>
            <small>This is a mock record detail view. Business data remains represented by its source module.</small>
          </div>
          <section className="record-detail-section">
            <div className="section-heading"><div><h3>Linked documents</h3><p>These are shared registry records, not duplicate attachments.</p></div><span className="record-count">{linkedDocuments.length}</span></div>
            {linkedDocuments.length ? (
              <ul className="record-document-list">
                {linkedDocuments.map((document) => (
                  <li key={document.id}>
                    <FileMark document={document} />
                    <div className="record-document-copy">
                      <button className="document-name-link" type="button" onClick={() => onOpenDocument(document.id)}>{document.name}</button>
                      <span>{document.id} / {document.documentType}</span>
                    </div>
                    <StatusBadge status={document.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="dm-empty-state dm-compact-empty"><span className="dm-empty-state-icon"><Icon name="file" size={20} /></span><strong>No linked documents</strong><p>No document records reference this mock business record.</p></div>
            )}
          </section>
          {record.relatedEntities.length > 0 && (
            <section className="record-detail-section">
              <div className="section-heading"><h3>Related business entities</h3></div>
              <ul className="entity-detail-list">
                {record.relatedEntities.map((item) => (
                  <li key={`${item.entityType}:${item.entityId}`}>
                    <span>{item.entityType}</span><strong>{item.entityLabel}</strong><small>{item.entityId}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {record.relatedEntities.some((item) => item.entityType === "Property") && (
            <div className="mock-navigation-note"><Icon name="info" size={16} /><span>Record navigation is previewed locally; no other module pages or backend records are connected.</span></div>
          )}
        </div>
        <div className="dialog-footer"><button className="dm-button dm-button-secondary" type="button" onClick={onClose}>Close record</button></div>
      </section>
    </div>
  );
}

function ConfirmationDialog({
  confirmation,
  onCancel,
}: {
  confirmation: ConfirmationState;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="dm-modal-backdrop confirm-backdrop">
      <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message">
        <span className="confirm-icon"><Icon name="archive" size={20} /></span>
        <h2 id="confirmation-title">{confirmation.title}</h2>
        <p id="confirmation-message">{confirmation.message}</p>
        <div className="confirm-actions">
          <button className="dm-button dm-button-secondary" type="button" onClick={onCancel}>Cancel</button>
          <button className="dm-button dm-button-primary dm-button-danger" type="button" onClick={confirmation.onConfirm}>{confirmation.confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

export default function DocumentCenter({ notify }: { notify?: (message: string) => void }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>(initialDocuments);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [recordToOpen, setRecordToOpen] = useState<MockBusinessRecord | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const setToast = (message: string) => notify?.(message);

  const activeDocument = documents.find((item) => item.id === selectedDocumentId) ?? null;
  const editingDocument = documents.find((item) => item.id === editingDocumentId) ?? null;

  const propertyOptions = useMemo(
    () => uniqueEntities([...allEntityOptions, ...documents.flatMap((item) => item.relatedEntities)])
      .filter((item) => item.entityType === "Property")
      .sort((a, b) => a.entityLabel.localeCompare(b.entityLabel)),
    [documents],
  );
  const tenantOptions = useMemo(
    () => uniqueEntities([...allEntityOptions, ...documents.flatMap((item) => item.relatedEntities)])
      .filter((item) => item.entityType === "Tenant")
      .sort((a, b) => a.entityLabel.localeCompare(b.entityLabel)),
    [documents],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set([...documentTypeOptions, ...documents.map((item) => item.documentType)])).sort(),
    [documents],
  );

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    const cutoff = new Date(now);
    if (filters.datePreset === "30") cutoff.setDate(now.getDate() - 30);
    if (filters.datePreset === "90") cutoff.setDate(now.getDate() - 90);
    if (filters.datePreset === "year") cutoff.setMonth(0, 1);
    const fromDate = filters.datePreset === "custom" && filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const toDate = filters.datePreset === "custom" && filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;

    return documents.filter((document) => {
      if (filters.status && document.status !== filters.status) return false;
      if (filters.originModule && document.originModule !== filters.originModule) return false;
      if (filters.documentType && document.documentType !== filters.documentType) return false;
      if (filters.creationMethod && document.creationMethod !== filters.creationMethod) return false;
      if (filters.property && !document.relatedEntities.some((item) => item.entityType === "Property" && item.entityId === filters.property)) return false;
      if (filters.tenant && !document.relatedEntities.some((item) => item.entityType === "Tenant" && item.entityId === filters.tenant)) return false;

      const created = new Date(document.createdAt);
      if (["30", "90", "year"].includes(filters.datePreset) && created < cutoff) return false;
      if (fromDate && created < fromDate) return false;
      if (toDate && created > toDate) return false;

      if (query) {
        const referenceText = getDocumentReferences(document)
          .flatMap((item) => [item.module, item.recordType, item.recordId, item.recordLabel])
          .join(" ");
        const entityText = document.relatedEntities
          .flatMap((item) => [item.entityType, item.entityId, item.entityLabel])
          .join(" ");
        const searchText = [
          document.name,
          document.id,
          document.documentType,
          document.originModule,
          document.category,
          document.file.fileName,
          document.file.extension,
          referenceText,
          entityText,
        ].join(" ").toLowerCase();
        if (!searchText.includes(query)) return false;
      }
      return true;
    });
  }, [documents, filters, search]);

  const sortedDocuments = useMemo(() => {
    const valueFor = (document: DocumentRecord): string | number => {
      switch (sortKey) {
        case "name": return document.name.toLocaleLowerCase();
        case "documentType": return document.documentType.toLocaleLowerCase();
        case "originModule": return document.originModule.toLocaleLowerCase();
        case "primaryRecord": return document.primaryRecord ? `${document.primaryRecord.recordId} ${document.primaryRecord.recordLabel}`.toLocaleLowerCase() : "";
        case "relatedEntities": return document.relatedEntities.map((item) => item.entityLabel).join(" ").toLocaleLowerCase();
        case "createdAt": return new Date(document.createdAt).getTime();
        case "creationMethod": return creationMethodLabels[document.creationMethod].toLocaleLowerCase();
        case "createdBy": return document.createdBy.toLocaleLowerCase();
        case "status": return document.status;
      }
    };
    return [...filteredDocuments].sort((a, b) => {
      const left = valueFor(a);
      const right = valueFor(b);
      const result = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredDocuments, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedDocuments.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleDocuments = sortedDocuments.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const summaries = useMemo(() => ({
    total: documents.length,
    generated: documents.filter((item) => item.creationMethod === "system_generated").length,
    uploaded: documents.filter((item) => item.creationMethod === "manual_upload").length,
    archived: documents.filter((item) => item.status === "archived").length,
  }), [documents]);

  const activeFilters = [
    filters.originModule,
    filters.documentType,
    filters.creationMethod,
    filters.property,
    filters.tenant,
    filters.datePreset,
  ].filter(Boolean).length;

  useEffect(() => {
    setPage(1);
  }, [search, filters, pageSize]);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetPopover() {
    setFilters((current) => ({ ...defaultFilters, status: current.status }));
  }

  function clearFilters() {
    setSearch("");
    setFilters({ ...defaultFilters, status: "" });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDirection(key === "createdAt" ? "desc" : "asc");
    }
  }

  function openRecord(reference: RecordReference) {
    const match = findBusinessRecord(reference);
    if (!match) {
      setToast("This linked record is not present in the mock record catalog.");
      return;
    }
    setRecordToOpen(match);
  }

  function downloadDocument(document: DocumentRecord) {
    if (document.file.localPreviewUrl) {
      const anchor = window.document.createElement("a");
      anchor.href = document.file.localPreviewUrl;
      anchor.download = document.file.fileName || document.name;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setToast(`Downloaded the local file for ${document.id}.`);
      const activity: DocumentActivity = {
        id: `${document.id}-download-${Date.now()}`,
        action: "Local file downloaded",
        at: new Date().toISOString(),
        actor: mockActor,
        detail: "Download initiated from this browser session.",
      };
      setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, activity: [...item.activity, activity] } : item));
      return;
    }

    const activity: DocumentActivity = {
      id: `${document.id}-download-${Date.now()}`,
      action: "Download requested (mock)",
      at: new Date().toISOString(),
      actor: mockActor,
      detail: "No original file is stored for this mock record.",
    };
    setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, activity: [...item.activity, activity] } : item));
    setToast("Download simulated. This mock record has metadata only; no original file is stored.");
  }

  function requestArchive(document: DocumentRecord) {
    setConfirmation({
      title: "Archive this document?",
      message: `${document.name} will be hidden from the default active view. Its metadata and record links will remain intact, and no business record will be changed.`,
      confirmLabel: "Archive document",
      onConfirm: () => {
        const now = new Date().toISOString();
        const activity: DocumentActivity = {
          id: `${document.id}-archive-${Date.now()}`,
          action: "Document archived",
          at: now,
          actor: mockActor,
        };
        setDocuments((current) => current.map((item) => item.id === document.id
          ? { ...item, status: "archived", updatedAt: now, updatedBy: mockActor, activity: [...item.activity, activity] }
          : item));
        setConfirmation(null);
        setToast(`${document.id} archived. Linked business records were not changed.`);
      },
    });
  }

  function restoreDocument(document: DocumentRecord) {
    const now = new Date().toISOString();
    const activity: DocumentActivity = {
      id: `${document.id}-restore-${Date.now()}`,
      action: "Document restored",
      at: now,
      actor: mockActor,
    };
    setDocuments((current) => current.map((item) => item.id === document.id
      ? { ...item, status: "active", updatedAt: now, updatedBy: mockActor, activity: [...item.activity, activity] }
      : item));
    setToast(`${document.id} restored to Active.`);
  }

  function exportList() {
    const columns = ["Document ID", "Name", "Type", "Category", "Origin module", "Primary record", "Related records", "Created at", "Creation method", "Created by", "Status"];
    const rows = sortedDocuments.map((document) => [
      document.id,
      document.name,
      document.documentType,
      document.category,
      document.originModule,
      document.primaryRecord ? `${document.primaryRecord.recordId} ${document.primaryRecord.recordLabel}` : "",
      document.relatedRecords.map((item) => item.recordId).join("; "),
      document.createdAt,
      creationMethodLabels[document.creationMethod],
      document.createdBy,
      documentStatuses[document.status],
    ]);
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [columns, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `documents-${new Date().toISOString().slice(0, 10)}.csv`;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setToast(`Exported ${rows.length} document record${rows.length === 1 ? "" : "s"} to CSV.`);
  }

  function saveDocument(values: FormValues, initialDocument: DocumentRecord | null) {
    const now = new Date().toISOString();
    const primary = values.primaryRecordKey ? recordFromKey(values.primaryRecordKey) : null;
    const nextRelated: RelatedRecord[] = values.relatedRecordKeys
      .filter((key) => key !== values.primaryRecordKey)
      .flatMap((key) => {
        const reference = recordFromKey(key);
        if (!reference) return [];
        const previous = initialDocument?.relatedRecords.find((item) => recordKey(item) === key);
        return [{ ...reference, relationshipType: previous?.relationshipType ?? "Related record" }];
      });
    const links = [...(primary ? [primary] : []), ...nextRelated];
    const relatedEntities = entitiesForReferences(links);
    const tags = Array.from(new Set(values.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean)));

    if (initialDocument) {
      const newFile = values.selectedFile;
      const file = newFile ? {
        fileName: newFile.name,
        extension: extensionFor(newFile.name),
        mimeType: newFile.type || undefined,
        sizeBytes: newFile.size,
        localPreviewUrl: URL.createObjectURL(newFile),
      } : initialDocument.file;
      const oldRelatedKeys = initialDocument.relatedRecords.map(recordKey);
      const newRelatedKeys = nextRelated.map(recordKey);
      const activity = [...initialDocument.activity];
      const addActivity = (action: string, detail?: string) => activity.push({
        id: `${initialDocument.id}-edit-${Date.now()}-${activity.length}`,
        action,
        at: now,
        actor: mockActor,
        detail,
      });
      addActivity("Metadata updated");
      if (initialDocument.primaryRecord && primary && recordKey(initialDocument.primaryRecord) !== recordKey(primary)) {
        addActivity("Primary record link updated", `${initialDocument.primaryRecord.recordId} to ${primary.recordId}`);
      } else if (initialDocument.primaryRecord && !primary) {
        addActivity("Primary record link removed", initialDocument.primaryRecord.recordId);
      } else if (!initialDocument.primaryRecord && primary) {
        addActivity("Primary record linked", `${primary.module} / ${primary.recordId}`);
      }
      newRelatedKeys.filter((key) => !oldRelatedKeys.includes(key)).forEach((key) => {
        const reference = recordFromKey(key);
        if (reference) addActivity("Related record linked", `${reference.module} / ${reference.recordId}`);
      });
      oldRelatedKeys.filter((key) => !newRelatedKeys.includes(key)).forEach((key) => {
        const reference = recordFromKey(key);
        if (reference) addActivity("Related record unlinked", `${reference.module} / ${reference.recordId}`);
      });
      if (newFile) addActivity("Local file selected", "File available in this browser session only.");

      const updated: DocumentRecord = {
        ...initialDocument,
        name: values.name.trim(),
        documentType: values.documentType,
        category: values.category,
        originModule: values.originModule,
        creationMethod: values.creationMethod,
        primaryRecord: primary,
        relatedRecords: nextRelated,
        relatedEntities,
        file,
        description: values.description.trim() || undefined,
        tags,
        updatedAt: now,
        updatedBy: mockActor,
        activity,
      };
      setDocuments((current) => current.map((item) => item.id === initialDocument.id ? updated : item));
      setEditingDocumentId(null);
      setToast(`${updated.id} metadata updated.`);
      return;
    }

    const nextNumber = documents.reduce((max, item) => {
      const number = Number(item.id.replace("DOC-", ""));
      return Number.isFinite(number) ? Math.max(max, number) : max;
    }, 0) + 1;
    const id = `DOC-${String(nextNumber).padStart(5, "0")}`;
    const selectedFile = values.selectedFile;
    const file = selectedFile ? {
      fileName: selectedFile.name,
      extension: extensionFor(selectedFile.name),
      mimeType: selectedFile.type || undefined,
      sizeBytes: selectedFile.size,
      localPreviewUrl: URL.createObjectURL(selectedFile),
    } : { fileName: "", extension: "" };
    const methodEvent = selectedFile ? `${creationMethodLabels[values.creationMethod]} file details registered` : "Metadata-only document record added";
    const activity: DocumentActivity[] = [
      { id: `${id}-created`, action: "Document created in registry", at: now, actor: mockActor },
      { id: `${id}-method`, action: methodEvent, at: now, actor: mockActor },
    ];
    if (primary) activity.push({ id: `${id}-primary`, action: "Primary record linked", at: now, actor: mockActor, detail: `${primary.module} / ${primary.recordId}` });
    nextRelated.forEach((reference, index) => activity.push({
      id: `${id}-related-${index}`,
      action: "Related record linked",
      at: now,
      actor: mockActor,
      detail: `${reference.module} / ${reference.recordId}`,
    }));

    const created: DocumentRecord = {
      id,
      name: values.name.trim(),
      documentType: values.documentType,
      category: values.category,
      originModule: values.originModule,
      creationMethod: values.creationMethod,
      primaryRecord: primary,
      relatedRecords: nextRelated,
      relatedEntities,
      file,
      description: values.description.trim() || undefined,
      tags,
      status: "active",
      createdAt: now,
      createdBy: mockActor,
      activity,
    };
    setDocuments((current) => [created, ...current]);
    setIsUploadOpen(false);
    setSelectedDocumentId(id);
    setToast(selectedFile ? `${id} added to the local registry. The file is available in this session only.` : `${id} added to the local registry as a metadata-only record.`);
  }

  function resetUpload() {
    setIsUploadOpen(false);
  }

  return (
    <div className="tn dm">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line">
                  <h1>Document Center</h1>
                  <span className="muted">{summaries.total} documents</span>
                </div>
                <p>Manage, search and access documents across your property management operations. One record can be linked to many business records.</p>
              </div>
              <div className="page-heading-actions">
                <TnButton onClick={exportList}>
                  <Download size={15} />
                  Export list
                </TnButton>
                <TnButton variant="primary" onClick={() => setIsUploadOpen(true)}>
                  <Plus size={17} />
                  Upload document
                </TnButton>
              </div>
            </div>

            <section className="directory-panel" aria-label="Document directory">
              <div className="directory-tabs" aria-label="Filter documents by status">
                {STATUS_TABS.map((t) => (
                  <button
                    key={t.key || "all"}
                    className={`directory-tab ${filters.status === t.key ? "selected" : ""}`}
                    aria-pressed={filters.status === t.key}
                    onClick={() => updateFilter("status", t.key)}
                  >
                    {t.label}
                    <span>{t.key === "active" ? summaries.total - summaries.archived : t.key === "archived" ? summaries.archived : summaries.total}</span>
                  </button>
                ))}
                <div className="directory-tabs-end">
                  <span className="live-dot" />
                  Demo data
                </div>
              </div>
              <div className="directory-toolbar">
                <SearchField
                  label="Search documents"
                  placeholder="Search documents, IDs, tenants, properties or linked records..."
                  value={search}
                  onChange={setSearch}
                />
                <div className="toolbar-actions">
                  <FilterPopover title="Filter documents" count={activeFilters} onReset={resetPopover}>
                    <FilterField id="doc-origin-filter" label="Origin module">
                      <select id="doc-origin-filter" value={filters.originModule} onChange={(e) => updateFilter("originModule", e.target.value)}>
                        <option value="">All modules</option>
                        {originModuleRegistry.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="doc-type-filter" label="Document type">
                      <select id="doc-type-filter" value={filters.documentType} onChange={(e) => updateFilter("documentType", e.target.value)}>
                        <option value="">All types</option>
                        {typeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="doc-method-filter" label="Creation method">
                      <select id="doc-method-filter" value={filters.creationMethod} onChange={(e) => updateFilter("creationMethod", e.target.value)}>
                        <option value="">All methods</option>
                        {creationMethodValues.map((method) => <option key={method} value={method}>{creationMethodLabels[method]}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="doc-property-filter" label="Property">
                      <select id="doc-property-filter" value={filters.property} onChange={(e) => updateFilter("property", e.target.value)}>
                        <option value="">All properties</option>
                        {propertyOptions.map((item) => <option key={item.entityId} value={item.entityId}>{item.entityLabel}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="doc-tenant-filter" label="Tenant">
                      <select id="doc-tenant-filter" value={filters.tenant} onChange={(e) => updateFilter("tenant", e.target.value)}>
                        <option value="">All tenants</option>
                        {tenantOptions.map((item) => <option key={item.entityId} value={item.entityId}>{item.entityLabel}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="doc-date-filter" label="Date range">
                      <select id="doc-date-filter" value={filters.datePreset} onChange={(e) => updateFilter("datePreset", e.target.value)}>
                        <option value="">Any time</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="year">This year</option>
                        <option value="custom">Custom range</option>
                      </select>
                    </FilterField>
                    {filters.datePreset === "custom" && (
                      <>
                        <FilterField id="doc-from-filter" label="Created on or after">
                          <input id="doc-from-filter" type="date" value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} />
                        </FilterField>
                        <FilterField id="doc-to-filter" label="Created on or before">
                          <input id="doc-to-filter" type="date" value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} />
                        </FilterField>
                      </>
                    )}
                  </FilterPopover>
                  <label className="sort-control" style={{ minWidth: 70 }}>
                    <span className="sr-only">Rows per page</span>
                    <select aria-label="Rows per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                      <option value={8}>8 rows</option>
                      <option value={12}>12 rows</option>
                      <option value={20}>20 rows</option>
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
              </div>

              {visibleDocuments.length > 0 ? (
                <>
                  <div className="tenant-table-wrap">
                    <table className="tenant-table">
                      <caption className="sr-only">Document register. Open a document to see its details, linked records and activity.</caption>
                      <thead>
                        <tr>
                          <SortableHeader label="Document name" column="name" current={sortKey} direction={sortDirection} onSort={handleSort} />
                          <SortableHeader label="Document type" column="documentType" current={sortKey} direction={sortDirection} onSort={handleSort} />
                          <SortableHeader label="Origin module" column="originModule" current={sortKey} direction={sortDirection} onSort={handleSort} />
                          <SortableHeader label="Primary linked record" column="primaryRecord" current={sortKey} direction={sortDirection} onSort={handleSort} />
                          <SortableHeader label="Related entities" column="relatedEntities" current={sortKey} direction={sortDirection} onSort={handleSort} />
                          <SortableHeader label="Created / uploaded" column="createdAt" current={sortKey} direction={sortDirection} onSort={handleSort} />
                          <SortableHeader label="Creation method" column="creationMethod" current={sortKey} direction={sortDirection} onSort={handleSort} />
                          <SortableHeader label="Created by" column="createdBy" current={sortKey} direction={sortDirection} onSort={handleSort} />
                          <SortableHeader label="Status" column="status" current={sortKey} direction={sortDirection} onSort={handleSort} />
                          <th><span className="action-heading">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleDocuments.map((document) => (
                          <tr key={document.id}>
                            <td className="document-name-cell">
                              <div className="document-name-wrap">
                                <FileMark document={document} />
                                <div className="document-name-copy">
                                  <button className="document-name-link" type="button" onClick={() => setSelectedDocumentId(document.id)}>{document.name}</button>
                                  <span>{document.id}{document.file.extension ? ` / ${document.file.extension.toUpperCase()}` : " / metadata only"}</span>
                                </div>
                              </div>
                            </td>
                            <td><span className="type-cell">{document.documentType}</span><small className="table-secondary">{document.category}</small></td>
                            <td><span className="origin-label">{document.originModule}</span></td>
                            <td>
                              {document.primaryRecord ? (
                                <><RecordLink reference={document.primaryRecord} onOpen={openRecord} /><small className="table-secondary">{document.primaryRecord.recordType}</small></>
                              ) : <span className="muted-text">No primary record</span>}
                            </td>
                            <td><RelatedEntitySummary entities={document.relatedEntities} /></td>
                            <td><span className="date-cell">{formatDate(document.createdAt)}</span></td>
                            <td><MethodLabel method={document.creationMethod} /></td>
                            <td><span className="creator-cell">{document.createdBy}</span></td>
                            <td><StatusBadge status={document.status} /></td>
                            <td>
                              <DocumentActions
                                document={document}
                                onView={() => setSelectedDocumentId(document.id)}
                                onEdit={() => setEditingDocumentId(document.id)}
                                onDownload={() => downloadDocument(document)}
                                onArchive={() => requestArchive(document)}
                                onRestore={() => restoreDocument(document)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-pagination">
                    <p>Showing <strong>{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sortedDocuments.length)}</strong> of <strong>{sortedDocuments.length}</strong> documents</p>
                    <div className="pagination-controls">
                      <div className="pagination-buttons">
                        <IconButton label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(Math.max(1, currentPage - 1))}><ChevronLeft size={15} /></IconButton>
                        <span className="page-number selected" aria-current="page">{currentPage}</span>
                        <span className="muted">of {totalPages}</span>
                        <IconButton label="Next page" disabled={currentPage >= totalPages} onClick={() => setPage(Math.min(totalPages, currentPage + 1))}><ChevronRight size={15} /></IconButton>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  title={documents.length === 0 ? "No documents yet" : "No documents match"}
                  description={documents.length === 0 ? "Upload a document or create a metadata-only record to begin your central register." : "Try another search, adjust your filters, or clear them to see more documents."}
                  action={
                    documents.length === 0
                      ? <TnButton variant="primary" onClick={() => setIsUploadOpen(true)}>Upload document</TnButton>
                      : <TnButton onClick={clearFilters}>Clear search & filters</TnButton>
                  }
                />
              )}
            </section>

            <div className="directory-footnote">
              <span><Info size={13} />Mock registry data. Metadata changes are held in memory for this session; no backend or permanent file storage is connected.</span>
            </div>
          </main>
        </div>
      </div>

      {isUploadOpen && <DocumentFormDialog initialDocument={null} onClose={resetUpload} onSave={saveDocument} />}
      {editingDocument && <DocumentFormDialog initialDocument={editingDocument} onClose={() => setEditingDocumentId(null)} onSave={saveDocument} />}
      {activeDocument && (
        <DetailDrawer
          document={activeDocument}
          isCovered={Boolean(editingDocument) || Boolean(recordToOpen) || Boolean(confirmation)}
          onClose={() => setSelectedDocumentId(null)}
          onEdit={() => { setSelectedDocumentId(null); setEditingDocumentId(activeDocument.id); }}
          onDownload={() => downloadDocument(activeDocument)}
          onArchive={() => { setSelectedDocumentId(null); requestArchive(activeDocument); }}
          onRestore={() => restoreDocument(activeDocument)}
          onOpenRecord={openRecord}
        />
      )}
      {recordToOpen && <RecordDetailDialog record={recordToOpen} documents={documents} onClose={() => setRecordToOpen(null)} onOpenDocument={(id) => { setRecordToOpen(null); setSelectedDocumentId(id); }} />}
      {confirmation && <ConfirmationDialog confirmation={confirmation} onCancel={() => setConfirmation(null)} />}
    </div>
  );
}
