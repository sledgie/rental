import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Field } from "../ui/Field";
import { Input, Select } from "../ui/Input";
import { COUNTRIES, REGION_TIMEZONE_MAP, TIME_ZONES } from "../../data/mockProperties";
import type { SectionProps } from "./PropertyFormSection";

export function AddressFields({ form, set, errors }: SectionProps) {
  const tzTouched = useRef(false);

  // Suggest a time zone from the province/state unless the user picked one manually.
  useEffect(() => {
    if (tzTouched.current) return;
    const key = form.provinceState.trim().toLowerCase();
    const suggestion = REGION_TIMEZONE_MAP[key];
    if (suggestion && suggestion !== form.timeZone) {
      set("timeZone", suggestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.provinceState]);

  const hasAddress = form.streetAddress && form.city;

  // Live map: embed the address once typing pauses, so the map isn't reloaded on every keystroke.
  const query = [form.streetAddress, form.city, form.provinceState, form.postalCode, form.country].filter(Boolean).join(", ");
  const [mapQuery, setMapQuery] = useState("");
  useEffect(() => {
    if (!hasAddress) { setMapQuery(""); return; }
    const t = window.setTimeout(() => setMapQuery(query), 900);
    return () => window.clearTimeout(t);
  }, [query, hasAddress]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <Field label="Country" htmlFor="country" required error={errors.country}>
          <Select
            id="country"
            value={form.country}
            invalid={!!errors.country}
            onChange={(e) => set("country", e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>

        <Field label="Street Address" htmlFor="streetAddress" required error={errors.streetAddress}>
          <Input
            id="streetAddress"
            value={form.streetAddress}
            invalid={!!errors.streetAddress}
            onChange={(e) => set("streetAddress", e.target.value)}
            placeholder="e.g. 2180 Lakeshore Blvd W"
          />
        </Field>

        <Field label="Unit / Suite" htmlFor="unitSuite" hint="Optional — for a specific suite or lot.">
          <Input
            id="unitSuite"
            value={form.unitSuite}
            onChange={(e) => set("unitSuite", e.target.value)}
            placeholder="e.g. Suite 400"
          />
        </Field>

        <Field label="City" htmlFor="city" required error={errors.city}>
          <Input
            id="city"
            value={form.city}
            invalid={!!errors.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="e.g. Toronto"
          />
        </Field>

        <Field label="Province / State" htmlFor="provinceState" required error={errors.provinceState}>
          <Input
            id="provinceState"
            value={form.provinceState}
            invalid={!!errors.provinceState}
            onChange={(e) => set("provinceState", e.target.value)}
            placeholder="e.g. Ontario"
          />
        </Field>

        <Field label="Postal / ZIP Code" htmlFor="postalCode" required error={errors.postalCode}>
          <Input
            id="postalCode"
            value={form.postalCode}
            invalid={!!errors.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            placeholder="e.g. M8V 1A3"
          />
        </Field>

        <Field
          label="Time Zone"
          htmlFor="timeZone"
          hint="Suggested automatically from the property location — adjust if needed."
          className="md:col-span-2"
        >
          <Select
            id="timeZone"
            value={form.timeZone}
            onChange={(e) => {
              tzTouched.current = true;
              set("timeZone", e.target.value);
            }}
          >
            <option value="">Select a time zone…</option>
            {TIME_ZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Map preview */}
      <div className="relative h-56 overflow-hidden rounded-lg border border-moss-800 bg-moss-900">
        {mapQuery ? (
          <iframe
            key={mapQuery}
            title={`Map of ${mapQuery}`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-4 text-center">
            <MapPin size={22} className="text-mint-400" />
            <p className="text-xs text-moss-500">
              {hasAddress ? "Loading map…" : "Map preview — enter a street address and city to see it here."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
