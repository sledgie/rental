import { useState } from "react";
import { useStore } from "../lib/store";
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Field, Input, Select } from "../components/ui";
import { PERMISSIONS } from "../lib/types";

export default function SettingsPage() {
  const { state, updateSettings, resetDemo, can } = useStore();
  const s = state.settings;
  const [local, setLocal] = useState(s);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof typeof local>(k: K, v: (typeof local)[K]) => {
    setLocal((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  const save = () => {
    updateSettings(local);
    setSaved(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-u-ink">Reconciliation Settings</h2>
          <p className="text-sm text-u-muted">Configurable behavior for future reconciliations. Finalized reconciliations are never altered by configuration changes.</p>
        </div>
        <Button variant="primary" icon="check" onClick={save} disabled={!can("manage_settings")}>Save Settings</Button>
      </div>

      {saved && <Alert kind="success">Settings saved — the change is recorded in the audit trail and applies only to future reconciliations.</Alert>}
      {!can("manage_settings") && <Alert kind="warning">Your role cannot manage reconciliation settings. Switch to Accounting Admin in the header to edit.</Alert>}

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Reconciliation Behavior" subtitle="Matching, thresholds, and lifecycle controls" icon="settings" />
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Default Reconciliation Frequency" hint="Drives overdue scheduling.">
                <Select value={local.frequency} onChange={(e) => set("frequency", e.target.value as typeof local.frequency)}>
                  <option>Monthly</option>
                  <option>Weekly</option>
                  <option>Quarterly</option>
                </Select>
              </Field>
              <Field label="Transaction Date Tolerance (days)" hint="How far apart bank and book dates may be for a suggested match.">
                <Input type="number" min={0} max={30} value={local.dateToleranceDays} onChange={(e) => set("dateToleranceDays", Number(e.target.value))} />
              </Field>
              <Field label="Duplicate Detection Sensitivity" hint="Fingerprints use account, date, amount, reference, and description.">
                <Select value={local.duplicateSensitivity} onChange={(e) => set("duplicateSensitivity", e.target.value as typeof local.duplicateSensitivity)}>
                  <option value="strict">Strict (exact fingerprint)</option>
                  <option value="normal">Normal (amount + date + reference)</option>
                  <option value="loose">Loose (amount + date)</option>
                </Select>
              </Field>
              <Field label="Currency Precision (decimals)" hint="Tolerance for balance agreement at finalization.">
                <Input type="number" min={0} max={4} value={local.currencyPrecision} onChange={(e) => set("currencyPrecision", Number(e.target.value))} />
              </Field>
            </div>

            <div className="rounded-lg border border-u-line p-3 space-y-2">
              <Checkbox checked={local.autoMatching} onChange={(v) => set("autoMatching", v)} label={<span className="text-sm text-u-ink2">Automatic matching suggestions <span className="text-xs text-u-muted">— generate suggested matches for review (suggestions never auto-confirm)</span></span>} />
              <Checkbox checked={local.approvalRequired} onChange={(v) => set("approvalRequired", v)} label={<span className="text-sm text-u-ink2">Approval required for finalization <span className="text-xs text-u-muted">— finalizer must hold approve-adjustments permission</span></span>} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="High Confidence ≥">
                <Input type="number" value={local.confidenceHigh} onChange={(e) => set("confidenceHigh", Number(e.target.value))} />
              </Field>
              <Field label="Medium Confidence ≥">
                <Input type="number" value={local.confidenceMedium} onChange={(e) => set("confidenceMedium", Number(e.target.value))} />
              </Field>
              <Field label="Low Confidence ≥">
                <Input type="number" value={local.confidenceLow} onChange={(e) => set("confidenceLow", Number(e.target.value))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Reopening Permission" hint="Who may reopen finalized reconciliations.">
                <Select value={local.reopenPermission} onChange={(e) => set("reopenPermission", e.target.value as typeof local.reopenPermission)}>
                  <option value="admin">Accounting Admin only</option>
                  <option value="manager">Admin or Manager</option>
                </Select>
              </Field>
              <Field label="Stale Outstanding Warning (days)" hint="Age at which outstanding timing items raise a warning.">
                <Input type="number" value={local.staleWarningDays} onChange={(e) => set("staleWarningDays", Number(e.target.value))} />
              </Field>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="CSV Import Defaults" subtitle="Applied when starting a new import" icon="upload" />
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Default Delimiter">
                  <Select value={local.csvDelimiter} onChange={(e) => set("csvDelimiter", e.target.value)}>
                    <option value=",">Comma ( , )</option>
                    <option value=";">Semicolon ( ; )</option>
                    <option value="\t">Tab</option>
                    <option value="|">Pipe ( | )</option>
                  </Select>
                </Field>
                <Field label="First Row is Header">
                  <Select value={local.csvHasHeader ? "yes" : "no"} onChange={(e) => set("csvHasHeader", e.target.value === "yes")}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </Select>
                </Field>
              </div>
              <Checkbox
                checked={local.csvPositiveIsDeposit}
                onChange={(v) => set("csvPositiveIsDeposit", v)}
                label={<span className="text-sm text-u-ink2">Positive signed amounts are deposits <span className="text-xs text-u-muted">— for single Amount-column statements</span></span>}
              />
              <div className="rounded-lg border border-u-line p-3 text-xs text-u-muted">
                <p className="font-medium text-u-ink2 mb-1">Default account mapping</p>
                <p>Each bank account references its Chart of Accounts cash account (see Bank Accounts). Imports are validated against the selected statement period and existing transaction fingerprints.</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Notifications" subtitle="Optional reminders" icon="info" />
            <div className="p-5">
              <Field label="Notification Email">
                <Input type="email" value={local.notificationEmail} onChange={(e) => set("notificationEmail", e.target.value)} />
              </Field>
              <p className="text-[11px] text-u-muted mt-2">Demo environment — notifications are not sent.</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Permissions Reference" subtitle="Permission-aware actions across the module" icon="shield" />
            <ul className="divide-y divide-u-line">
              {PERMISSIONS.map((p) => {
                const granted = state.users.find((u) => u.id === state.currentUserId)?.permissions.includes(p.key) ?? false;
                return (
                  <li key={p.key} className="flex items-center justify-between gap-3 px-5 py-2">
                    <div>
                      <p className="text-xs font-medium text-u-ink2">{p.label}</p>
                      <p className="text-[11px] text-u-muted">{p.description}</p>
                    </div>
                    <Badge kind={granted ? "matched" : "cancelled"} dot>{granted ? "Granted" : "Not granted"}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Demo Data" subtitle="Restore the module to its seeded state" icon="refresh" />
        <div className="p-5 flex items-center justify-between gap-4">
          <p className="text-xs text-u-muted">
            Resets all mock reconciliation records, matches, imports, and settings to the deterministic seed. Useful for demonstrating workflows from a clean state.
          </p>
          <Button
            variant="danger"
            icon="refresh"
            onClick={() => {
              if (confirm("Reset all demo data to the initial seeded state?")) resetDemo();
            }}
          >
            Reset Demo Data
          </Button>
        </div>
      </Card>
    </div>
  );
}
