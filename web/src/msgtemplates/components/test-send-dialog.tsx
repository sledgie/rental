import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FlaskConical, Send, ShieldAlert } from "lucide-react";
import { ApiError, communicationApi } from "../lib/client-api";
import { SAMPLE_SCENARIOS } from "../lib/sample-data";
import type { CommunicationLog, MessageTemplate, PreviewResult, TemplateInput } from "../lib/types";
import { Badge, Button, Field, Modal } from "./ui";

export function TestSendDialog({ open, onClose, template, templateId, scenarioId: initialScenario = "rent", mode = "test", defaultTestRecipient = "", onRecorded }: {
  open: boolean;
  onClose: () => void;
  template: MessageTemplate | TemplateInput | null;
  templateId?: string;
  scenarioId?: string;
  mode?: "test" | "manual";
  defaultTestRecipient?: string;
  onRecorded?: (log: CommunicationLog) => void;
}) {
  const [scenarioId, setScenarioId] = useState(initialScenario);
  const [recipient, setRecipient] = useState({ name: "", email: "", phone: "" });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [confirmMissing, setConfirmMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ message: string; ok: boolean; log: CommunicationLog } | null>(null);

  useEffect(() => {
    if (!open || !template) return;
    const scenario = SAMPLE_SCENARIOS.find((item) => item.id === initialScenario) ?? SAMPLE_SCENARIOS[0];
    setScenarioId(initialScenario);
    setRecipient({ name: mode === "test" && defaultTestRecipient ? "Configured test recipient" : scenario.data.tenant_full_name, email: mode === "test" && defaultTestRecipient ? defaultTestRecipient : scenario.recipient, phone: scenario.data.tenant_phone });
    setResult(null); setError(""); setConfirmMissing(false); setPreview(null);
  // Reset only when a different dialog session or sample is opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialScenario, mode, defaultTestRecipient]);

  useEffect(() => {
    if (!open || !template || result) return;
    let active = true;
    communicationApi.previewTemplate(template, scenarioId).then((response) => { if (active) setPreview(response.preview); }).catch(() => { if (active) setError("The template could not be validated."); });
    return () => { active = false; };
  }, [open, template, scenarioId, result]);

  function changeScenario(id: string) {
    setScenarioId(id); setConfirmMissing(false); setError("");
    const scenario = SAMPLE_SCENARIOS.find((item) => item.id === id) ?? SAMPLE_SCENARIOS[0];
    setRecipient({ name: scenario.data.tenant_full_name, email: scenario.recipient, phone: scenario.data.tenant_phone });
  }

  async function submit() {
    if (!template) return;
    setLoading(true); setError("");
    try {
      const response = await communicationApi.dispatchMessage({ template, templateId, templateVersion: "version" in template ? template.version : 1, scenarioId, recipient, confirmMissing, mode });
      setResult(response); onRecorded?.(response.log);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        if (caught.payload.validation) setPreview(caught.payload.validation as PreviewResult);
      } else setError("The request could not be recorded. Check your connection and try again.");
    } finally { setLoading(false); }
  }

  const blockingCount = (preview?.unknownVariables.length ?? 0) + (preview?.unavailableVariables.length ?? 0) + (preview?.missingRequiredVariables.length ?? 0);
  return <Modal open={open} onClose={onClose} title={mode === "test" ? "Test send validation" : "New manual message"} description={mode === "test" ? "Validate this template against a sample record and a test recipient." : "Render a message from real template content and record the dispatch request."} size="md" footer={result ? <><Button variant="secondary" onClick={onClose}>Close</Button></> : <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading} disabled={!preview || blockingCount > 0 || ((preview?.missingVariables.length ?? 0) > 0 && !confirmMissing)}><Send size={14} />Validate & record request</Button></>}>
    {template && <div className="space-y-4 px-5 py-5 sm:px-6">
      <div className="flex items-start gap-3 rounded-lg border border-u-warn/30 bg-u-warn-soft p-3"><ShieldAlert size={17} className="mt-0.5 shrink-0 text-u-warn" /><div><p className="text-xs font-semibold text-u-warn">No external delivery provider is configured</p><p className="mt-1 text-[11px] leading-4 text-u-warn">This action validates and records a request. It will not send email, SMS or a realtime notification. A failed log is created to make that outcome auditable.</p></div></div>
      {result ? <div className={`rounded-lg border p-5 text-center ${result.ok ? "border-u-accent/30 bg-u-accent-soft" : "border-u-warn/30 bg-u-warn-soft"}`}>{result.ok ? <CheckCircle2 size={28} className="mx-auto text-u-accent" /> : <AlertCircle size={28} className="mx-auto text-u-warn" />}<h3 className="mt-3 text-sm font-semibold text-u-ink">{result.ok ? "Accepted by provider" : "Not sent — request recorded"}</h3><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-u-ink2">{result.message}</p><div className="mt-3"><Badge tone={result.ok ? "blue" : "amber"}>{result.log.status} · {result.log.attemptCount} provider attempts</Badge></div></div> : <>
        <div className="rounded-lg border border-u-line bg-u-s2 p-3"><div className="flex items-center gap-2"><FlaskConical size={14} className="text-u-accent" /><p className="truncate text-xs font-semibold text-u-ink">{template.name || "Untitled template"}</p><Badge tone="blue">Sample data</Badge></div><p className="mt-1 text-[10px] text-u-muted">The rendered content is stored with the request; merge fields are never saved with sample values.</p></div>
        <Field label="Sample record" htmlFor="send-scenario"><select id="send-scenario" className="input" value={scenarioId} onChange={(event) => changeScenario(event.target.value)}>{SAMPLE_SCENARIOS.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}</select></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Recipient name" htmlFor="recipient-name"><input id="recipient-name" className="input" value={recipient.name} onChange={(event) => setRecipient({ ...recipient, name: event.target.value })} /></Field><Field label={template.channel === "sms" ? "Recipient phone" : "Recipient email"} htmlFor="recipient-address" required><input id="recipient-address" type={template.channel === "sms" ? "tel" : "email"} className="input" value={template.channel === "sms" ? recipient.phone : recipient.email} onChange={(event) => setRecipient(template.channel === "sms" ? { ...recipient, phone: event.target.value } : { ...recipient, email: event.target.value })} /></Field></div>
        {preview && <div className={`rounded-lg border p-3 text-[11px] leading-5 ${blockingCount ? "border-u-danger/30 bg-u-danger-soft text-u-danger" : "border-u-line bg-u-s2 text-u-ink2"}`}>
          <p className="font-semibold">Pre-flight validation</p>
          {blockingCount === 0 && preview.missingVariables.length === 0 && <p className="mt-1 text-u-ok">Subject, content and all required merge fields are ready.</p>}
          {preview.unknownVariables.length > 0 && <p>Unknown: {preview.unknownVariables.join(", ")}</p>}
          {preview.unavailableVariables.length > 0 && <p>Unavailable for {template.eventContext}: {preview.unavailableVariables.join(", ")}</p>}
          {preview.missingRequiredVariables.length > 0 && <p>Required values missing: {preview.missingRequiredVariables.join(", ")}</p>}
        </div>}
        {(preview?.missingVariables.length ?? 0) > 0 && blockingCount === 0 && <label className="flex items-start gap-2.5 rounded-lg border border-u-warn/30 bg-u-warn-soft p-3 text-[11px] leading-5 text-u-warn"><input type="checkbox" className="mt-1" checked={confirmMissing} onChange={(event) => setConfirmMissing(event.target.checked)} /><span>I confirm that <strong>{preview?.missingVariables.join(", ")}</strong> may render as blank values. Required fields still block the request.</span></label>}
        {error && <p className="rounded-lg border border-u-danger/30 bg-u-danger-soft p-3 text-xs leading-5 text-u-danger" role="alert">{error}</p>}
      </>}
    </div>}
  </Modal>;
}
