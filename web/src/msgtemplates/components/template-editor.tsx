import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Check, Eye, FileText, Info, Paperclip, Save, Send, ShieldAlert, X } from "lucide-react";
import { ApiError, communicationApi } from "../lib/client-api";
import { CANADIAN_JURISDICTIONS, CATEGORIES, EVENT_GROUPS, PROPERTIES } from "../lib/catalog";
import { emptyTemplate } from "../lib/defaults";
import { analyzeSms, escapeHtml, getTemplateVariables, htmlToPlainText, validateTemplateInput } from "../lib/engine";
import type { Channel, MessageTemplate, NotificationConfiguration, TemplateInput } from "../lib/types";
import { VARIABLE_MAP } from "../lib/variables";
import { Badge, Button, ConfirmDialog, Field, Modal, ToastRegion, Toggle, useToast } from "./ui";
import { MergeFieldPicker } from "./merge-field-picker";
import { MessagePreview } from "./message-preview";
import { RichTextEditor, type RichTextEditorHandle } from "./rich-text-editor";
import { TestSendDialog } from "./test-send-dialog";

type EditableField = "body" | "subject" | "plainTextBody" | "inAppTitle";
function toInput(template: MessageTemplate): TemplateInput {
  const { id: _id, version: _version, createdAt: _createdAt, updatedAt: _updatedAt, createdBy: _createdBy, updatedBy: _updatedBy, automationIds: _automationIds, automationNames: _automationNames, ...input } = template;
  return input;
}

export function TemplateEditor({ initialTemplate, settings, onClose, onSaved, onDirtyChange }: { initialTemplate?: MessageTemplate; settings: NotificationConfiguration; onClose: () => void; onSaved?: (template: MessageTemplate) => void; onDirtyChange?: (dirty: boolean) => void }) {
  const { toasts, notify, dismiss } = useToast();
  const [draft, setDraft] = useState<TemplateInput>(() => initialTemplate ? toInput(initialTemplate) : emptyTemplate(settings.defaultSignature));
  const [original, setOriginal] = useState(() => JSON.stringify(initialTemplate ? toInput(initialTemplate) : emptyTemplate(settings.defaultSignature)));
  const [savedId, setSavedId] = useState(initialTemplate?.id);
  const [savedVersion, setSavedVersion] = useState(initialTemplate?.version ?? 0);
  const [scenarioId, setScenarioId] = useState("rent");
  const [editorMode, setEditorMode] = useState<"rich" | "source" | "plain">("rich");
  const [activeField, setActiveField] = useState<EditableField>("body");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<"draft" | "save" | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const richRef = useRef<RichTextEditorHandle>(null);
  const textRefs = useRef<Partial<Record<EditableField, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const dirty = JSON.stringify(draft) !== original;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  const usedVariables = useMemo(() => getTemplateVariables(draft), [draft]);
  // The preview endpoint is authoritative; this local list also catches catalogue errors immediately.
  const displayedUnknown = usedVariables.filter((name) => !VARIABLE_MAP[name]);

  function update<K extends keyof TemplateInput>(key: K, value: TemplateInput[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function updateSender(key: keyof TemplateInput["senderConfiguration"], value: string) { setDraft((current) => ({ ...current, senderConfiguration: { ...current.senderConfiguration, [key]: value } })); }
  function updateInApp(key: keyof TemplateInput["inAppConfiguration"], value: string) { setDraft((current) => ({ ...current, inAppConfiguration: { ...current.inAppConfiguration, [key]: value } })); }
  function setFieldValue(field: EditableField, value: string) {
    if (field === "inAppTitle") updateInApp("title", value); else update(field, value);
  }
  function fieldValue(field: EditableField) { return field === "inAppTitle" ? draft.inAppConfiguration.title : draft[field]; }
  function selectionHandler(field: EditableField, element: HTMLInputElement | HTMLTextAreaElement) { textRefs.current[field] = element; setActiveField(field); }
  function insertVariable(name: string) {
    const token = `{{${name}}}`;
    if (activeField === "body" && draft.channel === "email" && editorMode === "rich") { richRef.current?.insertText(token); return; }
    const value = fieldValue(activeField);
    const element = textRefs.current[activeField];
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? start;
    const next = value.slice(0, start) + token + value.slice(end);
    setFieldValue(activeField, next);
    window.requestAnimationFrame(() => { element?.focus(); element?.setSelectionRange(start + token.length, start + token.length); });
  }
  function toggleRequired(name: string) { update("requiredVariables", draft.requiredVariables.includes(name) ? draft.requiredVariables.filter((item) => item !== name) : [...draft.requiredVariables, name]); }
  function changeChannel(channel: Channel) {
    if (channel === draft.channel) return;
    let body = draft.body;
    if (draft.channel === "email" && channel !== "email") body = htmlToPlainText(body);
    if (draft.channel !== "email" && channel === "email") body = body.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
    setDraft((current) => ({ ...current, channel, body, status: current.status === "active" ? "draft" : current.status }));
    setEditorMode(channel === "email" ? "rich" : "source"); setActiveField("body"); setErrors({});
  }

  async function save(asDraft = false) {
    const next = { ...draft, status: asDraft ? "draft" as const : draft.status, availableVariables: usedVariables };
    const validation = validateTemplateInput(next);
    setErrors(validation);
    if (Object.keys(validation).length) { notify("Review the highlighted fields before saving.", "error"); document.getElementById("template-editor-top")?.scrollIntoView({ behavior: "smooth" }); return; }
    setSaving(asDraft ? "draft" : "save");
    try {
      const response = savedId ? await communicationApi.updateTemplate(savedId, next) : await communicationApi.createTemplate(next);
      setDraft(toInput(response.template)); setOriginal(JSON.stringify(toInput(response.template))); setSavedId(response.template.id); setSavedVersion(response.template.version); setErrors({});
      notify(`${response.template.name} saved as version ${response.template.version}.`); onSaved?.(response.template);
    } catch (caught) {
      if (caught instanceof ApiError) { setErrors((caught.payload.fields ?? {}) as Record<string, string>); notify(caught.message, "error"); }
      else notify("The template could not be saved. Your edits are still in this editor.", "error");
    } finally { setSaving(null); }
  }
  function leave() { setDiscardOpen(false); onClose(); }
  function cancel() { if (dirty) setDiscardOpen(true); else onClose(); }
  const sms = analyzeSms(draft.channel === "sms" ? draft.body : "");

  return <div id="template-editor-top">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-u-muted">{initialTemplate ? `Version ${savedVersion} · Last edited by ${initialTemplate.updatedBy}` : "New reusable communication. Define content once, validate its data context and reuse it in manual and automated messages."}</p><div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={cancel}>Cancel</Button>
      <Button variant="secondary" onClick={() => setTestOpen(true)}><Send size={14} />Test Send</Button>
      <Button variant="secondary" onClick={() => save(true)} loading={saving === "draft"}>Save Draft</Button>
      <Button onClick={() => save(false)} loading={saving === "save"}><Save size={14} />Save Changes</Button>
    </div></div>
    <div className="mb-4 flex flex-wrap items-center gap-2"><Badge tone={dirty ? "amber" : "green"} dot>{dirty ? "Unsaved changes" : savedId ? `All changes saved · v${savedVersion}` : "New draft"}</Badge>{initialTemplate?.automationNames?.length ? <span className="text-[11px] font-medium text-u-accent">Used by {initialTemplate.automationNames.length} automation rule{initialTemplate.automationNames.length === 1 ? "" : "s"}</span> : <span className="text-[11px] text-u-muted">Content version increments on every save</span>}</div>

    <div className="grid items-start gap-5">
      <div className="min-w-0 space-y-5">
        <section className="card p-4 sm:p-5" aria-labelledby="template-information">
          <div className="mb-5 flex items-center gap-2"><FileText size={17} className="text-u-accent" /><h2 id="template-information" className="text-sm font-semibold text-u-ink">Template information</h2></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Template Name" required error={errors.name} htmlFor="template-name" className="sm:col-span-2"><input id="template-name" className="input" aria-invalid={Boolean(errors.name)} value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Upcoming Rent Reminder" /></Field>
            <Field label="Description" htmlFor="template-description" className="sm:col-span-2"><textarea id="template-description" className="input min-h-[68px]" value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Explain when and why this template should be used" /></Field>
            <Field label="Category" required htmlFor="template-category"><select id="template-category" className="input" value={draft.category} onChange={(event) => update("category", event.target.value)}>{CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field>
            <Field label="Default Language" htmlFor="template-language"><select id="template-language" className="input" value={draft.language} onChange={(event) => update("language", event.target.value)}><option value="en-CA">English (Canada)</option><option value="fr-CA">French (Canada)</option><option value="en-US">English (United States)</option></select></Field>
            <Field label="Communication Channel" required className="sm:col-span-2"><div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Communication channel">{(["email", "sms", "in_app"] as Channel[]).map((channel) => <button key={channel} role="radio" aria-checked={draft.channel === channel} onClick={() => changeChannel(channel)} className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${draft.channel === channel ? "border-u-accent/60 bg-u-accent-soft text-u-accent ring-1 ring-u-accent/60" : "border-u-line bg-u-card text-u-ink2 hover:bg-u-s2"}`}>{channel === "in_app" ? "In-App" : channel === "sms" ? "SMS" : "Email"}</button>)}</div></Field>
            <Field label="Status" htmlFor="template-status" hint={draft.legalNotice ? "Legal templates require jurisdiction details before activation." : "Drafts are not eligible for automation activation."}><select id="template-status" className="input" value={draft.status} onChange={(event) => update("status", event.target.value as TemplateInput["status"])}><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
            <Field label="Data context / event" required htmlFor="event-context" hint="Controls which merge fields are valid for this template."><select id="event-context" className="input" value={draft.eventContext} onChange={(event) => update("eventContext", event.target.value)}>{EVENT_GROUPS.map((group) => <optgroup key={group.group} label={group.group}>{group.events.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}</optgroup>)}</select></Field>
            <Field label="Availability" className="sm:col-span-2"><div className="flex flex-wrap gap-4 rounded-lg border border-u-line p-3"><label className="flex items-center gap-2 text-xs text-u-ink2"><input type="radio" name="scope" checked={draft.propertyScope.type === "company"} onChange={() => update("propertyScope", { type: "company", propertyIds: [] })} />Company-wide</label><label className="flex items-center gap-2 text-xs text-u-ink2"><input type="radio" name="scope" checked={draft.propertyScope.type === "properties"} onChange={() => update("propertyScope", { type: "properties", propertyIds: [] })} />Selected properties</label></div>{draft.propertyScope.type === "properties" && <div className="mt-2 grid gap-2 rounded-lg border border-u-line bg-u-s2 p-3 sm:grid-cols-3">{PROPERTIES.map((property) => <label key={property.id} className="flex items-start gap-2 text-[11px] leading-4 text-u-ink2"><input type="checkbox" className="mt-0.5" checked={draft.propertyScope.propertyIds.includes(property.id)} onChange={() => update("propertyScope", { ...draft.propertyScope, propertyIds: draft.propertyScope.propertyIds.includes(property.id) ? draft.propertyScope.propertyIds.filter((id) => id !== property.id) : [...draft.propertyScope.propertyIds, property.id] })} />{property.name}</label>)}</div>}{errors.propertyScope && <p className="mt-1.5 text-xs text-u-danger">{errors.propertyScope}</p>}</Field>
            <Field label="Internal Notes" htmlFor="internal-notes" className="sm:col-span-2" hint="Visible to staff only; never included in rendered messages."><textarea id="internal-notes" className="input min-h-[64px]" value={draft.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} /></Field>
            <div className="sm:col-span-2 rounded-lg border border-u-line bg-u-s2 p-3"><Toggle checked={draft.legalNotice} onChange={(checked) => update("legalNotice", checked)} label="Legal or statutory notice" description="Flags this template for jurisdiction-specific legal review and activation checks." />{draft.legalNotice && <div className="mt-3 border-t border-u-line pt-3"><Field label="Reviewed jurisdiction" required error={errors.jurisdiction} htmlFor="jurisdiction"><select id="jurisdiction" className="input bg-u-card" value={draft.jurisdiction} onChange={(event) => update("jurisdiction", event.target.value)}><option value="">Select province or territory</option>{CANADIAN_JURISDICTIONS.map((jurisdiction) => <option key={jurisdiction}>{jurisdiction}</option>)}</select></Field><p className="mt-2 flex items-start gap-2 text-[11px] leading-5 text-u-warn"><ShieldAlert size={14} className="mt-0.5 shrink-0" />Selecting a jurisdiction records your review scope; it does not certify compliance. Required forms, notice periods and tenant rights must be verified by a qualified reviewer.</p></div>}</div>
          </div>
        </section>

        <section className="card overflow-hidden" aria-labelledby="message-content">
          <div className="border-b border-u-line px-4 py-4 sm:px-5"><h2 id="message-content" className="text-sm font-semibold text-u-ink">{draft.channel === "email" ? "Email content" : draft.channel === "sms" ? "SMS content" : "In-app notification content"}</h2><p className="mt-1 text-[11px] text-u-muted">Merge fields are inserted at the current cursor position and resolved only when rendered.</p></div>
          <div className="grid gap-5 p-4 sm:p-5">
            <div className="min-w-0 space-y-4">
              {draft.channel === "email" && <>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="From Name" required error={errors.fromName} htmlFor="from-name"><input id="from-name" className="input" value={draft.senderConfiguration.fromName} onChange={(event) => updateSender("fromName", event.target.value)} /></Field><Field label="From Email" required error={errors.fromEmail} htmlFor="from-email"><select id="from-email" className="input" value={draft.senderConfiguration.fromEmail} onChange={(event) => { const identity = settings.senderIdentities.find((item) => item.email === event.target.value); setDraft((current) => ({ ...current, senderConfiguration: { ...current.senderConfiguration, fromEmail: event.target.value, fromName: identity?.name ?? current.senderConfiguration.fromName } })); }}>{settings.senderIdentities.map((identity) => <option key={identity.id} value={identity.email}>{identity.name} · {identity.email}{identity.verified ? "" : " (unverified)"}</option>)}</select></Field><Field label="Reply-To" error={errors.replyTo} htmlFor="reply-to"><input id="reply-to" type="email" className="input" value={draft.senderConfiguration.replyTo} onChange={(event) => updateSender("replyTo", event.target.value)} /></Field><Field label="To recipient rule" htmlFor="recipient-rule"><select id="recipient-rule" className="input" value={draft.recipientConfiguration.recipientRule} onChange={(event) => setDraft((current) => ({ ...current, recipientConfiguration: { ...current.recipientConfiguration, recipientRule: event.target.value } }))}><option value="primary_tenant">Primary tenant</option><option value="all_lease_tenants">All tenants on lease</option><option value="property_owner">Property owner</option><option value="assigned_contractor">Assigned contractor</option><option value="assigned_staff">Assigned staff member</option><option value="custom">Custom recipient</option></select></Field><Field label="To value / merge field" htmlFor="recipient-to" error={errors.recipientTo} hint="Recipient rules resolve from the event payload; custom values still require consent checks."><input id="recipient-to" className="input" value={draft.recipientConfiguration.to} onChange={(event) => setDraft((current) => ({ ...current, recipientConfiguration: { ...current.recipientConfiguration, to: event.target.value } }))} /></Field><Field label="CC (optional)" htmlFor="cc" error={errors.cc}><input id="cc" className="input" value={draft.senderConfiguration.cc} onChange={(event) => updateSender("cc", event.target.value)} placeholder="Comma-separated emails" /></Field><Field label="BCC (optional)" htmlFor="bcc" className="sm:col-span-2" error={errors.bcc}><input id="bcc" className="input" value={draft.senderConfiguration.bcc} onChange={(event) => updateSender("bcc", event.target.value)} placeholder="Comma-separated emails" /></Field></div>
                <Field label="Subject" required error={errors.subject} htmlFor="subject"><input ref={(element) => { textRefs.current.subject = element; }} id="subject" className="input" aria-invalid={Boolean(errors.subject)} value={draft.subject} onFocus={() => setActiveField("subject")} onSelect={(event) => selectionHandler("subject", event.currentTarget)} onClick={(event) => selectionHandler("subject", event.currentTarget)} onKeyUp={(event) => selectionHandler("subject", event.currentTarget)} onChange={(event) => update("subject", event.target.value)} placeholder="Subject with {{merge_fields}}" /></Field>
              </>}
              {draft.channel === "in_app" && <div className="grid gap-4 sm:grid-cols-2"><Field label="Notification title" required error={errors.inAppTitle} htmlFor="in-app-title" className="sm:col-span-2"><input ref={(element) => { textRefs.current.inAppTitle = element; }} id="in-app-title" className="input" maxLength={100} value={draft.inAppConfiguration.title} onFocus={() => setActiveField("inAppTitle")} onSelect={(event) => selectionHandler("inAppTitle", event.currentTarget)} onChange={(event) => updateInApp("title", event.target.value)} /></Field><Field label="Action label (optional)" htmlFor="action-label"><input id="action-label" className="input" value={draft.inAppConfiguration.actionLabel} onChange={(event) => updateInApp("actionLabel", event.target.value)} /></Field><Field label="Destination route (optional)" error={errors.destinationRoute} htmlFor="destination-route"><input id="destination-route" className="input" value={draft.inAppConfiguration.destinationRoute} onChange={(event) => updateInApp("destinationRoute", event.target.value)} placeholder="/leases/123" /></Field></div>}
              <div>
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2"><div><label className="label mb-0" htmlFor={draft.channel === "email" && editorMode === "rich" ? undefined : "message-body"}>{draft.channel === "email" ? "Message body" : draft.channel === "sms" ? "Message body" : "Notification message"}<span className="ml-1 text-u-danger">*</span></label></div>{draft.channel === "email" && <div className="flex rounded-lg bg-u-s3 p-1" role="tablist" aria-label="Email editing mode">{(["rich", "source", "plain"] as const).map((mode) => <button key={mode} role="tab" aria-selected={editorMode === mode} onClick={() => { setEditorMode(mode); if (mode === "plain") setActiveField("plainTextBody"); else setActiveField("body"); }} className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold capitalize ${editorMode === mode ? "bg-u-card text-u-accent shadow-sm" : "text-u-muted"}`}>{mode === "rich" ? "Rich text" : mode === "source" ? "HTML source" : "Plain-text fallback"}</button>)}</div>}</div>
                {draft.channel === "email" && editorMode === "rich" ? <RichTextEditor ref={richRef} value={draft.body} onChange={(value) => update("body", value)} onFocus={() => setActiveField("body")} invalid={Boolean(errors.body)} /> : draft.channel === "email" && editorMode === "plain" ? <textarea ref={(element) => { textRefs.current.plainTextBody = element; }} id="plain-text-body" className="input min-h-[280px] font-mono text-xs" value={draft.plainTextBody} onFocus={() => setActiveField("plainTextBody")} onSelect={(event) => selectionHandler("plainTextBody", event.currentTarget)} onChange={(event) => update("plainTextBody", event.target.value)} placeholder="Optional. If blank, a plain-text version is generated from sanitized HTML." /> : <textarea ref={(element) => { textRefs.current.body = element; }} id="message-body" className={`input min-h-[280px] ${draft.channel === "email" ? "font-mono text-xs" : ""}`} aria-invalid={Boolean(errors.body)} value={draft.body} onFocus={() => setActiveField("body")} onSelect={(event) => selectionHandler("body", event.currentTarget)} onKeyUp={(event) => selectionHandler("body", event.currentTarget)} onChange={(event) => update("body", event.target.value)} placeholder={draft.channel === "sms" ? "Write a concise SMS with {{merge_fields}}" : "Write your message"} />}{errors.body && <p className="mt-1.5 text-xs text-u-danger">{errors.body}</p>}
                {draft.channel === "email" && editorMode === "rich" && <div className="mt-3"><Field label="Email signature" htmlFor="email-signature" hint="HTML allowed: paragraphs, bold, italic, lists and safe links. Sanitized with the body."><textarea id="email-signature" className="input min-h-[90px] font-mono text-[11px]" value={draft.senderConfiguration.signature} onChange={(event) => updateSender("signature", event.target.value)} /></Field></div>}
                {draft.channel === "sms" && <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] ${sms.units > 1600 ? "text-u-danger" : "text-u-muted"}`}><span>{sms.characters} characters</span><span>{sms.encoding}</span><span>{sms.segments} estimated segment{sms.segments === 1 ? "" : "s"} · {sms.segmentSize} units each</span></div>}
              </div>
              {draft.channel === "email" && <div><div className="mb-2 flex items-center gap-2"><Paperclip size={14} className="text-u-muted" /><span className="text-xs font-semibold text-u-ink2">Attachments</span></div><label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-u-line2 bg-u-s2 px-4 py-4 text-center text-[11px] text-u-muted hover:border-u-accent/60 hover:bg-u-accent-soft"><input type="file" multiple className="sr-only" onChange={(event) => { const files = Array.from(event.target.files ?? []).map((file) => ({ id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type })); update("attachments", [...draft.attachments, ...files]); event.target.value = ""; }} /><span>Choose files to add an attachment manifest<br /><span className="text-[10px] text-u-muted">Metadata only in configuration mode; document storage is required for delivery.</span></span></label>{draft.attachments.length > 0 && <div className="mt-2 space-y-1.5">{draft.attachments.map((attachment) => <div key={attachment.id} className="flex items-center gap-2 rounded-md border border-u-line px-2.5 py-2 text-[11px]"><Paperclip size={12} className="text-u-muted" /><span className="truncate">{attachment.name}</span><span className="text-u-muted">{Math.ceil(attachment.size / 1024)} KB</span><button className="ml-auto text-u-muted hover:text-u-danger" onClick={() => update("attachments", draft.attachments.filter((item) => item.id !== attachment.id))} aria-label={`Remove ${attachment.name}`}><X size={13} /></button></div>)}</div>}</div>}
            </div>
            <MergeFieldPicker template={draft} usedVariables={usedVariables} unknownVariables={displayedUnknown} onInsert={insertVariable} onToggleRequired={toggleRequired} />
          </div>
        </section>
      </div>
    </div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-u-line bg-u-card p-3"><p className="text-[11px] text-u-muted">Preview and validate with realistic sample data.</p><Button variant="secondary" onClick={() => setPreviewOpen(true)}><Eye size={14} />Open Live Preview</Button></div>
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-u-line pt-5"><p className="mr-auto flex items-center gap-1.5 text-[11px] text-u-muted"><Info size={13} />{dirty ? "You have unsaved changes." : "No pending edits."}</p><Button variant="secondary" onClick={cancel}>Cancel</Button><Button variant="secondary" onClick={() => save(true)} loading={saving === "draft"}>Save Draft</Button><Button onClick={() => save(false)} loading={saving === "save"}><Check size={14} />Save Changes</Button></div>

    <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Live template preview" description="Rendered with sample data. Nothing has been sent." size="xl"><div className="h-[72dvh] p-4"><MessagePreview template={draft} scenarioId={scenarioId} onScenarioChange={setScenarioId} /></div></Modal>
    <TestSendDialog open={testOpen} onClose={() => setTestOpen(false)} template={draft} templateId={savedId} scenarioId={scenarioId} defaultTestRecipient={settings.testRecipients.split(",")[0]?.trim()} />
    <ConfirmDialog open={discardOpen} onClose={() => setDiscardOpen(false)} onConfirm={leave} title="Discard unsaved changes?" description="Your latest edits have not been saved. Leaving now will discard them; the last saved template version will remain unchanged." confirmLabel="Discard and leave" destructive />
    {Object.keys(errors).length > 0 && <div className="fixed bottom-4 left-4 z-40 hidden max-w-xs items-start gap-2 rounded-lg border border-u-danger/30 bg-u-card p-3 text-xs text-u-danger shadow-lg md:flex"><AlertCircle size={15} className="mt-0.5 shrink-0" />{Object.keys(errors).length} field{Object.keys(errors).length === 1 ? " needs" : "s need"} attention.</div>}
    <ToastRegion toasts={toasts} dismiss={dismiss} />
  </div>;
}
