import { useState } from "react";
import { useNavigate } from "../../shim/router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Crown,
  Globe2,
  Info,
  Sparkles,
} from "lucide-react";
import { SetupLayout } from "../../layouts/SetupLayout";
import { Alert, Badge, Button, Card, SelectInput, TextInput } from "../../components/ui";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useToast } from "../../contexts/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { BUSINESS_TYPES, COUNTRIES, CURRENCIES, TIMEZONES } from "../../lib/constants";
import type { BusinessType, OrganizationInput } from "../../lib/types";

const defaultCountry = "United States";
const defaults: OrganizationInput = {
  name: "",
  businessType: "Individual Landlord",
  country: defaultCountry,
  currency: "USD",
  timezone: "America/New_York",
};

export default function CreateOrganizationPage() {
  useDocumentTitle("Create an organization");
  const navigate = useNavigate();
  const { createOrganization, workspaces } = useOrganization();
  const { toast } = useToast();

  const [form, setForm] = useState<OrganizationInput>(defaults);
  const [errors, setErrors] = useState<Partial<Record<keyof OrganizationInput | "form", string>>>({});
  const [saving, setSaving] = useState(false);

  function update<K extends keyof OrganizationInput>(key: K, value: OrganizationInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }

  function handleCountry(country: string) {
    const presets: Record<string, { currency: string; timezone: string }> = {
      Canada: { currency: "CAD", timezone: "America/Toronto" },
      "United States": { currency: "USD", timezone: "America/New_York" },
      "United Kingdom": { currency: "GBP", timezone: "Europe/London" },
      Australia: { currency: "AUD", timezone: "Australia/Sydney" },
      "New Zealand": { currency: "NZD", timezone: "Pacific/Auckland" },
      Ireland: { currency: "EUR", timezone: "Europe/Dublin" },
      Germany: { currency: "EUR", timezone: "Europe/Paris" },
      France: { currency: "EUR", timezone: "Europe/Paris" },
      Spain: { currency: "EUR", timezone: "Europe/Paris" },
      Netherlands: { currency: "EUR", timezone: "Europe/Paris" },
      "United Arab Emirates": { currency: "AED", timezone: "Asia/Dubai" },
      Singapore: { currency: "SGD", timezone: "Asia/Singapore" },
    };
    const preset = presets[country];
    setForm((current) => ({
      ...current,
      country,
      currency: preset?.currency ?? current.currency,
      timezone: preset?.timezone ?? current.timezone,
    }));
    setErrors((current) => ({ ...current, country: undefined }));
  }

  function handleCancel() {
    navigate(workspaces.length > 0 ? "/app/dashboard" : "/onboarding");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Enter an organization name.";
    else if (form.name.trim().length < 2) next.name = "Use at least 2 characters.";
    else if (form.name.trim().length > 60) next.name = "Keep the name under 60 characters.";
    if (!form.businessType) next.businessType = "Choose a business type.";
    if (!form.country) next.country = "Choose a country.";
    if (!form.currency) next.currency = "Choose a default currency.";
    if (!form.timezone) next.timezone = "Choose a time zone.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const organization = await createOrganization(form);
      toast({
        title: "Workspace created",
        description: `${organization.name} is ready. You were added as Owner.`,
        variant: "success",
      });
      navigate("/app/dashboard", { replace: true });
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "We couldn't create the organization." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SetupLayout>
      <button
        type="button"
        onClick={handleCancel}
        className="focus-ring mb-5 inline-flex items-center gap-1.5 rounded text-[12px] font-medium text-u-muted transition hover:text-u-ink"
      >
        <ArrowLeft className="size-3.5" />
        {workspaces.length > 0 ? "Back to workspace" : "Back to setup options"}
      </button>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="animate-fade-up overflow-hidden">
          <div className="border-b border-u-line px-5 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-u-accent to-u-accent shadow-[0_8px_20px_-8px_rgba(37,99,235,0.7)]">
                <Building2 className="size-5 text-u-onaccent" />
              </span>
              <div>
                <h1 className="text-[20px] font-semibold tracking-[-0.03em] text-u-ink">
                  Create an organization
                </h1>
                <p className="mt-1 text-[12.5px] leading-relaxed text-u-muted">
                  Set the foundation for your rental business. You can adjust these settings later.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4 px-5 py-5 sm:px-6">
            {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}

            <TextInput
              label="Organization name"
              placeholder="e.g. Carter Property Group"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              error={errors.name}
              required
              autoFocus
              disabled={saving}
              hint="This is visible to your team and on invitations."
              maxLength={60}
              counter={<span className="text-[10.5px] text-u-muted">{form.name.length}/60</span>}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput
                label="Business type"
                value={form.businessType}
                onChange={(event) => update("businessType", event.target.value as BusinessType)}
                options={BUSINESS_TYPES.map((type) => ({ value: type, label: type }))}
                error={errors.businessType}
                required
                disabled={saving}
              />
              <SelectInput
                label="Country"
                value={form.country}
                onChange={(event) => handleCountry(event.target.value)}
                options={COUNTRIES.map((country) => ({ value: country, label: country }))}
                error={errors.country}
                required
                disabled={saving}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput
                label="Default currency"
                value={form.currency}
                onChange={(event) => update("currency", event.target.value)}
                options={CURRENCIES.map((currency) => ({ value: currency.code, label: currency.label }))}
                error={errors.currency}
                required
                hint="Used for rent, invoices, and reports."
                disabled={saving}
              />
              <SelectInput
                label="Time zone"
                value={form.timezone}
                onChange={(event) => update("timezone", event.target.value)}
                options={TIMEZONES.map((timezone) => ({ value: timezone.value, label: timezone.label }))}
                error={errors.timezone}
                required
                disabled={saving}
              />
            </div>

            <div className="rounded-lg border border-u-line bg-u-s2/70 px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <Info className="mt-0.5 size-3.5 shrink-0 text-u-muted" />
                <p className="text-[11px] leading-relaxed text-u-muted">
                  Submitting creates the organization and your <span className="font-medium text-u-ink2">Owner</span>{" "}
                  membership together. If anything fails, neither is saved. No organization exists until you
                  click Create Workspace.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-u-line pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} iconRight={ArrowRight}>
                Create Workspace
              </Button>
            </div>
          </form>
        </Card>

        <div className="animate-fade-up space-y-4" style={{ animationDelay: "80ms" }}>
          <Card className="overflow-hidden">
            <div className="border-b border-u-line bg-gradient-to-br from-u-line2 to-u-line2 px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-u-card/10 ring-1 ring-white/15">
                  <Crown className="size-4 text-u-warn" />
                </span>
                <Badge tone="blue" className="border border-u-card/10 bg-u-card/10 text-u-onaccent ring-white/10">
                  Owner role
                </Badge>
              </div>
              <p className="mt-3 text-[13px] font-semibold text-u-onaccent">Your workspace, fully in your control</p>
              <p className="mt-1 text-[11px] leading-relaxed text-u-muted">
                The first member of every organization is its Owner.
              </p>
            </div>
            <div className="space-y-2.5 px-4 py-4">
              {[
                "Create and manage properties, units, and leases",
                "Invite Administrators and operational staff",
                "Configure roles and organization settings",
                "Transfer ownership only when you decide",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-u-accent" />
                  <p className="text-[11.5px] leading-relaxed text-u-ink2">{item}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-u-ink2">
              <Globe2 className="size-3.5 text-u-muted" /> Regional defaults
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-u-muted">
              Currency and time zone can be changed any time from Organization settings. Country selection
              pre-fills the most common regional options.
            </p>
          </Card>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-u-muted">
            <Sparkles className="size-3" />
            Activity logging starts on creation
          </div>
        </div>
      </div>
    </SetupLayout>
  );
}
