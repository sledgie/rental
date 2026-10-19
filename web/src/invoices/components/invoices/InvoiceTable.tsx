import type { ReactNode } from "react";
import { useNavigate } from "@inv/router";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from "lucide-react";
import { InvoiceActionsMenu } from "./InvoiceActionsMenu";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { useToast } from "@inv/components/ui/Toast";
import { dueLabel, formatCAD, formatDate } from "@inv/lib/format";
import { DEMO_TODAY, statusRank } from "@inv/data/mockInvoices";
import { invoiceBalance, invoiceTotal, statusLabels, type Invoice } from "@inv/types/invoice";
import { cn } from "@inv/utils/cn";

export type SortField =
  | "id"
  | "issueDate"
  | "dueDate"
  | "total"
  | "balance"
  | "status";

export interface SortState {
  field: SortField;
  direction: "asc" | "desc";
}

export interface InvoiceTableHandlers {
  onEdit: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
}

interface InvoiceTableProps {
  invoices: Invoice[];
  sort: SortState;
  onSortChange: (field: SortField) => void;
  handlers: InvoiceTableHandlers;
  emptyState?: ReactNode;
}

const columns: {
  key: SortField | "tenant" | "property" | "actions";
  label: string;
  align?: "right" | "left";
  sortable?: boolean;
  className?: string;
}[] = [
  { key: "id", label: "Invoice ID", sortable: true },
  { key: "tenant", label: "Tenant" },
  { key: "property", label: "Property / Unit" },
  { key: "issueDate", label: "Invoice Date", sortable: true },
  { key: "dueDate", label: "Due Date", sortable: true },
  { key: "total", label: "Total Amount", align: "right", sortable: true },
  { key: "balance", label: "Balance Due", align: "right", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "actions", label: "Actions", align: "right" },
];

export function InvoiceTable({
  invoices,
  sort,
  onSortChange,
  handlers,
  emptyState,
}: InvoiceTableProps) {
  const navigate = useNavigate();
  const toast = useToast();

  const open = (id: string) => navigate(`/invoices/${id}`);

  const download = (invoice: Invoice) =>
    toast({
      kind: "info",
      title: "PDF export unavailable in prototype",
      body: `${invoice.id} would be generated as a CAD invoice PDF. Placeholder action only.`,
    });

  const sortValue = (invoice: Invoice, field: SortField): string | number => {
    switch (field) {
      case "id":
        return invoice.id;
      case "issueDate":
        return invoice.issueDate;
      case "dueDate":
        return invoice.dueDate;
      case "total":
        return invoiceTotal(invoice);
      case "balance":
        return invoiceBalance(invoice);
      case "status":
        return statusRank[invoice.status];
    }
  };

  const rows = [...invoices].sort((a, b) => {
    const av = sortValue(a, sort.field);
    const bv = sortValue(b, sort.field);
    let cmp: number;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    if (cmp === 0) cmp = a.id.localeCompare(b.id);
    return sort.direction === "asc" ? cmp : -cmp;
  });

  if (invoices.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Invoice register. Click a row to open the invoice detail page.
          </caption>
          <thead>
            <tr className="border-b border-line bg-surface-2/70">
              {columns.map((col) => {
                const sortable = Boolean(col.sortable);
                const active = sortable && sort.field === col.key;
                const Icon = !active
                  ? ChevronsUpDown
                  : sort.direction === "asc"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : sortable
                          ? "none"
                          : undefined
                    }
                    className={cn(
                      "whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint",
                      col.align === "right" && "text-right",
                      col.key === "actions" && "w-16"
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(col.key as SortField)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink",
                          active && "text-ink"
                        )}
                      >
                        {col.label}
                        <Icon className={cn("size-3", active ? "opacity-90" : "opacity-45")} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((invoice) => {
              const total = invoiceTotal(invoice);
              const balance = invoiceBalance(invoice);
              const overdue =
                invoice.status === "overdue" ||
                (balance > 0 &&
                  invoice.status !== "void" &&
                  invoice.status !== "draft" &&
                  invoice.status !== "pending_approval" &&
                  new Date(`${invoice.dueDate}T23:59:59`) < new Date(DEMO_TODAY));
              const voided = invoice.status === "void";

              return (
                <tr
                  key={invoice.id}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open invoice ${invoice.id} for ${invoice.tenant.name}`}
                  onClick={() => open(invoice.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open(invoice.id);
                    }
                  }}
                  className={cn(
                    "group cursor-pointer border-b border-line/70 transition-colors last:border-0",
                    "hover:bg-surface-2/70 focus-visible:bg-surface-2",
                    voided && "opacity-60"
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-medium text-ink group-hover:text-brand-ink">
                      {invoice.id}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                      {invoice.leaseRef}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-[10.5px] font-semibold text-ink-muted ring-1 ring-line-strong">
                        {invoice.tenant.avatarInitials}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] text-ink">
                          {invoice.tenant.name}
                        </span>
                        <span className="mt-0.5 hidden truncate text-[11.5px] text-ink-faint xl:block">
                          {invoice.tenant.email}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block truncate text-[13px] text-ink-muted">
                      {invoice.propertyName}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                      Unit {invoice.unit}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] text-ink-muted tabular-nums">
                    {formatDate(invoice.issueDate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={cn(
                        "block text-[13px] tabular-nums",
                        overdue ? "text-overdue" : "text-ink-muted"
                      )}
                    >
                      {formatDate(invoice.dueDate)}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[11.5px]",
                        overdue ? "text-overdue/85" : "text-ink-faint"
                      )}
                    >
                      {voided ? "—" : dueLabel(invoice.dueDate)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[13.5px] font-medium text-ink tabular-nums">
                    {formatCAD(total)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-4 py-3 text-right text-[13.5px] font-semibold tabular-nums",
                      balance <= 0
                        ? "text-paid"
                        : overdue
                          ? "text-overdue"
                          : "text-ink"
                    )}
                  >
                    {formatCAD(balance)}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={invoice.status} />
                    <span className="sr-only">{statusLabels[invoice.status]}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <InvoiceActionsMenu
                          invoice={invoice}
                          onView={() => open(invoice.id)}
                          onEdit={handlers.onEdit}
                          onRecordPayment={handlers.onRecordPayment}
                          onDownload={download}
                          onVoid={handlers.onVoid}
                        />
                      </span>
                      <ChevronRight className="size-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink-muted" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
