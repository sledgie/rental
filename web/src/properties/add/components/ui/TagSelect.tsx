import { Check } from "lucide-react";
import { cn } from "../../utils/cn";

interface TagSelectProps {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}

export function TagSelect({ options, value, onChange }: TagSelectProps) {
  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            aria-pressed={selected}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              selected
                ? "border-mint-500/60 bg-mint-500/15 text-mint-300"
                : "border-moss-700 bg-moss-900 text-moss-400 hover:border-moss-600 hover:text-moss-200"
            )}
          >
            {selected && <Check size={12} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}
