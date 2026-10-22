import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Info, LoaderCircle, Search, X } from "lucide-react";
import type { Channel, LogStatus, TemplateStatus } from "../lib/types";

export function Button({ variant = "primary", size = "md", loading, children, className = "", disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "icon"; loading?: boolean }) {
  const variants = { primary: "bg-u-accent text-u-onaccent border-u-accent/60 hover:bg-u-accent-strong shadow-sm", secondary: "bg-u-card text-u-ink2 border-u-line2 hover:bg-u-s2", ghost: "bg-transparent text-u-ink2 border-transparent hover:bg-u-s3", danger: "bg-u-card text-u-danger border-u-danger/30 hover:bg-u-danger-soft" };
  const sizes = { sm: "min-h-8 px-2.5 py-1.5 text-xs rounded-md", md: "min-h-10 px-3.5 py-2 text-[13px] rounded-lg", icon: "h-9 w-9 p-0 rounded-lg" };
  return <button className={`inline-flex shrink-0 items-center justify-center gap-2 border font-semibold transition-colors disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...props}>{loading && <LoaderCircle size={14} className="spin" />}{children}</button>;
}

export function Badge({ children, tone = "neutral", dot = false }: { children: ReactNode; tone?: "neutral" | "blue" | "green" | "amber" | "red" | "purple"; dot?: boolean }) {
  const tones = { neutral: "bg-u-s3 text-u-ink2 border-u-line", blue: "bg-u-accent-soft text-u-accent border-u-accent/30", green: "bg-u-ok-soft text-u-ok border-u-ok/30", amber: "bg-u-warn-soft text-u-warn border-u-warn/30", red: "bg-u-danger-soft text-u-danger border-u-danger/30", purple: "bg-u-violet/15 text-u-violet border-u-violet/30" };
  const dots = { neutral: "bg-u-line2", blue: "bg-u-accent", green: "bg-u-ok", amber: "bg-u-warn", red: "bg-u-danger", purple: "bg-u-violet" };
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 ${tones[tone]}`}>{dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dots[tone]}`} />}<span className="truncate">{children}</span></span>;
}

export function ChannelBadge({ channel }: { channel: Channel }) {
  return <Badge tone={channel === "email" ? "blue" : channel === "sms" ? "purple" : "neutral"}>{channel === "in_app" ? "In-App" : channel.toUpperCase()}</Badge>;
}
export function StatusBadge({ status }: { status: TemplateStatus | LogStatus | "active" | "inactive" | "configured" }) {
  const tone = ["active", "delivered"].includes(status) ? "green" : ["failed", "bounced"].includes(status) ? "red" : ["draft", "queued", "sending", "cancelled", "inactive"].includes(status) ? "neutral" : ["sent", "opened"].includes(status) ? "blue" : "amber";
  return <Badge tone={tone} dot>{status.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

export function Field({ label, error, hint, required, children, htmlFor, className = "" }: { label: string; error?: string; hint?: string; required?: boolean; children: ReactNode; htmlFor?: string; className?: string }) {
  return <div className={className}><label htmlFor={htmlFor} className="label">{label}{required && <span className="ml-1 text-u-danger" aria-hidden="true">*</span>}</label>{children}{error ? <p className="mt-1.5 text-xs text-u-danger" role="alert">{error}</p> : hint ? <p className="mt-1.5 text-[11px] leading-4 text-u-muted">{hint}</p> : null}</div>;
}

export function SearchInput({ value, onChange, placeholder = "Search", className = "" }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return <div className={`relative ${className}`}><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-u-muted" /><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="input pl-9" aria-label={placeholder} /></div>;
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return <label className={`flex items-start gap-3 ${disabled ? "opacity-50" : ""}`}><button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-u-accent" : "bg-u-line"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-u-card shadow-sm transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} /></button><span><span className="block text-[13px] font-medium text-u-ink2">{label}</span>{description && <span className="mt-0.5 block text-[11px] leading-4 text-u-muted">{description}</span>}</span></label>;
}

export function Modal({ open, onClose, title, description, children, footer, size = "lg" }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" | "full" }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => panelRef.current?.focus(), 20);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']");
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { window.clearTimeout(timer); document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [open]);
  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-2xl", xl: "max-w-5xl", full: "max-w-[1400px]" };
  return <div className="modal-backdrop fixed inset-0 z-[130] flex items-end justify-center bg-u-ink2/45 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`modal-panel flex max-h-[94dvh] w-full ${widths[size]} flex-col overflow-hidden rounded-t-2xl bg-u-card shadow-2xl outline-none sm:max-h-[90dvh] sm:rounded-xl`}>
      <div className="flex items-start gap-4 border-b border-u-line px-5 py-4 sm:px-6"><div className="min-w-0"><h2 id={titleId} className="text-base font-semibold text-u-ink">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-u-muted">{description}</p>}</div><button onClick={onClose} className="ml-auto rounded-md p-1.5 text-u-muted hover:bg-u-s3 hover:text-u-ink2" aria-label="Close dialog"><X size={18} /></button></div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-u-line bg-u-s2/70 px-5 py-3.5 sm:px-6">{footer}</div>}
    </div>
  </div>;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm", destructive = false, loading = false }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string; confirmLabel?: string; destructive?: boolean; loading?: boolean }) {
  return <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={destructive ? "danger" : "primary"} className={destructive ? "bg-u-danger text-u-onaccent border-u-danger/60 hover:bg-u-danger" : ""} onClick={onConfirm} loading={loading}>{confirmLabel}</Button></>}><div className="flex gap-3 px-6 py-5"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${destructive ? "bg-u-danger-soft text-u-danger" : "bg-u-accent-soft text-u-accent"}`}><AlertTriangle size={18} /></span><p className="text-[13px] leading-6 text-u-ink2">{description}</p></div></Modal>;
}

export type ToastMessage = { id: number; type: "success" | "error" | "info"; message: string };
export function ToastRegion({ toasts, dismiss }: { toasts: ToastMessage[]; dismiss: (id: number) => void }) {
  return <div className="pointer-events-none fixed bottom-4 right-4 z-[140] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite" aria-atomic="false">{toasts.map((toast) => <div key={toast.id} className={`toast-enter pointer-events-auto flex items-start gap-3 rounded-lg border bg-u-card p-3.5 shadow-xl ${toast.type === "success" ? "border-u-ok/30" : toast.type === "error" ? "border-u-danger/30" : "border-u-accent/30"}`}><span className={`mt-0.5 ${toast.type === "success" ? "text-u-ok" : toast.type === "error" ? "text-u-danger" : "text-u-accent"}`}>{toast.type === "success" ? <Check size={17} /> : <Info size={17} />}</span><p className="flex-1 text-xs font-medium leading-5 text-u-ink2">{toast.message}</p><button onClick={() => dismiss(toast.id)} className="text-u-muted hover:text-u-ink2" aria-label="Dismiss notification"><X size={15} /></button></div>)}</div>;
}

export function useToast() {
  const [toasts, setToasts] = useStateSafe<ToastMessage[]>([]);
  const counter = useRef(0);
  function notify(message: string, type: ToastMessage["type"] = "success") {
    const id = ++counter.current;
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5000);
  }
  return { toasts, notify, dismiss: (id: number) => setToasts((items) => items.filter((item) => item.id !== id)) };
}

// Local wrapper keeps the toast hook dependency-free while preserving state semantics.
import { useState as useStateSafe } from "react";

export function Pagination({ page, pageCount, onPage, total, shown }: { page: number; pageCount: number; onPage: (page: number) => void; total: number; shown: number }) {
  return <div className="flex flex-col items-center justify-between gap-3 border-t border-u-line px-4 py-3 text-xs text-u-muted sm:flex-row"><p>Showing <span className="font-medium text-u-ink2">{shown}</span> of <span className="font-medium text-u-ink2">{total}</span></p><div className="flex items-center gap-1"><Button variant="secondary" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></Button><span className="px-3">Page {page} of {pageCount}</span><Button variant="secondary" size="icon" className="h-8 w-8" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={15} /></Button></div></div>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start"><div className="max-w-3xl">{eyebrow && <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.13em] text-u-accent">{eyebrow}</p>}<h1 className="text-[24px] font-semibold tracking-[-.025em] text-u-ink sm:text-[28px]">{title}</h1><p className="mt-2 text-[13px] leading-5 text-u-muted">{description}</p></div>{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}</div>;
}
