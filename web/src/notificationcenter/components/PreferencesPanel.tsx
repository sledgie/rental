import { Bell, CalendarClock, Mail, MessageSquare, RotateCcw } from "lucide-react";
import { DEFAULT_MINIMUM, CATEGORY_ORDER, SEVERITY_ORDER, type Category, type Preference, type Preferences } from "../types";
import { CATEGORY_META, SEVERITY_META } from "../meta";
import { cx } from "./NotificationRow";

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cx("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50", checked ? "border-u-accent bg-u-accent" : "border-u-line2 bg-u-s3")}>
      <span aria-hidden className="inline-block rounded-full bg-u-card shadow transition-transform" style={{ width: 18, height: 18, transform: `translateX(${checked ? 22 : 2}px)` }} />
    </button>
  );
}

const SOON = [
  { icon: MessageSquare, title: "Text message alerts", text: "Texts to you for critical events need a sender that is not connected to your account yet." },
  { icon: Mail, title: "Email notifications", text: "Email delivery of notifications is not available yet." },
  { icon: CalendarClock, title: "Scheduled digests", text: "Daily and weekly summaries need a background worker, which is not running yet." },
];

export default function PreferencesPanel({ preferences, orgName, onChange, onReset }: {
  preferences: Preferences; orgName: string; onChange: (category: Category, patch: Partial<Preference>) => void; onReset: () => void;
}) {
  const changed = CATEGORY_ORDER.some((c) => preferences[c].enabled !== true || preferences[c].minimumSeverity !== DEFAULT_MINIMUM[c]);
  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-u-ink">What should create a notification for you?</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-u-muted">These settings are yours alone and apply to {orgName}. They decide which new events reach your inbox; what is already there stays until you read or dismiss it.</p>
        </div>
        <button type="button" className="nc-btn" disabled={!changed} onClick={onReset}><RotateCcw size={14} />Restore defaults</button>
      </div>

      <ul className="divide-y divide-u-line rounded-xl border border-u-line bg-u-card">
        {CATEGORY_ORDER.map((category) => {
          const meta = CATEGORY_META[category];
          const pref = preferences[category];
          return (
            <li key={category} className={cx("flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4", !pref.enabled && "bg-u-s2/50")}>
              <span aria-hidden className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg", meta.tone)}><meta.icon size={17} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-u-ink">{meta.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-u-muted">{meta.description}</p>
              </div>
              <div className="flex items-end gap-3">
                <div className="w-52">
                  <label htmlFor={`nc-min-${category}`} className="mb-1 block text-[11px] font-medium text-u-muted">Lowest severity</label>
                  <select id={`nc-min-${category}`} className="nc-input" disabled={!pref.enabled} value={pref.minimumSeverity} onChange={(e) => onChange(category, { minimumSeverity: e.target.value as Preference["minimumSeverity"] })}>
                    {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{SEVERITY_META[s].label} and above</option>)}
                  </select>
                </div>
                <div className="pb-1.5"><Switch checked={pref.enabled} onChange={(next) => onChange(category, { enabled: next })} label={`${meta.label} notifications`} /></div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-u-line bg-u-card">
        <div className="flex items-start gap-3 border-b border-u-line px-4 py-3.5">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-u-accent-soft text-u-accent"><Bell size={17} /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-u-ink">In-app notifications</p><p className="mt-0.5 text-xs leading-5 text-u-muted">Delivered to this page and the bell in the top bar. This is the only channel that sends anything today.</p></div>
          <span className="rounded-full bg-u-ok-soft px-2 py-0.5 text-[10.5px] font-semibold text-u-ok">Active</span>
        </div>
        <ul className="divide-y divide-u-line">
          {SOON.map((s) => (
            <li key={s.title} className="flex items-start gap-3 px-4 py-3.5">
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-u-s3 text-u-muted"><s.icon size={17} /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-u-ink">{s.title}</p><p className="mt-0.5 text-xs leading-5 text-u-muted">{s.text}</p></div>
              <span className="rounded-full bg-u-s3 px-2 py-0.5 text-[10.5px] font-semibold text-u-muted">Not available yet</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
