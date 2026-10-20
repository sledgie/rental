import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import { cn } from './utils/cn';
import type { Priority, RequestStatus } from './types';
import { initials } from './utils';

// ── Buttons ──────────────────────────────────────────────────────────────────

export function PrimaryButton({
  children, onClick, className, disabled, type,
}: {
  children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean; type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type ?? 'button'}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg bg-u-accent px-3.5 py-2 text-[13px] font-semibold text-u-onaccent shadow-sm transition hover:bg-u-accent disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children, onClick, className, disabled, danger,
}: {
  children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
        danger
          ? 'border-u-danger/30 bg-u-danger/10 text-u-danger hover:bg-u-danger/20'
          : 'border-u-line bg-u-s2 text-u-ink2 hover:border-u-line2 hover:bg-u-s3 hover:text-u-ink',
        className
      )}
    >
      {children}
    </button>
  );
}

export function SmallButton({
  children, onClick, className, disabled,
}: {
  children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-u-line bg-u-s2 px-2 py-1 text-[11.5px] font-medium text-u-ink2 transition hover:border-u-line2 hover:text-u-ink disabled:opacity-40',
        className
      )}
    >
      {children}
    </button>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function Modal({
  open, onClose, title, subtitle, children, footer, wide, xwide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  xwide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="u-root">
    <div data-modal className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto p-4 py-8 sm:py-12">
      <div className="fixed inset-0 bg-u-bg/70 backdrop-blur-[2px] animate-ap-slide-up" onClick={onClose} />
      <div
        className={cn(
          'relative w-full rounded-2xl border border-u-line bg-u-card shadow-2xl shadow-black/60 animate-ap-slide-up',
          xwide ? 'max-w-4xl' : wide ? 'max-w-2xl' : 'max-w-lg'
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-u-line px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-u-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-u-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-u-muted transition hover:bg-u-s3 hover:text-u-ink"
            aria-label="Close"
          >
            <X className="h-4.5 w-4.5" size={18} />
          </button>
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-u-line px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={danger ? 'bg-u-danger text-u-onaccent hover:bg-u-danger' : undefined}
          >
            {confirmLabel}
          </PrimaryButton>
        </>
      }
    >
      <div className="flex gap-3">
        {danger && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-u-danger/15 text-u-danger">
            <AlertTriangle size={17} />
          </div>
        )}
        <div className="text-[13.5px] leading-relaxed text-u-ink2">{body}</div>
      </div>
    </Modal>
  );
}

// ── Form controls ────────────────────────────────────────────────────────────

export function Field({
  label, required, error, hint, children, className,
}: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-u-ink2">
        {label}
        {required && <span className="ml-0.5 text-u-danger">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11.5px] text-u-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11.5px] text-u-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-u-line bg-u-s2 px-3 py-2 text-[13px] text-u-ink placeholder:text-u-muted outline-none transition focus:border-u-accent/60 focus:ring-2 focus:ring-u-accent/15 disabled:opacity-50';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, 'min-h-[72px] resize-y', props.className)} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={cn(inputCls, 'appearance-none pr-8 [&>option]:bg-u-s2', props.className)} />
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-u-muted" />
    </div>
  );
}

export function MoneyInput({
  value, onChange, placeholder = '0.00',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-u-muted">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputCls, 'pl-7 tabular')}
      />
    </div>
  );
}

export function FormSection({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-u-line bg-u-s2/50 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-u-ink2">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

// ── Badges ───────────────────────────────────────────────────────────────────

const dot = 'inline-block h-1.5 w-1.5 rounded-full';

export const STATUS_STYLES: Record<RequestStatus, string> = {
  Draft: 'bg-u-muted/10 text-u-ink2 ring-u-line/25',
  New: 'bg-u-blue/10 text-u-blue ring-u-blue/25',
  'Under Review': 'bg-u-violet/10 text-u-violet ring-u-violet/25',
  'Awaiting Approval': 'bg-u-warn/10 text-u-warn ring-u-warn/25',
  Approved: 'bg-u-accent/10 text-u-accent ring-u-accent/25',
  Assigned: 'bg-u-blue/10 text-u-blue ring-u-blue/25',
  'In Progress': 'bg-u-blue/10 text-u-blue ring-u-blue/25',
  'On Hold': 'bg-u-warn/10 text-u-warn ring-u-warn/25',
  Completed: 'bg-u-ok/10 text-u-ok ring-u-ok/25',
  Closed: 'bg-u-muted/10 text-u-muted ring-u-line/25',
  Rejected: 'bg-u-danger/10 text-u-danger ring-u-danger/25',
  Cancelled: 'bg-u-muted/10 text-u-muted ring-u-line/25',
};

export const STATUS_DOT: Record<RequestStatus, string> = {
  Draft: 'bg-u-muted', New: 'bg-u-blue', 'Under Review': 'bg-u-violet',
  'Awaiting Approval': 'bg-u-warn', Approved: 'bg-u-accent', Assigned: 'bg-u-blue',
  'In Progress': 'bg-u-blue', 'On Hold': 'bg-u-warn', Completed: 'bg-u-ok',
  Closed: 'bg-u-muted', Rejected: 'bg-u-danger', Cancelled: 'bg-u-muted',
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', STATUS_STYLES[status], className)}>
      <span className={cn(dot, STATUS_DOT[status])} />
      {status}
    </span>
  );
}

export const PRIORITY_STYLES: Record<Priority, string> = {
  Emergency: 'bg-u-danger/15 text-u-danger ring-u-danger/40',
  High: 'bg-u-warn/10 text-u-warn ring-u-warn/30',
  Normal: 'bg-u-muted/10 text-u-ink2 ring-u-line/25',
  Low: 'bg-u-muted/5 text-u-muted ring-u-line/20',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', PRIORITY_STYLES[priority])}>
      <span className={cn(dot, priority === 'Emergency' ? 'bg-u-danger animate-pulse' : priority === 'High' ? 'bg-u-warn' : 'bg-u-muted')} />
      {priority}
    </span>
  );
}

export function Chip({ children, tone = 'zinc', className }: { children: React.ReactNode; tone?: 'zinc' | 'red' | 'amber' | 'green' | 'teal' | 'sky'; className?: string }) {
  const tones: Record<string, string> = {
    zinc: 'bg-u-muted/10 text-u-ink2 ring-u-line/25',
    red: 'bg-u-danger/10 text-u-danger ring-u-danger/30',
    amber: 'bg-u-warn/10 text-u-warn ring-u-warn/30',
    green: 'bg-u-ok/10 text-u-ok ring-u-ok/30',
    teal: 'bg-u-accent/10 text-u-accent ring-u-accent/30',
    sky: 'bg-u-blue/10 text-u-blue ring-u-blue/30',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, 'green' | 'amber' | 'red' | 'zinc' | 'sky'> = {
    Paid: 'green', Unpaid: 'amber', 'Partially Paid': 'sky', Overdue: 'red',
  };
  return <Chip tone={map[status] ?? 'zinc'}>{status}</Chip>;
}

// ── Misc ─────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['bg-u-accent', 'bg-u-blue', 'bg-u-violet', 'bg-u-warn', 'bg-u-danger', 'bg-u-ok', 'bg-u-blue', 'bg-u-warn'];

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const sz = size === 'sm' ? 'h-6 w-6 text-[9px]' : size === 'lg' ? 'h-10 w-10 text-[13px]' : 'h-8 w-8 text-[11px]';
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-u-ink', color, sz)}>
      {initials(name)}
    </span>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-u-s3 text-u-muted">{icon}</div>
      <p className="text-[13.5px] font-medium text-u-ink2">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[12.5px] text-u-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DetailItem({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-u-muted">{label}</dt>
      <dd className="mt-1 text-[13px] text-u-ink">{children}</dd>
    </div>
  );
}

export function SectionTitle({ children, action, icon }: { children: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h4 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-u-ink2">
        {icon}
        {children}
      </h4>
      {action}
    </div>
  );
}

// Dropdown menu (click-outside aware)
export function Menu({
  trigger, items, align = 'right', dropUp = false,
}: {
  trigger: React.ReactNode;
  items: { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean; divider?: boolean; disabled?: boolean }[];
  align?: 'left' | 'right';
  dropUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute z-40 w-56 rounded-xl border border-u-line bg-u-s2 p-1 shadow-xl shadow-black/50 animate-ap-slide-up',
            dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="mx-2 my-1 border-t border-u-line" />
            ) : (
              <button
                key={i}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition disabled:opacity-40',
                  item.danger ? 'text-u-danger hover:bg-u-danger/10' : 'text-u-ink2 hover:bg-u-s3 hover:text-u-ink'
                )}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function Tabs({
  tabs, active, onChange,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-u-line">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[12.5px] font-medium transition',
            active === t.key
              ? 'border-u-accent text-u-accent'
              : 'border-transparent text-u-muted hover:border-u-line2 hover:text-u-ink2'
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn('ml-1.5 rounded-full px-1.5 py-px text-[10px] font-semibold tabular', active === t.key ? 'bg-u-accent/15 text-u-accent' : 'bg-u-s3 text-u-muted')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, tone = 'teal' }: { value: number; tone?: 'teal' | 'amber' | 'red' }) {
  const colors = { teal: 'bg-u-accent', amber: 'bg-u-warn', red: 'bg-u-danger' };
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-u-s3">
      <div className={cn('h-full rounded-full transition-all', colors[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
