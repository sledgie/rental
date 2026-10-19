import type { ReactNode } from "react";
import { cn } from "@inv/utils/cn";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-5", className)}>
      {breadcrumb ? <div className="mb-2.5">{breadcrumb}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[13.5px] text-ink-muted">{subtitle}</p>
          ) : null}
          {meta ? <div className="mt-3">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
