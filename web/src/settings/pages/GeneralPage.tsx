import { CalendarRange, Eye, SlidersHorizontal } from "lucide-react";
import type { PageProps } from "../types";
import { Badge, Callout, Card, CardBody, CardHeader, Field, Input, Select, SettingRow, Toggle } from "../components/ui";

export default function GeneralPage({ value, update, readOnly, errors }: PageProps) {
  return (
    <div className="space-y-5">
      <Callout tone="info" icon={SlidersHorizontal} title="Workspace behavior">
        These defaults affect everyone in the organization. They set the starting state of views and do not change individual preferences.
      </Callout>

      <Card id="default-views">
        <CardHeader
          icon={CalendarRange}
          title="Default views"
          description="Set the starting view for dashboards, reports and list screens across the workspace."
          aside={<Badge tone="blue">Organization default</Badge>}
        />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Default reporting period" error={errors.reportingPeriod} hint="Applied to reports and financial summaries.">
            <Select value={value.reportingPeriod} disabled={readOnly} onChange={(event) => update("reportingPeriod", event.target.value)}>
              {["Month to date", "Last 30 days", "Current month", "Previous month", "Quarter to date", "Year to date"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </Field>
          <Field label="Default property portfolio view">
            <Select value={value.portfolioView} disabled={readOnly} onChange={(event) => update("portfolioView", event.target.value)}>
              {["Grid", "List", "Map", "Table"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </Field>
          <Field label="Default table page size" error={errors.tablePageSize} hint="Allowed range: 10–100 rows.">
            <Input type="number" min={10} max={100} value={value.tablePageSize} disabled={readOnly} invalid={!!errors.tablePageSize} onChange={(event) => update("tablePageSize", event.target.value)} />
          </Field>
          <Field label="Default filter" hint="Starting filter for property, lease and tenant lists.">
            <Select value={value.defaultFilter} disabled={readOnly} onChange={(event) => update("defaultFilter", event.target.value)}>
              {["Active records", "All records", "My assignments", "Needs attention", "Recently viewed"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card id="formats">
          <CardHeader icon={CalendarRange} title="Display formats" description="Defaults used when dates and currency are rendered." />
          <CardBody className="space-y-4">
            <Field label="Date format">
              <Select value={value.dateFormat} disabled={readOnly} onChange={(event) => update("dateFormat", event.target.value)}>
                {["MMM d, yyyy", "MM/dd/yyyy", "dd/MM/yyyy", "yyyy-MM-dd"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Time format">
              <Select value={value.timeFormat} disabled={readOnly} onChange={(event) => update("timeFormat", event.target.value)}>
                {["12-hour", "24-hour"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Currency display">
              <Select value={value.currencyDisplay} disabled={readOnly} onChange={(event) => update("currencyDisplay", event.target.value)}>
                {["Symbol · $1,250.00", "Code · USD 1,250.00", "Compact · $1.25K", "No cents · $1,250"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <div className="rounded-lg bg-u-s2 px-3 py-2.5 text-[11.5px] leading-relaxed text-u-muted  ">
              Preview: <span className="font-medium text-u-ink2 ">Aug 12, 2026 · 3:45 PM · $1,250.00</span>
            </div>
          </CardBody>
        </Card>

        <Card id="interactions">
          <CardHeader icon={Eye} title="Interaction preferences" description="How tables and potentially destructive actions behave." />
          <CardBody className="divide-y divide-u-line py-0 ">
            <SettingRow title="Confirmation dialogs" description="Ask before deleting or archiving records.">
              <Toggle label="Confirmation dialogs" checked={!!value.confirmDestructive} disabled={readOnly} onChange={(checked) => update("confirmDestructive", checked)} />
            </SettingRow>
            <SettingRow title="Default sorting" description="Starting sort order for list-style screens.">
              <Select value={value.defaultSort} disabled={readOnly} onChange={(event) => update("defaultSort", event.target.value)} className="h-8.5 w-[160px] text-[12px]">
                {["Recently updated", "Name (A–Z)", "Newest first", "Oldest first", "Amount (high–low)"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </SettingRow>
            <SettingRow title="Document preview" description="Where uploaded documents open by default.">
              <Select value={value.documentPreview} disabled={readOnly} onChange={(event) => update("documentPreview", event.target.value)} className="h-8.5 w-[160px] text-[12px]">
                {["Side panel", "Full page", "New tab", "Inline preview"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </SettingRow>
          </CardBody>
        </Card>
      </div>

      <Callout tone="neutral" title="Defaults apply going forward">
        General preferences affect the starting state of views for workspace members. They do not change existing records, leases or reports.
      </Callout>
    </div>
  );
}
