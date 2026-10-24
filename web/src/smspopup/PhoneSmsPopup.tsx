// Click any phone number in the app (a tel: link or plain text) and a small SMS composer opens.
// One listener on the document does the work, so no page needs to be changed. Sending goes through the
// same `send-sms` Edge Function (Twilio) as Messages and Templates; without Supabase there is nothing to send with.
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, MessageSquareText, Phone, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { sendSms } from "../lib/sms";
import { fileSentText, type Contact } from "./record";

const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/g;
const MAX_LENGTH = 480;

type Target = { display: string; to: string };

const last10 = (v: string) => v.replace(/D/g, "").slice(-10);

/** Tenants and vendors whose saved phone number is this number (compared by digits, so formatting does not matter). */
async function findContacts(to: string): Promise<Contact[]> {
  const org = getActiveOrgId();
  const key = last10(to);
  if (!org || key.length < 10) return [];
  const [tenants, vendors] = await Promise.all([
    supabase.from("tenants").select("id, first_name, last_name, phone").eq("organization_id", org).not("phone", "is", null).limit(5000),
    supabase.from("vendors").select("id, company_name, contact_name, phone").eq("organization_id", org).not("phone", "is", null).limit(5000),
  ]);
  const found: Contact[] = [];
  for (const t of (tenants.data ?? []) as any[]) if (last10(t.phone) === key) found.push({ kind: "tenant", id: t.id, name: `${t.first_name} ${t.last_name ?? ""}`.trim(), detail: "Tenant" });
  for (const v of (vendors.data ?? []) as any[]) if (last10(v.phone) === key) found.push({ kind: "vendor", id: v.id, name: v.company_name, detail: v.contact_name ? `Contractor · ${v.contact_name}` : "Contractor" });
  return found;
}

/** E.164-ish: keeps a leading +, otherwise assumes a 10-digit number is North American. */
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function fromTelLink(a: Element): Target | null {
  const raw = decodeURIComponent((a.getAttribute("href") ?? "").replace(/^tel:/i, "")).trim();
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 ? { display: a.textContent?.trim() || raw, to: toE164(raw) } : null;
}

/** The phone number under the pointer, if the click landed on one in ordinary text. */
function fromPoint(x: number, y: number): Target | null {
  let node: Node | null = null;
  let offset = 0;
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) { node = pos.offsetNode; offset = pos.offset; }
  } else if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range) { node = range.startContainer; offset = range.startOffset; }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? "";
  for (const m of text.matchAll(PHONE_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (offset < start || offset > end) continue;
    if (m[0].replace(/\D/g, "").length < 10) return null;
    // the pointer must really be over the number, not on blank space after a short line
    const range = document.createRange();
    range.setStart(node, start); range.setEnd(node, end);
    const hit = [...range.getClientRects()].some((r) => x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1);
    return hit ? { display: m[0], to: toE164(m[0]) } : null;
  }
  return null;
}

const SKIP = "input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-no-sms], .sms-popup";

export default function PhoneSmsPopup() {
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target : null;
      if (!el || el.closest(SKIP)) return;
      const link = el.closest('a[href^="tel:" i]');
      let hit: Target | null = null;
      if (link) hit = fromTelLink(link);
      else {
        if (!window.getSelection()?.isCollapsed) return; // the user is selecting text
        if (el.closest("a[href], button")) return; // leave other links and buttons alone
        hit = fromPoint(e.clientX, e.clientY);
      }
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget(hit);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return target ? createPortal(<Composer key={target.to} target={target} onClose={() => setTarget(null)} />, document.body) : null;
}

function Composer({ target, onClose }: { target: Target; onClose: () => void }) {
  const [body, setBody] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" | "error"; message?: string }>({ kind: "idle" });
  const panel = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const [contacts, setContacts] = useState<Contact[] | null>(isSupabaseConfigured ? null : []);
  const [pick, setPick] = useState(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => area.current?.focus(), 20);
    const keydown = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", keydown);
    return () => { window.clearTimeout(timer); document.removeEventListener("keydown", keydown); previous?.focus?.(); };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let live = true;
    findContacts(target.to).then((c) => { if (live) setContacts(c); }).catch(() => { if (live) setContacts([]); });
    return () => { live = false; };
  }, [target.to]);
  const contact = contacts?.[pick] ?? null;

  const canSend = isSupabaseConfigured && contacts !== null && body.trim().length > 0 && state.kind !== "sending" && state.kind !== "sent";

  async function send() {
    if (!canSend) return;
    setState({ kind: "sending" });
    try {
      const text = body.trim();
      const result = await sendSms({
        to: target.to, body: text, triggerSource: "manual", category: "general",
        recipientName: contact?.name, tenantId: contact?.kind === "tenant" ? contact.id : null,
        relatedEntityType: contact?.kind ?? null, relatedEntityId: contact?.id ?? null,
      });
      if (!result.ok) { setState({ kind: "error", message: result.error || "The message could not be sent." }); return; }
      // file it under the person: their text thread in Messages and their activity (best effort: the text is already on its way)
      let note = contact ? `Message sent and saved to ${contact.name}'s Messages and activity.` : "Message sent.";
      const org = getActiveOrgId();
      if (contact && org) {
        const problems = await fileSentText(org, contact, target.display, text);
        if (problems.length) note = `Message sent, but not everything was saved. ${problems.join(" ")}`;
      }
      setState({ kind: "sent", message: note });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "The message could not be sent." });
    }
  }

  return (
    <div className="u-root sms-popup fixed inset-0 z-[400] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-u-card text-u-ink shadow-2xl sm:rounded-xl">
        <div className="flex items-start gap-3 border-b border-u-line px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-u-accent-soft text-u-accent"><MessageSquareText size={17} /></span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-semibold text-u-ink">Send a text message</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-u-muted"><Phone size={12} /> To <span className="font-medium text-u-ink2">{contact ? `${contact.name} · ` : ""}{target.display}</span></p>
            {isSupabaseConfigured && contacts !== null && !contact && <p className="mt-0.5 text-[11px] text-u-muted">Not linked to a tenant or contractor, so it is logged against the number only.</p>}
            {contact && contacts!.length === 1 && <p className="mt-0.5 text-[11px] text-u-muted">{contact.detail}. The text will be saved to their Messages and activity.</p>}
          </div>
          <button type="button" onClick={onClose} className="ml-auto rounded-md p-1.5 text-u-muted hover:bg-u-s3 hover:text-u-ink2" aria-label="Close"><X size={17} /></button>
        </div>

        <div className="space-y-2 px-5 py-4">
          {!isSupabaseConfigured && (
            <p role="status" className="rounded-lg border border-u-warn/30 bg-u-warn-soft px-3 py-2 text-[12px] leading-5 text-u-ink2">Texting needs a connected Supabase project, so this demo build cannot send. Your message is not saved.</p>
          )}
          {contacts && contacts.length > 1 && (
            <div>
              <label htmlFor="sms-popup-who" className="block text-[12px] font-medium text-u-ink2">This number belongs to more than one record. Log it for:</label>
              <select id="sms-popup-who" value={pick} onChange={(e) => setPick(Number(e.target.value))} className="mt-1 h-9 w-full rounded-lg border border-u-line bg-u-card px-2 text-[13px] text-u-ink">
                {contacts.map((c, i) => <option key={`${c.kind}${c.id}`} value={i}>{c.name} ({c.detail})</option>)}
              </select>
            </div>
          )}
          <label htmlFor="sms-popup-body" className="block text-[12px] font-medium text-u-ink2">Message</label>
          <textarea
            id="sms-popup-body" ref={area} rows={5} maxLength={MAX_LENGTH} value={body} disabled={state.kind === "sent"}
            onChange={(e) => { setBody(e.target.value); if (state.kind === "error") setState({ kind: "idle" }); }}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void send(); }}
            className="w-full resize-none rounded-lg border border-u-line bg-u-card px-3 py-2 text-[13px] leading-5 text-u-ink outline-none focus:border-u-accent"
            placeholder="Type your message…"
          />
          <div className="flex items-center justify-between text-[11px] text-u-muted">
            <span>Ctrl + Enter to send</span>
            <span>{body.length}/{MAX_LENGTH}</span>
          </div>
          {state.kind === "error" && <p role="alert" className="text-[12px] text-u-danger">{state.message}</p>}
          {state.kind === "sent" && <p role="status" className="text-[12px] font-medium text-u-ok">{state.message}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-u-line bg-u-s2/70 px-5 py-3.5">
          <button type="button" onClick={onClose} className="min-h-9 rounded-lg border border-u-line2 bg-u-card px-3.5 text-[13px] font-semibold text-u-ink2 hover:bg-u-s2">{state.kind === "sent" ? "Done" : "Cancel"}</button>
          {state.kind !== "sent" && (
            <button type="button" onClick={() => void send()} disabled={!canSend} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-u-accent px-3.5 text-[13px] font-semibold text-u-onaccent hover:bg-u-accent-strong disabled:opacity-50">
              {state.kind === "sending" && <LoaderCircle size={14} className="animate-spin" />}{state.kind === "sending" ? "Sending…" : "Send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
