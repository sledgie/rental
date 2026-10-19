// Properties page: the directory (Tenants-style master/detail table) or the full add/edit form.
import { useEffect, useState } from "react";
import type { Property } from "./data/properties";
import type { PropertyRecord } from "./add/types/property";
import { PropertyForm } from "./add/components/properties/PropertyForm";
import { ToastProvider } from "./add/components/ui/Toast";
import { toProperty, toRecord } from "./add/convert";
import PropertiesView from "./PropertiesView";
import { getRecord, saveProperty, useProperties } from "./store";

export default function Properties({
  params,
  notify,
}: {
  params?: Record<string, string>;
  notify?: (message: string) => void;
}) {
  const properties = useProperties();
  // null = directory; { property: null } = adding; { property } = editing
  const [form, setForm] = useState<{ property: Property | null } | null>(null);

  // "+ Property" in the top bar links here with ?new=1
  useEffect(() => {
    if (!params?.new) return;
    setForm({ property: null });
    window.history.replaceState(null, "", "#/properties");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, [params?.new]);

  const onSave = (record: PropertyRecord) => {
    const prev = properties.find((x) => x.code === record.id);
    saveProperty(toProperty(record, prev), record);
    setForm(null);
  };

  return (
    // the toast container renders outside the page wrapper, so give it the .rd colour scope too
    <div className="rd contents">
      <ToastProvider>
        {form ? (
          <div className="rd bg-canvas text-ink">
            <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
              <PropertyForm
                key={form.property?.code ?? "new"}
                existing={form.property ? getRecord(form.property.code) ?? toRecord(form.property) : undefined}
                onSave={onSave}
                onClose={() => setForm(null)}
              />
            </div>
          </div>
        ) : (
          <PropertiesView
            properties={properties}
            onAdd={() => setForm({ property: null })}
            onEdit={(p) => setForm({ property: p })}
            notify={notify}
          />
        )}
      </ToastProvider>
    </div>
  );
}
