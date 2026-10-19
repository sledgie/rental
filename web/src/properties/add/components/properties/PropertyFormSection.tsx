import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { PropertyFormData } from "../../types/property";
import type { FormErrors } from "./validation";

export interface SectionProps {
  form: PropertyFormData;
  set: <K extends keyof PropertyFormData>(key: K, value: PropertyFormData[K]) => void;
  errors: FormErrors;
}

interface PropertyFormSectionProps {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  optional?: boolean;
  children: ReactNode;
}

export function PropertyFormSection({
  id,
  icon: Icon,
  title,
  description,
  optional,
  children,
}: PropertyFormSectionProps) {
  return (
    <section
      id={id}
      data-form-section={id}
      className="scroll-mt-24 rounded-xl border border-moss-800/80 bg-moss-900/50"
    >
      <header className="flex items-start gap-3 border-b border-moss-800/80 px-5 py-4 sm:px-6">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mint-500/10 border border-mint-500/20 text-mint-400">
          <Icon size={17} />
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-moss-100">
            {title}
            {optional && (
              <span className="rounded-full border border-moss-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-moss-500">
                Optional
              </span>
            )}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-moss-500">{description}</p>}
        </div>
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">{children}</div>;
}
