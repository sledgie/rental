import { useState } from "react";
import { Plus } from "lucide-react";
import { Select, Input } from "../ui/Field";
import { Button } from "../ui/Button";
import { useApp } from "../../context/AppContext";
import { providers } from "../../data/catalog";
import type { BillCategory } from "../../types";

const CATEGORIES: BillCategory[] = ["hydro", "gas", "water", "internet", "insurance", "property_tax", "maintenance", "other"];

/** The provider dropdown, with a small "New" form so a bill can be entered before the provider exists. */
export function ProviderSelect({ value, onChange }: { value: string; onChange: (providerId: string) => void }) {
  const { addProvider, pushToast } = useApp();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<BillCategory>("hydro");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return pushToast("Enter the provider's name.", "error");
    setBusy(true);
    try {
      const provider = await addProvider({ name, category });
      onChange(provider.id);
      setAdding(false);
      setName("");
      pushToast(`${provider.name} added as a service provider.`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "The provider could not be saved.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          {providers.length === 0 && <option value="">No providers yet: add one</option>}
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-4" /> New
        </Button>
      </div>
      {adding && (
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1fr_auto_auto]">
          <Input placeholder="Provider name, e.g. Toronto Hydro" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={category} onChange={(e) => setCategory(e.target.value as BillCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </Select>
          <Button type="button" onClick={save} disabled={busy}>
            {busy ? "Saving\u2026" : "Add provider"}
          </Button>
        </div>
      )}
    </div>
  );
}
