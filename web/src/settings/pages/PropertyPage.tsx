import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderCheck,
  Home,
  Info,
  RefreshCw,
  ScrollText,
  Users,
} from "lucide-react";
import { LEASE_TEMPLATES } from "../mockSettings";
import type { PageProps } from "../types";
import { Badge, Callout, Card, CardBody, CardHeader, Checkbox, Field, Input, ListEditor, Select, SettingRow, Toggle } from "../components/ui";

const TENANT_DOCUMENT_OPTIONS = [
  "Government-issued ID",
  "Proof of income",
  "Renter's insurance",
  "Pet vaccination records",
  "Employment verification",
  "Prior landlord reference",
  "Co-signer application",
];

export default function PropertyPage({ value, update, readOnly, errors }: PageProps) {
  const docs: string[] = value.tenantDocs ?? [];
  const toggleDoc = (label: string, checked: boolean) => {
    update("tenantDocs", checked ? [...docs, label] : docs.filter((doc) => doc !== label));
  };

  return (
    <div className="space-y-5">
      <Callout tone="warning" icon={Info} title="Defaults for new records only">
        Changing these defaults will not modify existing leases, tenants, properties or units. Each existing record keeps the values it was created with.
      </Callout>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card id="property-defaults">
          <CardHeader
            icon={Home}
            title="Property & unit defaults"
            description="Starting values when a new property, unit or lease is created."
            aside={<Badge tone="blue">New records</Badge>}
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Default property type">
              <Select value={value.propertyType} disabled={readOnly} onChange={(event) => update("propertyType", event.target.value)}>
                {["Multi-unit building", "Apartment", "Condominium", "Single-family house", "Townhouse", "Duplex / triplex", "Mixed-use building"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Default unit type">
              <Select value={value.unitType} disabled={readOnly} onChange={(event) => update("unitType", event.target.value)}>
                {["Studio / 1 bathroom", "1 bedroom / 1 bathroom", "2 bedroom / 1 bathroom", "2 bedroom / 2 bathroom", "3 bedroom / 2 bathroom", "4+ bedroom"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Default lease duration (months)" error={errors.leaseDuration}>
              <Input type="number" min={1} max={60} value={value.leaseDuration} disabled={readOnly} invalid={!!errors.leaseDuration} onChange={(event) => update("leaseDuration", Number(event.target.value))} />
            </Field>
            <Field label="Default rent due day" error={errors.rentDueDay}>
              <Select value={String(value.rentDueDay)} disabled={readOnly} onChange={(event) => update("rentDueDay", Number(event.target.value))}>
                {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card id="lease-lifecycle">
          <CardHeader icon={ScrollText} title="Lease lifecycle" description="Renewal timing, inspections and standard documents." />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Renewal notice period" error={errors.renewalNoticeDays} hint="Days before lease end.">
                <Input type="number" min={0} max={365} value={value.renewalNoticeDays} disabled={readOnly} invalid={!!errors.renewalNoticeDays} onChange={(event) => update("renewalNoticeDays", Number(event.target.value))} />
              </Field>
              <Field label="Renewal reminder timing" error={errors.renewalReminderDays} hint="Days before lease end.">
                <Input type="number" min={0} max={365} value={value.renewalReminderDays} disabled={readOnly} invalid={!!errors.renewalReminderDays} onChange={(event) => update("renewalReminderDays", Number(event.target.value))} />
              </Field>
            </div>
            <Field label="Inspection frequency">
              <Select value={value.inspectionFrequency} disabled={readOnly} onChange={(event) => update("inspectionFrequency", event.target.value)}>
                {["Monthly", "Quarterly", "Semi-annual", "Annual", "Move-in and move-out only"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Default lease document template" error={errors.leaseTemplate}>
              <Select value={value.leaseTemplate} disabled={readOnly} invalid={!!errors.leaseTemplate} onChange={(event) => update("leaseTemplate", event.target.value)}>
                {LEASE_TEMPLATES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Default utility responsibility">
              <Select value={value.utilityResponsibility} disabled={readOnly} onChange={(event) => update("utilityResponsibility", event.target.value)}>
                {[
                  "Tenant pays electricity; owner pays water & sewer",
                  "Tenant pays all utilities",
                  "Owner pays all utilities",
                  "Tenant pays electricity & gas; owner pays water",
                  "Set per property",
                ].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>
      </div>

      <Card id="recurring">
        <CardHeader icon={RefreshCw} title="Recurring charges" description="How rent and recurring fees are generated for new leases." />
        <CardBody className="divide-y divide-u-line py-0 ">
          <SettingRow title="Generate recurring rent automatically" description="Create a scheduled charge when a new lease becomes active.">
            <Toggle label="Generate recurring rent" checked={!!value.recurringCharges} disabled={readOnly} onChange={(checked) => update("recurringCharges", checked)} />
          </SettingRow>
          <SettingRow title="Prorate the first month" description="Calculate a partial first-month charge based on move-in date.">
            <Toggle label="Prorate first month" checked={!!value.prorateFirstMonth} disabled={readOnly} onChange={(checked) => update("prorateFirstMonth", checked)} />
          </SettingRow>
          <SettingRow title="Recurring charge day" description="Day recurring charges post each month. Supports rent, parking and pet fees.">
            <Select value={String(value.recurringDueDay)} disabled={readOnly} onChange={(event) => update("recurringDueDay", Number(event.target.value))} className="h-8.5 w-[90px] text-[12px]">
              {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </Select>
          </SettingRow>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card id="checklists">
          <CardHeader icon={ClipboardCheck} title="Move-in checklist" description="Tasks suggested for every new tenancy." />
          <CardBody>
            <Field error={errors.moveInChecklist}>
              <ListEditor
                items={value.moveInChecklist ?? []}
                onChange={(items) => update("moveInChecklist", items)}
                readOnly={readOnly}
                placeholder="Add a move-in task"
                addLabel="Add task"
                emptyLabel="No move-in checklist items."
              />
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={FolderCheck} title="Move-out checklist" description="Tasks suggested when a tenancy ends." />
          <CardBody>
            <Field error={errors.moveOutChecklist}>
              <ListEditor
                items={value.moveOutChecklist ?? []}
                onChange={(items) => update("moveOutChecklist", items)}
                readOnly={readOnly}
                placeholder="Add a move-out task"
                addLabel="Add task"
                emptyLabel="No move-out checklist items."
              />
            </Field>
          </CardBody>
        </Card>
      </div>

      <Card id="tenant-docs">
        <CardHeader
          icon={Users}
          title="Tenant document requirements"
          description="Documents requested during application or onboarding."
          aside={<Badge tone="gray">{docs.filter(Boolean).length} required</Badge>}
        />
        <CardBody className="space-y-2">
          <div className="grid gap-x-6 sm:grid-cols-2">
            {TENANT_DOCUMENT_OPTIONS.map((option) => (
              <Checkbox
                key={option}
                label={option}
                checked={docs.includes(option)}
                disabled={readOnly}
                onChange={(checked) => toggleDoc(option, checked)}
              />
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-u-s2 px-3 py-2.5 text-[11.5px] leading-relaxed text-u-muted  ">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Requirements are shown to staff when preparing a lease. No actual tenant records are created by this prototype.
          </div>
        </CardBody>
      </Card>

      <Callout tone="neutral" icon={CalendarDays} title="Lease scenarios are supported">
        Defaults can be used for apartments, condominiums, single-family homes and multi-unit buildings. Set property-specific values on each record when needed.
      </Callout>
    </div>
  );
}
