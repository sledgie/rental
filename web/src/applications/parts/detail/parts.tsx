import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Button } from "../../components/ui/Button";

export function ActionGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-1.5", className)}>{children}</div>;
}

export function SubSection({
  title,
  hint,
  actions,
  children,
  className,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-u-line bg-u-card/60 p-3", className)}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-[12px] font-semibold text-u-ink">{title}</h4>
          {hint && <p className="text-[11px] text-u-muted">{hint}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function MiniTable({
  head,
  children,
  className,
}: {
  head: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-u-line", className)}>
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-u-line bg-u-s2/70 text-left">
            {head.map((h) => (
              <th
                key={h}
                className="px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.08em] whitespace-nowrap text-u-muted uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-u-line/70">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-2.5 py-1.5 align-top text-u-ink2", className)}>
      {children}
    </td>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-u-line2 bg-u-s2/50 px-3 py-3 text-[12px] text-u-muted">
      {children}
    </p>
  );
}

export function PrimaryAction({
  children,
  onClick,
  icon,
  tone = "secondary",
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
  tone?: "primary" | "secondary" | "ghost" | "success" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Button size="xs" variant={tone} icon={icon} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </Button>
  );
}

export function Note({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warn" | "info" }) {
  return (
    <p
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-[11.5px] leading-relaxed",
        tone === "warn" && "border-u-warn/30 bg-u-warn/8 text-u-warn/90",
        tone === "info" && "border-u-accent/30 bg-u-accent/8 text-u-accent/90",
        tone === "muted" && "border-u-line bg-u-s2/60 text-u-muted",
      )}
    >
      {children}
    </p>
  );
}
