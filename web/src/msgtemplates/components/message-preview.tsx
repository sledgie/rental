import { useEffect, useState } from "react";
import { AlertCircle, Braces, CheckCircle2, Mail, Monitor, Smartphone } from "lucide-react";
import { communicationApi } from "../lib/client-api";
import { SAMPLE_SCENARIOS } from "../lib/sample-data";
import type { MessageTemplate, PreviewResult, TemplateInput } from "../lib/types";
import { Badge } from "./ui";

export function MessagePreview({ template, scenarioId, onScenarioChange, compact = false }: { template: MessageTemplate | TemplateInput; scenarioId: string; onScenarioChange?: (id: string) => void; compact?: boolean }) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [mode, setMode] = useState<"rendered" | "source">("rendered");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await communicationApi.previewTemplate(template, scenarioId);
        if (active) { setPreview(result.preview); setError(""); }
      } catch { if (active) setError("Preview could not be rendered. Your edits are still preserved."); }
      finally { if (active) setLoading(false); }
    }, 260);
    return () => { active = false; window.clearTimeout(timer); };
  }, [template, scenarioId]);

  const scenario = SAMPLE_SCENARIOS.find((item) => item.id === scenarioId) ?? SAMPLE_SCENARIOS[0];
  const issueCount = (preview?.unknownVariables.length ?? 0) + (preview?.unavailableVariables.length ?? 0) + (preview?.missingRequiredVariables.length ?? 0);
  return <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-u-line bg-u-card" aria-label="Live message preview">
    <div className="flex flex-wrap items-center gap-2 border-b border-u-line px-3 py-2.5">
      <div className="mr-auto flex items-center gap-2"><span className="text-xs font-semibold text-u-ink">Live preview</span>{loading && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-u-accent" aria-label="Updating preview" />}</div>
      <div className="flex rounded-md bg-u-s3 p-0.5">
        <button onClick={() => setMode("rendered")} className={`rounded px-2 py-1 text-[10px] font-medium ${mode === "rendered" ? "bg-u-card text-u-ink shadow-sm" : "text-u-muted"}`}>Rendered</button>
        <button onClick={() => setMode("source")} className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium ${mode === "source" ? "bg-u-card text-u-ink shadow-sm" : "text-u-muted"}`}><Braces size={11} />Source</button>
      </div>
      {template.channel === "email" && <div className="flex rounded-md bg-u-s3 p-0.5"><button onClick={() => setDevice("desktop")} className={`rounded p-1.5 ${device === "desktop" ? "bg-u-card text-u-accent shadow-sm" : "text-u-muted"}`} aria-label="Desktop email preview" title="Desktop email preview"><Monitor size={13} /></button><button onClick={() => setDevice("mobile")} className={`rounded p-1.5 ${device === "mobile" ? "bg-u-card text-u-accent shadow-sm" : "text-u-muted"}`} aria-label="Mobile email preview" title="Mobile email preview"><Smartphone size={13} /></button></div>}
    </div>
    <div className="border-b border-u-line bg-u-accent-soft/45 px-3 py-2">
      <div className="flex items-center gap-2"><Badge tone="blue">Sample data</Badge><span className="truncate text-[10px] text-u-muted">Preview only · nothing has been sent</span></div>
      {onScenarioChange && <select value={scenarioId} onChange={(event) => onScenarioChange(event.target.value)} className="input mt-2 min-h-8 py-1 text-[11px]" aria-label="Preview sample record">{SAMPLE_SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>}
      <p className="mt-1.5 truncate text-[10px] text-u-muted">{scenario.description}</p>
    </div>
    <div className="scrollbar-thin min-h-[280px] flex-1 overflow-y-auto bg-u-s3/70 p-3 sm:p-4">
      {error ? <div className="rounded-lg border border-u-danger/30 bg-u-danger-soft p-4 text-xs text-u-danger">{error}</div> : !preview ? <div className="space-y-3"><div className="skeleton h-12 rounded-lg" /><div className="skeleton h-56 rounded-lg" /></div> : mode === "source" ? <div className="rounded-lg border border-u-line bg-[#111d33] p-4 text-u-s3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-u-muted">Template source</p><pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-5">{template.channel === "email" ? `Subject: ${template.subject}\n\n${template.body}\n\nPlain-text fallback:\n${template.plainTextBody || "(generated from HTML)"}` : template.channel === "in_app" ? `Title: ${template.inAppConfiguration.title}\n\n${template.body}\n\nAction: ${template.inAppConfiguration.actionLabel || "None"}\nRoute: ${template.inAppConfiguration.destinationRoute || "None"}` : template.body}</pre></div> : template.channel === "email" ? <div className={`mx-auto overflow-hidden rounded-lg border border-u-line bg-u-card shadow-sm transition-[max-width] ${device === "mobile" ? "max-w-[340px]" : "max-w-full"}`}>
        <div className="border-b border-u-line px-4 py-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-u-accent-soft text-u-accent"><Mail size={13} /></span><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-u-ink">{template.senderConfiguration.fromName || "Sender name"}</p><p className="truncate text-[9px] text-u-muted">to {scenario.recipient}</p></div></div><p className="mt-3 break-words text-[13px] font-semibold text-u-ink">{preview.renderedSubject || "(No subject)"}</p></div>
        <div className="email-preview px-4 py-5 sm:px-5" dangerouslySetInnerHTML={{ __html: preview.renderedBody }} />
        <div className="border-t border-u-line bg-u-s2 px-4 py-2 text-center text-[9px] text-u-muted">Sample preview · Northbridge Residential</div>
      </div> : template.channel === "sms" ? <div className="mx-auto max-w-[330px]"><div className="rounded-[24px] border-[5px] border-u-line2 bg-u-card p-3 shadow-lg"><div className="mx-auto mb-4 h-1 w-12 rounded-full bg-u-line" /><p className="text-center text-[10px] font-medium text-u-muted">{template.senderConfiguration.fromName || "Northbridge"}</p><div className="mt-5 max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-u-s3 px-3 py-2.5 text-[12px] leading-5 text-u-ink">{preview.plainTextBody || "Your SMS preview appears here."}</div><p className="mt-2 text-[9px] text-u-muted">Now · Sample only</p></div><div className="mt-3 flex justify-center gap-2 text-[10px] text-u-muted"><span>{preview.sms.characters} chars</span><span>·</span><span>{preview.sms.encoding}</span><span>·</span><span>{preview.sms.segments} segment{preview.sms.segments === 1 ? "" : "s"}</span></div></div> : <div className="mx-auto max-w-[360px] pt-4"><div className="rounded-xl border border-u-line bg-u-card p-4 shadow-md"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-u-accent text-xs font-bold text-u-onaccent">N</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-[11px] font-semibold text-u-ink">Northbridge Portal</p><span className="ml-auto text-[9px] text-u-muted">now</span></div><p className="mt-2 text-[13px] font-semibold text-u-ink">{preview.inAppTitle || "Notification title"}</p><p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-u-ink2">{preview.plainTextBody}</p>{template.inAppConfiguration.actionLabel && <button className="mt-3 text-[11px] font-semibold text-u-accent" onClick={() => window.alert(`Preview destination: ${template.inAppConfiguration.destinationRoute || "No route configured"}`)}>{template.inAppConfiguration.actionLabel} →</button>}</div></div></div><p className="mt-3 text-center text-[10px] text-u-muted">In-app notification · sample recipient</p></div>}
    </div>
    {preview && !compact && <div className="border-t border-u-line bg-u-card px-3 py-2.5">
      {issueCount ? <div className="flex items-start gap-2 text-[10px] leading-4 text-u-danger"><AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{preview.unknownVariables.length > 0 && <>{preview.unknownVariables.length} unknown. </>}{preview.unavailableVariables.length > 0 && <>{preview.unavailableVariables.length} unavailable for event. </>}{preview.missingRequiredVariables.length > 0 && <>{preview.missingRequiredVariables.length} required value{preview.missingRequiredVariables.length === 1 ? "" : "s"} missing.</>}</span></div> : preview.missingVariables.length ? <p className="text-[10px] leading-4 text-u-warn">{preview.missingVariables.length} optional value{preview.missingVariables.length === 1 ? " is" : "s are"} blank; confirmation is required before a message request.</p> : <p className="flex items-center gap-1.5 text-[10px] text-u-ok"><CheckCircle2 size={13} />All used variables resolve in this sample.</p>}
    </div>}
  </section>;
}
