import type { ReactNode } from "react";

/** Section header for the Organization tabs. The page title and tab strip come from the app's page shell. */
export function SettingsHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-u-ink">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-[12px] text-u-muted">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
