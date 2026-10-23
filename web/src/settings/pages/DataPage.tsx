import { isSupabaseConfigured } from "../../lib/supabase";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  Lock,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { CATEGORY_MAP, SETTINGS_CATEGORIES } from "../catalog";
import { useSettings } from "../store";
import type { CategoryId, PageProps } from "../types";
import { downloadFile, toCsv } from "../utils";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Field, Input, Modal, Select, SettingRow, Toggle } from "../components/ui";

type ImportPreview = {
  filename: string;
  categories: CategoryId[];
  data: Record<string, any>;
  fieldCount: number;
  warnings: string[];
};

export default function DataPage({ value, update, readOnly, errors, org, activity, notify }: PageProps) {
  const { exportSettings, importSettings, role, addActivity, orgSettings, defaults } = useSettings();
  const orgDisplayName = orgSettings.organization?.displayName?.trim() || org.name;
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [closureText, setClosureText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isOwner = role === "Owner";

  const simulate = async (key: string, work: () => void) => {
    setBusy(key);
    await new Promise((resolve) => setTimeout(resolve, 750));
    work();
    setBusy(null);
  };

  const exportConfig = () =>
    simulate("config", () => {
      const payload = exportSettings();
      downloadFile(`rentora-${org.id}-settings-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
      addActivity("Exported organization configuration", "JSON · export generated locally in the browser", "data");
      notify("Organization configuration exported", "success", "JSON download generated locally. No records or credentials are included.");
    });

  const exportReference = () =>
    simulate("reference", () => {
      const rows = [
        { type: "chart_of_accounts", name: value.chartOfAccounts ?? "Standard property chart", detail: "Accounting reference" },
        { type: "income_account", name: "4100 · Rental income", detail: "Income" },
        { type: "expense_account", name: "6300 · Repairs & maintenance", detail: "Expense" },
        { type: "lease_template", name: "Standard residential lease (v4)", detail: "Document template" },
        { type: "maintenance_category", name: "Plumbing", detail: "Maintenance category" },
        { type: "maintenance_category", name: "Electrical", detail: "Maintenance category" },
        { type: "project_category", name: "Interior renovation", detail: "Project category" },
        { type: "currency", name: "USD — US Dollar", detail: "Currency" },
      ];
      downloadFile(`rentora-${org.id}-reference-data.csv`, toCsv(rows), "text/csv");
      addActivity("Exported mock reference data", "CSV · accounts, categories and templates", "data");
      notify("Mock reference data exported", "success", "CSV download generated locally.");
    });

  const exportActivity = () =>
    simulate("activity", () => {
      const rows = activity.map((event) => ({
        timestamp: event.at,
        actor: event.actor,
        organization: org.name,
        event: event.action,
        detail: event.detail ?? "",
      }));
      downloadFile(`rentora-${org.id}-activity-log.csv`, toCsv(rows), "text/csv");
      addActivity("Exported activity log", `CSV · ${rows.length} mock events`, "data");
      notify("Activity log exported", "success", `${rows.length} mock activity events included.`);
    });

  const readImport = (file?: File) => {
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      notify("Unsupported file", "error", "Import a JSON configuration exported from this prototype.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const settings = parsed?.settings ?? parsed;
        if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("invalid");
        const warnings: string[] = [];
        const cleanData: Record<string, any> = {};
        const categories: CategoryId[] = [];
        const isPlainObject = (input: unknown): input is Record<string, any> =>
          !!input && typeof input === "object" && !Array.isArray(input);
        SETTINGS_CATEGORIES.filter((category) => category.scope === "organization").forEach((category) => {
          const importedCategory = settings[category.id];
          if (importedCategory === undefined) return;
          if (!isPlainObject(importedCategory)) {
            warnings.push(`${category.label}: skipped because the category is not a settings object.`);
            return;
          }
          const defaultsCategory = defaults[category.id] ?? {};
          const clean: Record<string, any> = {};
          let dropped = 0;
          Object.entries(defaultsCategory).forEach(([key, defaultValue]) => {
            if (!(key in importedCategory)) return;
            const nextValue = importedCategory[key];
            let valid = false;
            if (Array.isArray(defaultValue)) {
              const objectItems = defaultValue.some((entry) => entry && typeof entry === "object");
              valid = Array.isArray(nextValue) && (objectItems
                ? nextValue.every((entry) => isPlainObject(entry) && typeof entry.id === "string" && typeof entry.label === "string")
                : nextValue.every((entry) => typeof entry === typeof (defaultValue[0] ?? "")));
            } else if (isPlainObject(defaultValue)) {
              valid = isPlainObject(nextValue);
            } else {
              valid = typeof nextValue === typeof defaultValue;
            }
            if (valid) clean[key] = nextValue;
            else dropped += 1;
          });
          dropped += Object.keys(importedCategory).filter((key) => !(key in defaultsCategory)).length;
          if (Object.keys(clean).length) {
            cleanData[category.id] = clean;
            categories.push(category.id);
          }
          if (dropped) warnings.push(`${category.label}: ${dropped} unsupported or malformed field${dropped === 1 ? "" : "s"} ignored.`);
        });
        if (!categories.length) {
          notify("No supported settings found", "error", "The file does not contain recognizable organization settings.");
          return;
        }
        if (parsed?.exportType && parsed.exportType !== "rentora.settings.prototype") warnings.push("Export type is unfamiliar; supported category keys were still detected.");
        if (categories.includes("security")) warnings.push("Security permissions will be replaced by the imported values. The Owner column remains protected.");
        const fieldCount = categories.reduce((total, category) => total + Object.keys(cleanData[category] ?? {}).length, 0);
        setPreview({ filename: file.name, categories, data: cleanData, fieldCount, warnings });
      } catch {
        notify("Could not read this file", "error", "The JSON is invalid or not a settings export.");
      }
    };
    reader.readAsText(file);
  };

  const applyImport = () => {
    if (!preview) return;
    setBusy("import");
    setTimeout(() => {
      importSettings(preview.categories, preview.data);
      setBusy(null);
      setConfirmImport(false);
      setPreview(null);
      notify(isSupabaseConfigured ? "Settings imported" : "Mock settings imported", "success", `${preview.categories.length} categories updated. Unrelated settings were preserved.`);
    }, 850);
  };

  return (
    <div className="space-y-5">
      <Callout tone="info" icon={Database} title={isSupabaseConfigured ? "Organization data" : "Browser-scoped prototype data"}>
        {isSupabaseConfigured ? "Organization settings and their history are saved to your organization. Exports are generated in your browser from what is saved." : "Organization settings and activity history are stored in localStorage for this demo. There is no database, backup service or production data processing. Exports are generated entirely in your browser."}
      </Callout>

      <Card id="data-exports">
        <CardHeader
          icon={Download}
          title="Exports"
          description="Download organization configuration and mock reference data as local files."
          aside={<Badge tone="gray">Safe · client-side</Badge>}
        />
        <CardBody className="grid gap-3 md:grid-cols-3">
          {[
            {
              key: "config",
              icon: FileJson,
              title: "Organization configuration",
              description: "All organization-scoped settings as a versioned JSON file.",
              action: exportConfig,
              label: "Export JSON",
              meta: "No credentials",
            },
            {
              key: "reference",
              icon: FileSpreadsheet,
              title: "Mock reference data",
              description: "Accounts, categories, templates and currencies.",
              action: exportReference,
              label: "Export CSV",
              meta: "8 sample rows",
            },
            {
              key: "activity",
              icon: FileText,
              title: "Activity log",
              description: "Mock administrative events with actor and timestamp.",
              action: exportActivity,
              label: "Export CSV",
              meta: `${activity.length} events`,
            },
          ].map((item) => (
            <div key={item.key} className="flex flex-col rounded-xl border border-u-line p-4 ">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-u-s2 text-u-muted ring-1 ring-u-line/70   ">
                <item.icon className="h-4 w-4" />
              </span>
              <p className="mt-2.5 text-[12.5px] font-semibold text-u-ink ">{item.title}</p>
              <p className="mt-1 flex-1 text-[11.5px] leading-relaxed text-u-muted ">{item.description}</p>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-u-muted">{item.meta}</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={busy === item.key ? Loader2 : Download}
                loading={busy === item.key}
                disabled={readOnly || busy !== null}
                onClick={item.action}
                className="mt-2.5 w-full"
              >
                {item.label}
              </Button>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card id="data-import">
        <CardHeader
          icon={Upload}
          title="Import mock configuration"
          description="Preview supported organization settings before applying them. Imports never include live records."
          aside={<Badge tone="amber">Preview required</Badge>}
        />
        <CardBody className="space-y-4">
          <input ref={fileRef} id="settings-import" type="file" accept="application/json,.json" disabled={readOnly} onChange={(event) => { readImport(event.target.files?.[0]); event.target.value = ""; }} />
          {!preview ? (
            <button
              type="button"
              disabled={readOnly}
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-u-line2 bg-u-s2/40 px-6 py-8 text-center transition hover:border-u-accent/60 hover:bg-u-accent-soft/30 disabled:cursor-not-allowed disabled:opacity-60    "
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-u-card text-u-muted ring-1 ring-u-line  ">
                <Upload className="h-5 w-5" />
              </span>
              <span className="mt-2 text-[12.5px] font-medium text-u-ink2 ">Choose a JSON settings export</span>
              <span className="mt-1 text-[11.5px] text-u-muted">Only organization-scoped categories are supported. Nothing is applied until confirmed.</span>
            </button>
          ) : (
            <div className="rounded-xl border border-u-line ">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-line bg-u-s2/60 px-4 py-2.5  ">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-u-accent " />
                  <div>
                    <p className="text-[12px] font-medium text-u-ink ">{preview.filename}</p>
                    <p className="text-[10.5px] text-u-muted">{preview.categories.length} categories · {preview.fieldCount} fields detected</p>
                  </div>
                </div>
                <button type="button" onClick={() => setPreview(null)} className="inline-flex items-center gap-1 text-[11.5px] text-u-muted hover:text-u-ink  ">
                  <X className="h-3 w-3" /> Clear
                </button>
              </div>
              <div className="divide-y divide-u-line ">
                {preview.categories.map((category) => (
                  <div key={category} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="flex items-center gap-2 text-[12px] text-u-ink2 ">
                      <CheckCircle2 className="h-3.5 w-3.5 text-u-ok" />
                      {CATEGORY_MAP[category].label}
                    </span>
                    <span className="text-[10.5px] text-u-muted">{Object.keys(preview.data[category] ?? {}).length} fields</span>
                  </div>
                ))}
              </div>
              {preview.warnings.length ? (
                <div className="space-y-1 border-t border-u-warn/30 bg-u-warn-soft/60 px-4 py-2.5  ">
                  {preview.warnings.map((warning) => (
                    <p key={warning} className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-u-warn ">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {warning}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2 border-t border-u-line px-4 py-3 ">
                <p className="text-[10.5px] text-u-muted">Saving replaces only the imported categories.</p>
                <Button type="button" size="sm" variant="primary" disabled={readOnly} onClick={() => setConfirmImport(true)}>Apply import</Button>
              </div>
            </div>
          )}
          <p className="flex items-center gap-1.5 text-[11px] text-u-muted">
            <Lock className="h-3 w-3" /> Supported: organization settings exported from this prototype. Personal preferences are never imported.
          </p>
        </CardBody>
      </Card>

      <Card id="data-retention">
        <CardHeader icon={Archive} title="Retention & archive policy" description="How long mock records and activity history should be retained." />
        <CardBody className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Organization data retention (years)" error={errors.retentionYears}>
              <Input type="number" min={1} max={25} value={value.retentionYears} disabled={readOnly} invalid={!!errors.retentionYears} onChange={(event) => update("retentionYears", Number(event.target.value))} />
            </Field>
            <Field label="Activity history retention (months)" error={errors.activityRetentionMonths}>
              <Input type="number" min={1} max={120} value={value.activityRetentionMonths} disabled={readOnly} invalid={!!errors.activityRetentionMonths} onChange={(event) => update("activityRetentionMonths", Number(event.target.value))} />
            </Field>
            <Field label="Default export format">
              <Select value={value.exportFormat} disabled={readOnly} onChange={(event) => update("exportFormat", event.target.value)}>
                {["JSON", "CSV"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="divide-y divide-u-line ">
            <SettingRow title="Archive inactive properties" description="Move records to read-only archive after a period of inactivity.">
              <Toggle label="Archive inactive properties" checked={!!value.archiveInactiveProperties} disabled={readOnly} onChange={(checked) => update("archiveInactiveProperties", checked)} />
            </SettingRow>
            <SettingRow title="Archive after (months)">
              <Input type="number" min={1} max={60} value={value.archiveAfterMonths} disabled={readOnly || !value.archiveInactiveProperties} onChange={(event) => update("archiveAfterMonths", Number(event.target.value))} className="h-8.5 w-20 text-center" />
            </SettingRow>
            <SettingRow title="Keep a copy of exported audit data" description="Retain a mock local indicator when activity data is exported.">
              <Toggle label="Keep exported audit copy" checked={!!value.keepExportedAuditCopy} disabled={readOnly} onChange={(checked) => update("keepExportedAuditCopy", checked)} />
            </SettingRow>
          </div>
          <Callout tone="neutral" icon={Archive}>
            Retention and archive values are illustrative. No records are deleted or moved by this frontend prototype.
          </Callout>
        </CardBody>
      </Card>

      <Card id="data-closure" className="border-u-danger/80 ">
        <CardHeader
          icon={ShieldAlert}
          title="Organization closure"
          description="Permanently closing an organization is not available in this prototype."
          aside={<Badge tone="red">Danger zone</Badge>}
        />
        <CardBody className="space-y-4">
          <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft/50 p-4  ">
            <p className="text-[12.5px] font-semibold text-u-danger ">Before requesting closure</p>
            <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-u-danger/80 ">
              <li>• Export the organization configuration and activity log.</li>
              <li>• Owners must resolve all financial records and active leases.</li>
              <li>• Organization closure cannot be undone in a production system.</li>
              <li>• This prototype will not delete stored browser data.</li>
            </ul>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-u-ink ">Simulate a closure request</p>
              <p className="mt-0.5 text-[11px] text-u-muted ">
                {isOwner ? "Owner access required. A confirmation and typed organization name are required." : "Only an Owner can request organization closure."}
              </p>
            </div>
            <Button type="button" variant="danger" icon={ShieldAlert} disabled={!isOwner || readOnly} onClick={() => { setClosureText(""); setClosureOpen(true); }}>
              Request closure
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={confirmImport}
        onClose={() => setConfirmImport(false)}
        title="Apply imported settings?"
        description="This replaces the detected categories for the active organization only."
        icon={Upload}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirmImport(false)}>Cancel</Button>
            <Button type="button" variant="primary" loading={busy === "import"} onClick={applyImport}>Confirm import</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[12.5px] leading-relaxed text-u-ink2 ">
            {preview?.categories.length ?? 0} categories from <span className="font-medium">{preview?.filename}</span> will replace their current saved values. Other categories remain untouched.
          </p>
          <Callout tone="warning" icon={AlertTriangle}>
            {isSupabaseConfigured ? "Only the selected settings categories are replaced. No rental records are created, updated or deleted." : "This is a mock import. No real rental records will be created, updated or deleted."}
          </Callout>
        </div>
      </Modal>

      <Modal
        open={closureOpen}
        onClose={() => setClosureOpen(false)}
        title="Request organization closure"
        description="Simulation only — no data will be deleted."
        icon={ShieldAlert}
        size="sm"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setClosureOpen(false)}>Cancel</Button>
            <Button
              type="button"
              variant="danger"
              disabled={closureText !== orgDisplayName}
              onClick={() => {
                setClosureOpen(false);
                addActivity("Requested simulated organization closure", "No data was deleted by this prototype", "data");
                notify("Closure request simulated", "info", "No data was deleted. A production workflow would require owner verification.");
              }}
            >
              Simulate request
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Callout tone="danger" icon={AlertTriangle}>
            Closing an organization would cancel its workspace, remove member access and archive all records. This prototype will not perform those actions.
          </Callout>
          <Field label={`Type "${orgDisplayName}" to continue`}>
            <Input value={closureText} onChange={(event) => setClosureText(event.target.value)} placeholder={orgDisplayName} autoFocus />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
