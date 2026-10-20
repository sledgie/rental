import type { ReactNode, TextareaHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import { Button } from "./Button";
import { Modal } from "./Overlay";

const control =
  "w-full rounded-lg border border-u-line2 bg-u-s2 px-2.5 py-1.5 text-[13px] text-u-ink placeholder:text-u-muted transition-colors focus:border-u-accent focus:outline-none disabled:opacity-50";

export function Label({
  children,
  hint,
  required,
}: {
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <span className="mb-1 flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-medium tracking-wide text-u-muted uppercase">
        {children}
        {required && <span className="ml-0.5 text-u-danger">*</span>}
      </span>
      {hint && <span className="text-[11px] text-u-muted/80">{hint}</span>}
    </span>
  );
}

export function Field({
  label,
  hint,
  required,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <Label hint={hint} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error && <span className="mt-1 block text-[11px] text-u-danger">{error}</span>}
    </label>
  );
}

export const Input = ({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...rest} className={cn(control, className)} />
);

export const Textarea = ({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...rest} className={cn(control, "resize-y leading-relaxed", className)} />
);

export const Select = ({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...rest} className={cn(control, "appearance-none bg-u-s2 pr-7", className)}>
    {children}
  </select>
);

export function Checkbox({
  label,
  checked,
  onChange,
  description,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-u-line bg-u-s2/60 px-2.5 py-2 transition-colors hover:border-u-line2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 accent-u-accent"
      />
      <span className="min-w-0">
        <span className="block text-[13px] leading-tight text-u-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[11px] text-u-muted">{description}</span>}
      </span>
    </label>
  );
}

/* ----------------------- Schema-driven form dialog ----------------------- */

export type FormFieldSpec =
  | {
      kind: "text" | "date" | "number" | "email" | "tel";
      name: string;
      label: string;
      required?: boolean;
      placeholder?: string;
      type?: "text" | "email" | "tel" | "date" | "number";
      hint?: string;
      span?: 1 | 2;
      defaultValue?: string;
    }
  | {
      kind: "select";
      name: string;
      label: string;
      options: readonly string[];
      required?: boolean;
      hint?: string;
      span?: 1 | 2;
      defaultValue?: string;
    }
  | {
      kind: "textarea";
      name: string;
      label: string;
      required?: boolean;
      placeholder?: string;
      rows?: number;
      hint?: string;
      span?: 1 | 2;
      defaultValue?: string;
    };

export type FormValues = Record<string, string>;

export function FormFields({
  spec,
  values,
  onChange,
}: {
  spec: FormFieldSpec[];
  values: FormValues;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {spec.map((f) => (
        <Field
          key={f.name}
          label={f.label}
          hint={f.hint}
          required={f.required}
          className={f.span === 2 ? "sm:col-span-2" : undefined}
        >
          {f.kind === "textarea" ? (
            <Textarea
              rows={f.rows ?? 3}
              value={values[f.name] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => onChange(f.name, e.target.value)}
            />
          ) : f.kind === "select" ? (
            <Select value={values[f.name] ?? ""} onChange={(e) => onChange(f.name, e.target.value)}>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              type={f.kind === "text" ? (f.type ?? "text") : f.kind}
              value={values[f.name] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => onChange(f.name, e.target.value)}
            />
          )}
        </Field>
      ))}
    </div>
  );
}

/**
 * Generic modal form used by the small module actions (review notes, status
 * updates, communication logging, party editing, ...).
 */
export function FormDialog({
  open,
  title,
  description,
  spec,
  values,
  onChange,
  onCancel,
  onSubmit,
  submitLabel = "Save",
  notice,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  spec: FormFieldSpec[];
  values: FormValues;
  onChange: (name: string, value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  notice?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const missing = spec.filter((f) => f.required && !(values[f.name] ?? "").trim());
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={missing.length > 0}
            title={missing.length ? `Required: ${missing.map((m) => m.label).join(", ")}` : undefined}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {notice}
        <FormFields spec={spec} values={values} onChange={onChange} />
      </div>
    </Modal>
  );
}
