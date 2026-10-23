import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "@inv/router";
import { Download, FilePlus2, Plus, RotateCcw, SearchX } from "lucide-react";
import { PageHeader } from "@inv/components/PageHeader";
import { Button } from "@inv/components/ui/Button";
import { ConfirmDialog } from "@inv/components/ui/ConfirmDialog";
import { useToast } from "@inv/components/ui/Toast";
import { InvoiceFiltersBar } from "@inv/components/invoices/InvoiceFilters";
import { InvoiceFormModal, type InvoiceFormValues } from "@inv/components/invoices/InvoiceFormModal";
import { RecordPaymentModal } from "@inv/components/invoices/RecordPaymentModal";
import { InvoiceTable, type SortState } from "@inv/components/invoices/InvoiceTable";
import { Pagination } from "@inv/components/Pagination";
import { statusRank } from "@inv/data/mockInvoices";
import { isSupabaseConfigured } from "../../lib/supabase";
import { formatCAD, monthRange, todayISO, weekRange } from "@inv/lib/format";
import { onInvoiceSyncError, useInvoices } from "@inv/store/InvoiceStore";
import { InvoiceRegister } from "@inv/components/invoices/InvoiceRegister";
import {
  defaultFilters,
  invoiceBalance,
  statusLabels,
  typeLabels,
  invoiceTotal,
  type Invoice,
  type InvoiceFilters,
  type InvoiceStatus,
  type InvoiceType,
} from "@inv/types/invoice";

const SORT_KEY = "sort";
const PAGE_KEY = "page";
const SIZE_KEY = "size";

const readFilters = (sp: URLSearchParams): InvoiceFilters => {
  const next: InvoiceFilters = { ...defaultFilters };
  const str = (k: string) => sp.get(k) ?? "";
  next.query = str("q");
  next.status = (sp.get("status") as InvoiceStatus | null) ?? "all";
  next.propertyId = str("property") || "all";
  next.type = (sp.get("type") as InvoiceType | null) ?? "all";
  next.due = (sp.get("due") as InvoiceFilters["due"] | null) ?? "all";
  next.customFrom = str("from");
  next.customTo = str("to");
  next.tenant = str("tenant") || "all";
  next.minAmount = str("min");
  next.maxAmount = str("max");
  return next;
};

export default function InvoiceListPage({ startCreate = false }: { startCreate?: boolean }) {
  const toast = useToast();
  const { invoices, createInvoice, updateInvoice, recordPayment, voidInvoice, resetDemoData, refs, ready, loadError, reload } =
    useInvoices();
  const properties = refs.properties;
  const tenants = useMemo(() => refs.tenants.map((t) => t.name), [refs.tenants]);

  // a change that could not be saved to the database is reported here (the register then shows what the database really holds)
  useEffect(() => onInvoiceSyncError((message) => toast({ kind: "warning", title: "The change was not saved", body: message })), [toast]);
  // tenants, leases or units may have changed on other pages since the last load
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => readFilters(sp), [sp]);
  const sort: SortState = useMemo(
    () => ({
      field: (sp.get(SORT_KEY) as SortState["field"] | null) ?? "dueDate",
      direction: (sp.get("dir") as SortState["direction"] | null) ?? "asc",
    }),
    [sp]
  );
  const page = Math.max(1, Number(sp.get(PAGE_KEY) ?? 1) || 1);
  const pageSize = Math.max(5, Number(sp.get(SIZE_KEY) ?? 10) || 10);

  const patchUrl = useCallback(
    (patch: Record<string, string | null | undefined>, resetPage = true) => {
      const next = new URLSearchParams(sp);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      });
      if (resetPage) next.set(PAGE_KEY, "1");
      setSp(next, { replace: true });
    },
    [setSp, sp]
  );

  const onFilterChange = (patch: Partial<InvoiceFilters>) =>
    patchUrl({
      q: patch.query,
      status: patch.status === "all" ? null : patch.status,
      property: patch.propertyId === "all" ? null : patch.propertyId,
      type: patch.type === "all" ? null : patch.type,
      due: patch.due === "all" ? null : patch.due,
      from: patch.customFrom,
      to: patch.customTo,
      tenant: patch.tenant === "all" ? null : patch.tenant,
      min: patch.minAmount,
      max: patch.maxAmount,
    });

  const onClear = () => setSp(new URLSearchParams(), { replace: true });

  /* ---------- derived ---------- */
  const enriched = useMemo(
    () =>
      invoices.map((inv) => ({
        inv,
        total: invoiceTotal(inv),
        balance: invoiceBalance(inv),
      })),
    [invoices]
  );

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const week = weekRange();
    const month = monthRange();
    const today = todayISO();
    const min = filters.minAmount === "" ? null : Number(filters.minAmount);
    const max = filters.maxAmount === "" ? null : Number(filters.maxAmount);

    return enriched.filter(({ inv, total, balance }) => {
      if (q) {
        const haystack = [
          inv.id,
          inv.tenant.name,
          inv.propertyName,
          `unit ${inv.unit}`,
          inv.unit,
          inv.leaseRef,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.status !== "all" && inv.status !== filters.status) return false;
      if (filters.propertyId !== "all" && inv.propertyId !== filters.propertyId) return false;
      if (filters.type !== "all" && inv.type !== filters.type) return false;
      if (filters.tenant !== "all" && inv.tenant.name !== filters.tenant) return false;
      if (min !== null && total < min) return false;
      if (max !== null && total > max) return false;

      if (filters.due !== "all") {
        const collectible =
          balance > 0 && !["void", "draft", "pending_approval"].includes(inv.status);
        if (filters.due === "overdue") {
          if (!(inv.dueDate < today && collectible)) return false;
        } else if (filters.due === "this_week") {
          if (inv.dueDate < week.from || inv.dueDate > week.to) return false;
        } else if (filters.due === "this_month") {
          if (inv.dueDate < month.from || inv.dueDate > month.to) return false;
        } else if (filters.due === "custom") {
          if (!filters.customFrom || !filters.customTo) return false;
          if (inv.dueDate < filters.customFrom || inv.dueDate > filters.customTo) return false;
        }
      }
      return true;
    });
  }, [enriched, filters]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.query.trim()) n++;
    if (filters.status !== "all") n++;
    if (filters.propertyId !== "all") n++;
    if (filters.type !== "all") n++;
    if (filters.due !== "all") n++;
    if (filters.tenant !== "all") n++;
    if (filters.minAmount || filters.maxAmount) n++;
    return n;
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const sortValue = (inv: Invoice, total: number, balance: number): string | number =>
    ({ id: inv.id, issueDate: inv.issueDate, dueDate: inv.dueDate, total, balance, status: statusRank[inv.status] })[sort.field];
  const sorted = [...filtered].sort((a, b) => {
    const av = sortValue(a.inv, a.total, a.balance);
    const bv = sortValue(b.inv, b.total, b.balance);
    let cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    if (cmp === 0) cmp = a.inv.id.localeCompare(b.inv.id);
    return sort.direction === "asc" ? cmp : -cmp;
  });
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize).map((r) => r.inv);


  /* ---------- modals ---------- */
  const [createOpen, setCreateOpen] = useState(startCreate);
  // opened from "Create New Invoice" (#/invoice-new): closing the form returns to the register
  const closeCreate = () => {
    setCreateOpen(false);
    if (startCreate) window.location.hash = "#/invoices";
  };
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);

  const nextId = useMemo(() => {
    const nums = invoices
      .map((i) => Number(i.id.split("-").pop()))
      .filter((n) => Number.isFinite(n)) as number[];
    return `INV-2026-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
  }, [invoices]);

  const submitCreate = async (values: InvoiceFormValues) => {
    try {
    const created = await createInvoice({
      id: values.id,
      tenantId: values.tenantId,
      unitId: values.unitId,
      leaseId: values.leaseId,
      tenant: {
        name: values.tenantName,
        email: `${values.tenantName.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".")}@example.com`,
        phone: "(416) 555-0142",
        avatarInitials: values.tenantName
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join(""),
      },
      propertyId: values.propertyId || properties[0].id,
      propertyName: values.propertyName || properties[0].name,
      unit: values.unit,
      leaseRef: values.leaseRef || "—",
      type: values.type,
      status: values.status,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      billingPeriodStart: values.billingPeriodStart,
      billingPeriodEnd: values.billingPeriodEnd,
      currency: "CAD",
      lineItems: values.lineItems.filter((i) => i.description.trim() !== ""),
      discount: values.discount,
      payments: [],
      memo: values.memo || undefined,
    });
    closeCreate();
    toast({
      kind: "success",
      title: isSupabaseConfigured ? `${created.id} created` : `${values.id} created as a draft`,
      body: isSupabaseConfigured ? "Saved. No tenant has been notified." : "Stored in this browser session only \u2014 no tenant has been notified.",
    });
    } catch (error) {
      toast({ kind: "warning", title: "The invoice was not created", body: error instanceof Error ? error.message : "Please try again." });
    }
  };

  const submitEdit = (values: InvoiceFormValues) => {
    if (!editTarget) return;
    updateInvoice(editTarget.id, {
      tenantId: values.tenantId,
      unitId: values.unitId,
      leaseId: values.leaseId,
      propertyName: values.propertyName,
      propertyId: values.propertyId,
      unit: values.unit,
      leaseRef: values.leaseRef,
      type: values.type,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      billingPeriodStart: values.billingPeriodStart,
      billingPeriodEnd: values.billingPeriodEnd,
      discount: values.discount,
      memo: values.memo || undefined,
      lineItems: values.lineItems.filter((i) => i.description.trim() !== ""),
    });
    setEditTarget(null);
    toast({ kind: "success", title: `${editTarget.id} updated`, body: isSupabaseConfigured ? "Changes saved." : "Changes saved to demo state." });
  };

  const exportCsv = () => {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      ["Invoice", "Tenant", "Property", "Unit", "Type", "Issued", "Due", "Total", "Balance", "Status"],
      ...sorted.map(({ inv, total, balance }) => [inv.id, inv.tenant.name, inv.propertyName, inv.unit, typeLabels[inv.type], inv.issueDate, inv.dueDate, total.toFixed(2), balance.toFixed(2), statusLabels[inv.status]]),
    ].map((r) => r.map(q).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `invoices-${todayISO()}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
    toast({ kind: "success", title: `Exported ${sorted.length} invoice${sorted.length === 1 ? "" : "s"} to CSV` });
  };

  const download = (invoice: Invoice) =>
    toast({
      kind: "info",
      title: "PDF export unavailable in prototype",
      body: `${invoice.id} would be generated as a CAD invoice PDF. Placeholder action only.`,
    });

  const emptyState = (
    <div className="rounded-xl border border-line bg-surface px-6 py-16 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-full border border-line bg-surface-2">
        <SearchX className="size-5 text-ink-faint" />
      </div>
      <p className="mt-4 text-[15px] font-medium text-ink">No invoices match these filters</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-muted">
        Try a different search term, widen the due-date range, or clear the filters to see the full
        register of {invoices.length} demo invoices.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" onClick={onClear}>
          <RotateCcw className="size-4" />
          Clear filters
        </Button>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create Invoice
        </Button>
      </div>
    </div>
  );

  if (isSupabaseConfigured && (!ready || loadError)) {
    return (
      <div className="tn">
        <div className="app-shell">
          <div className="main-shell">
            <main className="main-content">
              <div className="empty-state">
                <h3>{loadError ? "We couldn't load your invoices" : "Loading invoices…"}</h3>
                <p>{loadError ?? "Fetching your invoice register."}</p>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <InvoiceRegister
        allInvoices={invoices}
        pageRows={pageRows}
        totalItems={filtered.length}
        filters={filters}
        onFilterChange={onFilterChange}
        onClear={onClear}
        activeCount={activeCount}
        tenants={tenants}
        sort={sort}
        onSort={(field) =>
          patchUrl(
            { [SORT_KEY]: field, dir: sort.field === field ? (sort.direction === "asc" ? "desc" : "asc") : field === "status" || field === "id" ? "asc" : "desc" },
            false
          )
        }
        onDirection={() => patchUrl({ dir: sort.direction === "asc" ? "desc" : "asc" }, false)}
        page={safePage}
        pageSize={pageSize}
        onPage={(n) => patchUrl({ [PAGE_KEY]: String(Math.min(Math.max(1, n), totalPages)) }, false)}
        onPageSize={(n) => patchUrl({ [SIZE_KEY]: String(n), [PAGE_KEY]: "1" }, false)}
        onCreate={() => setCreateOpen(true)}
        onExport={exportCsv}
        onEdit={setEditTarget}
        onRecordPayment={setPayTarget}
        onVoid={setVoidTarget}
        onDownload={download}
        onResetDemo={resetDemoData}
      />

      <InvoiceFormModal
        open={createOpen}
        mode="create"
        nextId={nextId}
        onClose={closeCreate}
        onSubmit={submitCreate}
      />
      <InvoiceFormModal
        open={editTarget !== null}
        mode="edit"
        invoice={editTarget ?? undefined}
        nextId={editTarget?.id ?? ""}
        onClose={() => setEditTarget(null)}
        onSubmit={submitEdit}
      />
      {payTarget ? (
        <RecordPaymentModal
          key={payTarget.id}
          open
          invoice={payTarget}
          onClose={() => setPayTarget(null)}
          onSubmit={(input) => {
            recordPayment(payTarget.id, input);
            toast({
              kind: "success",
              title: `Payment recorded on ${payTarget.id}`,
              body: `${formatCAD(input.amount)} applied · balance and status recalculated.`,
            });
            setPayTarget(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={voidTarget !== null}
        title={`Void ${voidTarget?.id ?? "invoice"}?`}
        body="Voiding removes the outstanding balance from collections and cannot be undone in this prototype. The record stays in the register for audit purposes."
        confirmLabel="Void invoice"
        onCancel={() => setVoidTarget(null)}
        onConfirm={() => {
          if (!voidTarget) return;
          voidInvoice(voidTarget.id, "Voided from the invoice register.");
          toast({
            kind: "warning",
            title: `${voidTarget.id} voided`,
            body: "Balance cleared from collections in the demo ledger.",
          });
        }}
      />
    </>
  );
}

