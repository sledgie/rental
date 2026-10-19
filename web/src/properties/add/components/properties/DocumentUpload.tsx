import { useRef, useState, type DragEvent } from "react";
import { CalendarClock, FileText, Trash2, UploadCloud } from "lucide-react";
import { Field } from "../ui/Field";
import { Input, Select } from "../ui/Input";
import { DOCUMENT_CATEGORIES } from "../../data/mockProperties";
import type { PropertyDocument } from "../../types/property";
import { cn } from "../../utils/cn";
import type { SectionProps } from "./PropertyFormSection";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUpload({ form, set }: SectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState(DOCUMENT_CATEGORIES[0]);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const now = new Date().toISOString();
    const docs: PropertyDocument[] = Array.from(files).map((f, i) => ({
      id: `doc-${Date.now()}-${i}`,
      fileName: f.name,
      fileSize: f.size,
      category,
      uploadDate: now,
    }));
    set("documents", [...form.documents, ...docs]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const updateDoc = (id: string, patch: Partial<PropertyDocument>) => {
    set("documents", form.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDoc = (id: string) => {
    set("documents", form.documents.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-4">
      <Field label="Document Category" htmlFor="docCategory" hint="New uploads are filed under this category.">
        <Select
          id="docCategory"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="md:max-w-xs"
        >
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </Field>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload documents"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging
            ? "border-mint-500 bg-mint-500/10"
            : "border-moss-700 bg-moss-900/60 hover:border-mint-500/50"
        )}
      >
        <UploadCloud size={28} className={dragging ? "text-mint-400" : "text-moss-500"} />
        <p className="text-sm font-medium text-moss-200">
          Drag & drop files here, or <span className="text-mint-400">browse</span>
        </p>
        <p className="text-xs text-moss-500">
          PDF, images, and office documents · Simulated upload for this prototype
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {form.documents.length > 0 && (
        <ul className="space-y-3">
          {form.documents.map((doc) => (
            <li key={doc.id} className="rounded-lg border border-moss-800 bg-moss-900/70 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-moss-800 text-mint-400">
                  <FileText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-moss-100">{doc.fileName}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-moss-500">
                    <span>{formatSize(doc.fileSize)}</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={11} />
                      Uploaded {new Date(doc.uploadDate).toLocaleDateString()}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeDoc(doc.id)}
                  aria-label={`Remove ${doc.fileName}`}
                  className="rounded-md p-1.5 text-moss-500 transition-colors hover:bg-moss-800 hover:text-brick-400"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Category">
                  <Select
                    aria-label={`Category for ${doc.fileName}`}
                    value={doc.category}
                    onChange={(e) => updateDoc(doc.id, { category: e.target.value })}
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Expiry Date">
                  <Input
                    aria-label={`Expiry date for ${doc.fileName}`}
                    type="date"
                    value={doc.expiryDate ?? ""}
                    onChange={(e) => updateDoc(doc.id, { expiryDate: e.target.value })}
                    className="[color-scheme:dark]"
                  />
                </Field>
                <Field label="Notes">
                  <Input
                    aria-label={`Notes for ${doc.fileName}`}
                    value={doc.notes ?? ""}
                    onChange={(e) => updateDoc(doc.id, { notes: e.target.value })}
                    placeholder="Optional note…"
                  />
                </Field>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
