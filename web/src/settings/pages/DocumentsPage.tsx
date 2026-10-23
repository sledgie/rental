import { Archive, Check, FileArchive, FileSignature, FileText, FolderOpen, Info, Lock, Mail, PenLine, ShieldAlert, Tags, UploadCloud } from "lucide-react";
import { LEASE_TEMPLATES } from "../mockSettings";
import type { PageProps } from "../types";
import { Badge, Callout, Card, CardBody, CardHeader, Field, Input, ListEditor, Select, SettingRow, Toggle } from "../components/ui";

const FILE_TYPES = ["PDF", "DOCX", "XLSX", "JPG", "PNG", "HEIC"];
const TOKENS = ["{property}", "{tenant}", "{documentType}", "{date}"];

export default function DocumentsPage({ value, update, readOnly, errors }: PageProps) {
  const types: string[] = value.allowedTypes ?? [];
  const toggleType = (type: string) => {
    update("allowedTypes", types.includes(type) ? types.filter((entry) => entry !== type) : [...types, type]);
  };
  const preview = (value.namingConvention ?? "")
    .replace(/{property}/g, "Maple-Court")
    .replace(/{tenant}/g, "J-Rivera")
    .replace(/{documentType}/g, "Lease")
    .replace(/{date}/g, new Date().toISOString().slice(0, 10)) + ".pdf";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card id="doc-categories">
          <CardHeader
            icon={Tags}
            title="Default document categories"
            description="Categories available when organizing uploaded documents. Disabled categories remain on existing files."
            aside={<Badge tone="blue">Organization-wide</Badge>}
          />
          <CardBody>
            <Field error={errors.categories}>
              <ListEditor
                items={value.categories ?? []}
                onChange={(items) => update("categories", items)}
                readOnly={readOnly}
                allowDisable
                placeholder="Add a document category"
                addLabel="Add category"
                emptyLabel="No document categories configured."
              />
            </Field>
          </CardBody>
        </Card>

        <Card id="doc-naming">
          <CardHeader icon={FileText} title="Templates & naming" description="How new files are named and which lease template is offered first." />
          <CardBody className="space-y-4">
            <Field label="Default lease template" error={errors.leaseTemplate}>
              <Select value={value.leaseTemplate} disabled={readOnly} invalid={!!errors.leaseTemplate} onChange={(event) => update("leaseTemplate", event.target.value)}>
                {LEASE_TEMPLATES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Document naming convention" error={errors.namingConvention} hint="Tokens are replaced when a file is uploaded.">
              <Input value={value.namingConvention} disabled={readOnly} invalid={!!errors.namingConvention} onChange={(event) => update("namingConvention", event.target.value)} className="font-mono text-[12px]" />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  disabled={readOnly}
                  onClick={() => update("namingConvention", `${value.namingConvention ?? ""}${value.namingConvention?.endsWith("_") ? "" : "_"}${token}`)}
                  className="rounded-md border border-u-line bg-u-s2 px-1.5 py-0.5 font-mono text-[10.5px] text-u-ink2 transition hover:border-u-accent/30 hover:text-u-accent disabled:opacity-50   "
                >
                  {token}
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-dashed border-u-line bg-u-s2/60 px-3 py-2.5  ">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">File name preview</p>
              <p className="mt-1 break-all font-mono text-[11.5px] text-u-ink2 ">{preview}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card id="doc-uploads">
          <CardHeader icon={UploadCloud} title="Upload rules" description="Accepted file formats and the prototype upload size limit." />
          <CardBody className="space-y-4">
            <Field label="Allowed upload file types" error={errors.allowedTypes}>
              <div className="flex flex-wrap gap-1.5">
                {FILE_TYPES.map((type) => {
                  const active = types.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={active}
                      onClick={() => toggleType(type)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition disabled:opacity-50 ${
                        active
                          ? "border-u-accent/60 bg-u-accent-soft text-u-accent   "
                          : "border-u-line bg-u-card text-u-muted hover:border-u-line2   "
                      }`}
                    >
                      {active ? <Check className="h-3 w-3" /> : null}
                      {type}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Maximum upload size (MB)" error={errors.maxUploadMb} hint="Prototype limit only. Files are never uploaded to a server.">
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={100} value={value.maxUploadMb} disabled={readOnly} invalid={!!errors.maxUploadMb} onChange={(event) => update("maxUploadMb", Number(event.target.value))} className="w-28" />
                <span className="text-[11.5px] text-u-muted">MB per file</span>
              </div>
            </Field>
            <div className="flex items-start gap-2 rounded-lg bg-u-s2 px-3 py-2.5 text-[11.5px] leading-relaxed text-u-muted  ">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Larger files are rejected at upload time. No real files are stored beyond the local logo preview.
            </div>
          </CardBody>
        </Card>

        <Card id="doc-retention">
          <CardHeader icon={Archive} title="Retention & access" description="How documents are retained, accessed and archived." />
          <CardBody className="divide-y divide-u-line py-0 ">
            <SettingRow title="Retention policy" description="Minimum retention for lease and tenant documents.">
              <Select value={value.retentionPolicy} disabled={readOnly} onChange={(event) => update("retentionPolicy", event.target.value)} className="h-8.5 w-[190px] text-[12px]">
                {["3 years after lease end", "5 years after lease end", "7 years after lease end", "Indefinitely", "Custom policy"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </SettingRow>
            <SettingRow title="Document reminder timing" description="Remind staff before required documents expire.">
              <div className="flex items-center gap-1.5">
                <Input type="number" min={1} max={120} value={value.reminderDays} disabled={readOnly} onChange={(event) => update("reminderDays", Number(event.target.value))} className="h-8.5 w-16 text-center" />
                <span className="text-[11px] text-u-muted">days</span>
              </div>
            </SettingRow>
            <SettingRow title="Default document access" description="Who can open uploaded documents by default." icon={Lock}>
              <Select value={value.accessDefault} disabled={readOnly} onChange={(event) => update("accessDefault", event.target.value)} className="h-8.5 w-[180px] text-[12px]">
                {["Organization members", "Owners & Administrators", "Property team only", "Custom per document"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </SettingRow>
            <SettingRow title="Archive signed documents" description="Move fully executed documents into the archive automatically.">
              <Toggle label="Archive signed documents" checked={!!value.archiveSigned} disabled={readOnly} onChange={(checked) => update("archiveSigned", checked)} />
            </SettingRow>
            <SettingRow title="Archive location">
              <Select value={value.archiveLocation} disabled={readOnly || !value.archiveSigned} onChange={(event) => update("archiveLocation", event.target.value)} className="h-8.5 w-[190px] text-[12px]">
                {["Organization file storage", "Property document folder", "Compliance archive"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </SettingRow>
          </CardBody>
        </Card>
      </div>

      <Card id="doc-esign">
        <CardHeader
          icon={FileSignature}
          title="E-signatures"
          description="Defaults for signature requests and signer reminders."
          aside={<Badge tone="gray" dot>Provider not connected</Badge>}
        />
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-u-line bg-u-s2/50 px-4 py-3  ">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-u-card text-u-muted ring-1 ring-u-line   ">
                <PenLine className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[12.5px] font-medium text-u-ink ">E-signature provider: Not connected</p>
                <p className="mt-0.5 text-[11.5px] text-u-muted ">
                  Signature requests are simulated. No e-signature provider is connected, and requests are not legally verified or enforceable.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Signature request expiration (days)" error={errors.signatureExpiryDays}>
              <Input type="number" min={1} max={365} value={value.signatureExpiryDays} disabled={readOnly} invalid={!!errors.signatureExpiryDays} onChange={(event) => update("signatureExpiryDays", Number(event.target.value))} />
            </Field>
            <Field label="Signer reminder interval (days)" error={errors.signerReminderDays}>
              <Input type="number" min={1} max={30} value={value.signerReminderDays} disabled={readOnly} invalid={!!errors.signerReminderDays} onChange={(event) => update("signerReminderDays", Number(event.target.value))} />
            </Field>
          </div>
          <Callout tone="warning" icon={ShieldAlert} title="Simulation disclaimer">
            A simulated signature is not legally verified or enforceable. This prototype does not generate signed documents or collect real signatures.
          </Callout>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="flex items-center gap-2 text-[11.5px] text-u-muted ">
          <FileArchive className="h-3.5 w-3.5" /> {value.archiveSigned ? "Signed documents archive automatically." : "Signed documents remain in their original folder."}
        </p>
        <div className="flex items-center gap-3 text-[11.5px] text-u-muted ">
          <span className="flex items-center gap-1"><FolderOpen className="h-3.5 w-3.5" /> {value.categories?.length ?? 0} categories</span>
          <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Reminders in {value.reminderDays} days</span>
        </div>
      </div>
    </div>
  );
}
