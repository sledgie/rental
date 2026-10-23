import { Suspense, useRef, useState, useEffect } from "react";
import { useSearchParams } from "../shim/route";
import { useStore } from "../lib/store";
import { parseCSV, suggestMapping, validateBankRows, buildSampleCSV, RowValidationResult } from "../lib/csv";
import { Alert, Badge, Button, Card, Field, Input, Select } from "../components/ui";
import { downloadCSV, fmtDate, money, uid } from "../lib/format";
import { ColumnMapping } from "../lib/types";

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: "transactionDate", label: "Transaction Date" },
  { key: "postedDate", label: "Posted Date" },
  { key: "description", label: "Description" },
  { key: "reference", label: "Reference Number" },
  { key: "debit", label: "Debit (Money Out)" },
  { key: "credit", label: "Credit (Money In)" },
  { key: "signedAmount", label: "Signed Amount" },
  { key: "runningBalance", label: "Running Balance" },
];

export default function ImportsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-u-muted">Loading imports…</div>}>
      <ImportsContent />
    </Suspense>
  );
}

function ImportsContent() {
  const { state, addBankTransactions, addImportBatch, saveMapping, deleteMapping, can } = useStore();
  const sp = useSearchParams();

  const [step, setStep] = useState(1);
  const [accountId, setAccountId] = useState(sp.get("account") ?? state.accounts[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 7) + "-01");
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseCSV> | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [positiveIsDeposit, setPositiveIsDeposit] = useState(true);
  const [results, setResults] = useState<RowValidationResult[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [mappingName, setMappingName] = useState("");
  const [resultSummary, setResultSummary] = useState<{ accepted: number; rejected: number; duplicates: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const account = state.accounts.find((a) => a.id === accountId);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setFileText(text);
      const parsedRes = parseCSV(text);
      setParsed(parsedRes);
      setMapping(suggestMapping(parsedRes.header));
      setStep(3);
    };
    reader.readAsText(file);
  };

  const runValidation = (m: ColumnMapping) => {
    if (!parsed || !account) return;
    const existingFingerprints = state.bankTxs.filter((t) => t.accountId === account.id).map((t) => t.fingerprint);
    const res = validateBankRows({
      rows: parsed.rows,
      mapping: m,
      account,
      periodStart,
      periodEnd,
      settings: state.settings,
      hasHeader: true,
      positiveIsDeposit,
      existingFingerprints,
      startRowOffset: 2,
    });
    setResults(res);
    const accepted = res.filter((r) => r.status === "accepted").length;
    const rejected = res.filter((r) => r.status === "rejected").length;
    const duplicates = res.filter((r) => r.status === "duplicate").length;
    const w: string[] = [];
    if (rejected > 0) w.push(`${rejected} row(s) rejected during validation — see the preview below for reasons. Invalid rows are never silently discarded.`);
    if (duplicates > 0) w.push(`${duplicates} potential duplicate(s) detected against the account's transaction history.`);
    if (parsed.rows.length === 0) w.push("The file contains no data rows.");
    setWarnings(w);
  };

  useEffect(() => {
    if (step === 4 && mapping) runValidation(mapping);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mapping, positiveIsDeposit, parsed, accountId, periodStart, periodEnd]);

  const confirmImport = () => {
    if (!mapping || !account || !parsed) return;
    const accepted = results.filter((r) => r.status === "accepted" && r.parsed);
    const rows = accepted.map((r) => r.parsed!);
    const batchId = uid("IMP");
    addBankTransactions(rows, account.id, batchId, fileName);
    addImportBatch({
      id: batchId,
      accountId: account.id,
      periodStart,
      periodEnd,
      fileName,
      importedAt: new Date().toISOString(),
      importedBy: state.users.find((u) => u.id === state.currentUserId)?.name ?? "User",
      totalRows: parsed.rows.length,
      acceptedRows: accepted.length,
      rejectedRows: results.filter((r) => r.status === "rejected").length,
      duplicateRows: results.filter((r) => r.status === "duplicate").length,
      warnings,
      mappingName: mappingName || "Ad-hoc mapping",
      reconciliationId: state.reconciliations.find((r) => r.accountId === account.id && r.status !== "Cancelled")?.id ?? null,
    });
    setResultSummary({ accepted: accepted.length, rejected: results.filter((r) => r.status === "rejected").length, duplicates: results.filter((r) => r.status === "duplicate").length });
    setStep(6);
  };

  const resetWizard = () => {
    setStep(1);
    setFileName("");
    setFileText("");
    setParsed(null);
    setMapping(null);
    setResults([]);
    setWarnings([]);
    setResultSummary(null);
    setMappingName("");
  };

  const downloadSample = () => {
    if (!account) return;
    const sample = buildSampleCSV(account, [
      { date: periodStart, description: "Sample rent deposit — DEMO ROW", reference: "SAMPLE-001", debit: 0, credit: 1500 },
      { date: periodStart, description: "Sample vendor payment — DEMO ROW", reference: "SAMPLE-002", debit: 250, credit: 0 },
    ]);
    downloadCSV(`sample-statement-${account.id}.csv`, parseCSV(sample).rows.map((r) => r.map((c) => c)));
  };

  const downloadErrorReport = () => {
    downloadCSV(
      `import-errors-${fileName || "report"}.csv`,
      [
        ["Row", "Status", "Reason", "Values"],
        ...results.map((r) => [r.rowNumber, r.status, r.reason, r.values.join(" | ")]),
      ],
    );
  };

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* WIZARD */}
      <div className="lg:col-span-2 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-u-ink">Import Bank Statements</h2>
          <p className="text-sm text-u-muted">CSV import workflow with column mapping, validation, and duplicate detection.</p>
        </div>

        <Card>
          <div className="border-b border-u-line px-5 py-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-u-ink">Import Wizard</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-u-muted">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <span key={s} className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= s ? "border-u-accent/60 bg-u-accent-soft text-u-accent font-semibold" : "border-u-line text-u-muted"}`}>{s}</span>
              ))}
            </div>
          </div>
          <div className="p-5 space-y-5">
            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Bank Account">
                    <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                      {state.accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Statement Start">
                    <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                  </Field>
                  <Field label="Statement End">
                    <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                  </Field>
                </div>
                <Field label="Upload CSV statement" hint="CSV format is implemented. Additional formats can be added through the same import layer.">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button icon="upload" onClick={() => fileRef.current?.click()} disabled={!can("import_statements")}>Choose CSV file…</Button>
                    <Button variant="ghost" icon="download" onClick={downloadSample}>Download sample CSV</Button>
                    {fileName && <Badge kind="suggested" dot>{fileName}</Badge>}
                  </div>
                </Field>
                <Alert kind="info">No online banking credentials are requested or stored. Imports run entirely in this browser against simulated data.</Alert>
              </div>
            )}

            {/* STEP 2 — parsed preview */}
            {step === 2 && parsed && (
              <div className="space-y-4">
                <Alert kind="success">File parsed successfully — delimiter: “{parsed.delimiter}”, {parsed.rows.length} data row(s), {parsed.header.length} column(s).</Alert>
                <div>
                  <p className="text-xs font-semibold text-u-ink2 mb-1.5">Detected columns</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.header.map((h, i) => (
                      <span key={i} className="rounded-lg border border-u-line bg-u-s2 px-2 py-1 text-[11px] font-mono">
                        {i}: {h}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-u-ink2 mb-1.5">Preview (first 5 rows)</p>
                  <div className="overflow-x-auto rounded-lg border border-u-line">
                    <table className="min-w-full text-xs">
                      <thead className="bg-u-s2"><tr>{parsed.header.map((h, i) => <th key={i} className="px-2 py-1.5 text-left font-medium text-u-muted">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-u-line">
                        {parsed.rows.slice(0, 5).map((r, i) => (
                          <tr key={i}>{r.map((c, j) => <td key={j} className="px-2 py-1.5 text-u-ink2">{c}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — mapping */}
            {step === 3 && parsed && mapping && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-u-ink2 mb-1.5">Map file columns to application fields</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {MAPPING_FIELDS.map((f) => (
                      <Field key={f.key} label={f.label}>
                        <Select value={mapping[f.key] ?? -1} onChange={(e) => {
                          const v = e.target.value === "-1" ? null : Number(e.target.value);
                          setMapping({ ...mapping, [f.key]: v });
                        }}>
                          <option value={-1}>— none —</option>
                          {parsed.header.map((h, i) => (
                            <option key={i} value={i}>{i}: {h}</option>
                          ))}
                        </Select>
                      </Field>
                    ))}
                  </div>
                </div>
                <Field label="Signed amount convention (if using a single Amount column)">
                  <Select value={positiveIsDeposit ? "dep" : "wd"} onChange={(e) => setPositiveIsDeposit(e.target.value === "dep")}>
                    <option value="dep">Positive amounts are deposits (money in)</option>
                    <option value="wd">Positive amounts are withdrawals (money out)</option>
                  </Select>
                </Field>
                {mapping.signedAmount !== null && mapping.debit === null && mapping.credit === null && (
                  <Alert kind="info">Single signed-amount mode: positive values will be treated as {positiveIsDeposit ? "deposits" : "withdrawals"}.</Alert>
                )}
                <Field label="Save mapping for reuse (optional)">
                  <div className="flex gap-2">
                    <Input value={mappingName} onChange={(e) => setMappingName(e.target.value)} placeholder="My bank format" className="flex-1" />
                    <Button icon="check" disabled={!mappingName.trim() || !can("manage_settings")} onClick={() => { saveMapping(mappingName, mapping, positiveIsDeposit ? "positive_is_deposit" : "positive_is_withdrawal"); setMappingName(""); }}>Save</Button>
                  </div>
                </Field>
              </div>
            )}

            {/* STEP 4 — validation preview */}
            {step === 4 && (
              <div className="space-y-4">
                {warnings.map((w, i) => (
                  <Alert key={i} kind={w.includes("rejected") ? "warning" : "info"}>{w}</Alert>
                ))}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-u-ok/30 bg-u-ok-soft/50 p-3"><p className="text-2xl font-semibold text-u-ok tabular-nums">{results.filter((r) => r.status === "accepted").length}</p><p className="text-xs text-u-muted">Accepted</p></div>
                  <div className="rounded-lg border border-u-danger/30 bg-u-danger-soft/50 p-3"><p className="text-2xl font-semibold text-u-danger tabular-nums">{results.filter((r) => r.status === "rejected").length}</p><p className="text-xs text-u-muted">Rejected</p></div>
                  <div className="rounded-lg border border-u-warn/30 bg-u-warn-soft/50 p-3"><p className="text-2xl font-semibold text-u-warn tabular-nums">{results.filter((r) => r.status === "duplicate").length}</p><p className="text-xs text-u-muted">Potential duplicates</p></div>
                </div>
                {results.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-u-line">
                    <table className="min-w-full text-xs">
                      <thead className="bg-u-s2">
                        <tr><th className="px-2 py-1.5 text-left font-medium text-u-muted">Row</th><th className="px-2 py-1.5 text-left font-medium text-u-muted">Status</th><th className="px-2 py-1.5 text-left font-medium text-u-muted">Reason</th><th className="px-2 py-1.5 text-left font-medium text-u-muted">Values</th></tr>
                      </thead>
                      <tbody className="divide-y divide-u-line">
                        {results.slice(0, 50).map((r) => (
                          <tr key={r.rowNumber}>
                            <td className="px-2 py-1.5 text-u-muted">{r.rowNumber}</td>
                            <td className="px-2 py-1.5">
                              <Badge kind={r.status === "accepted" ? "matched" : r.status === "duplicate" ? "duplicate" : "unmatched"}>{r.status}</Badge>
                            </td>
                            <td className="px-2 py-1.5 text-u-ink2">{r.reason || "—"}</td>
                            <td className="px-2 py-1.5 text-u-muted max-w-xs truncate">{r.values.join(" | ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {results.filter((r) => r.status !== "accepted").length > 0 && (
                  <Button size="sm" variant="outline" icon="download" onClick={downloadErrorReport}>Download error report</Button>
                )}
              </div>
            )}

            {/* STEP 6 — result */}
            {step === 6 && resultSummary && (
              <div className="space-y-4">
                <Alert kind="success">
                  Import complete: {resultSummary.accepted} transaction(s) imported into {account?.name}. {resultSummary.rejected + resultSummary.duplicates > 0 ? `${resultSummary.rejected} rejected, ${resultSummary.duplicates} flagged as potential duplicates.` : "No rejections or duplicates."}
                </Alert>
                <div className="rounded-lg border border-u-line p-4 space-y-2 text-sm">
                  <p><span className="text-u-muted">File:</span> {fileName}</p>
                  <p><span className="text-u-muted">Period:</span> {fmtDate(periodStart)} – {fmtDate(periodEnd)}</p>
                  <p><span className="text-u-muted">Batch ID:</span> <span className="font-mono text-xs">latest batch in history</span></p>
                  <p><span className="text-u-muted">Next step:</span> open the reconciliation workspace to review suggested matches.</p>
                </div>
              </div>
            )}

            {/* Wizard nav */}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={resetWizard}>New Import</Button>
              <div className="flex gap-2">
                {step > 1 && step < 6 && <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Back</Button>}
                {step === 1 && parsed && <Button variant="primary" onClick={() => setStep(2)}>Continue</Button>}
                {step === 2 && <Button variant="primary" onClick={() => setStep(3)}>Map Columns</Button>}
                {step === 3 && <Button variant="primary" onClick={() => setStep(4)}>Validate</Button>}
                {step === 4 && (
                  <Button variant="success" icon="check" onClick={confirmImport} disabled={results.filter((r) => r.status === "accepted").length === 0}>
                    Confirm Import
                  </Button>
                )}
                {step === 6 && <Button variant="primary" onClick={resetWizard}>Import Another File</Button>}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* SIDE: history + mappings */}
      <div className="space-y-5">
        <Card>
          <div className="border-b border-u-line px-5 py-4">
            <h3 className="text-sm font-semibold text-u-ink">Import History</h3>
            <p className="text-xs text-u-muted">Batches, counts, and warnings.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-u-s2">
                <tr><th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-u-muted">Batch</th><th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-u-muted">File</th><th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-u-muted">Accepted</th><th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-u-muted">Issues</th></tr>
              </thead>
              <tbody className="divide-y divide-u-line">
                {state.importBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-u-s2/60">
                    <td className="px-3 py-2 font-mono">{b.id}</td>
                    <td className="px-3 py-2">{b.fileName}</td>
                    <td className="px-3 py-2 tabular-nums text-u-ok">{b.acceptedRows}</td>
                    <td className="px-3 py-2">
                      {b.rejectedRows + b.duplicateRows > 0 ? (
                        <Badge kind={b.rejectedRows > 0 ? "unmatched" : "duplicate"}>{b.rejectedRows + b.duplicateRows} issue(s)</Badge>
                      ) : (
                        <Badge kind="matched">Clean</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="border-b border-u-line px-5 py-4">
            <h3 className="text-sm font-semibold text-u-ink">Import Mappings</h3>
            <p className="text-xs text-u-muted">Reusable column mappings per statement format.</p>
          </div>
          <ul className="divide-y divide-u-line">
            {state.importMappings.map((m) => (
              <li key={m.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-u-ink2">{m.name} {m.system && <Badge kind="neutral">system</Badge>}</p>
                    <p className="text-[11px] text-u-muted">{m.format}</p>
                  </div>
                  {!m.system && (
                    <Button size="sm" variant="ghost" className="text-u-danger" disabled={!can("manage_settings")} onClick={() => deleteMapping(m.id)}>Delete</Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {MAPPING_FIELDS.filter((f) => m.columns[f.key] !== null).map((f) => (
                    <span key={f.key} className="rounded bg-u-s3 px-1.5 py-0.5 text-[10px] text-u-muted">
                      {f.label} → col {m.columns[f.key]}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
