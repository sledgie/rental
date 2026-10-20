import { Button } from "../ui/Button";
import { Field, Input, Select } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { useApp } from "../../context/AppContext";
import { getTenant, tenants, units } from "../../data/catalog";
import type { AllocationMethod, Bill, CalculationBasis, TenantAllocation } from "../../types";
import { allocationsExceedBill, resolvedAllocations } from "../../utils/bills";
import { formatCAD, uid } from "../../utils/format";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export function AllocationModal({
  open,
  onClose,
  bill,
}: {
  open: boolean;
  onClose: () => void;
  bill: Bill | null;
}) {
  const { updateAllocations, pushToast } = useApp();
  const [rows, setRows] = useState<TenantAllocation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && bill) {
      setRows(bill.allocations.map((a) => ({ ...a })));
      setError("");
    }
  }, [open, bill]);

  if (!bill) return null;
  const invoiceAmount = bill.amount;
  const billId = bill.id;

  const preview = resolvedAllocations(invoiceAmount, rows);
  const total = preview.reduce((s, a) => s + a.share, 0);

  function addRow() {
    const tenant = tenants[0];
    setRows((r) => [
      ...r,
      {
        id: uid("alloc"),
        tenantId: tenant.id,
        unitId: tenant.unitId,
        method: "percentage",
        percentage: 0,
        calculationBasis: "actual",
      },
    ]);
  }

  function save() {
    if (allocationsExceedBill(invoiceAmount, rows)) {
      setError("Allocations exceed the actual invoice amount. Reduce shares to continue.");
      return;
    }
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.tenantId)) {
        setError("The same tenant cannot be allocated twice on one bill.");
        return;
      }
      seen.add(row.tenantId);
    }
    updateAllocations(billId, rows);
    pushToast("Tenant cost allocation updated. Provider balance is unchanged.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Edit tenant cost allocation"
      subtitle={`${bill.id} · Actual invoice ${formatCAD(bill.amount)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save allocation</Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-u-muted">
        Percentage shares use the actual invoice amount unless you choose a different basis. Landlord
        share is invoice minus total tenant share.
      </p>
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div key={row.id} className="grid gap-2 rounded-xl border border-u-line2 bg-u-bg p-3 sm:grid-cols-12">
            <Field label="Tenant" className="sm:col-span-4">
              <Select
                value={row.tenantId}
                onChange={(e) => {
                  const t = getTenant(e.target.value);
                  setRows((rs) =>
                    rs.map((r, i) =>
                      i === idx ? { ...r, tenantId: e.target.value, unitId: t?.unitId ?? r.unitId } : r,
                    ),
                  );
                }}
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unit" className="sm:col-span-2">
              <Select
                value={row.unitId}
                onChange={(e) =>
                  setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, unitId: e.target.value } : r)))
                }
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Method" className="sm:col-span-3">
              <Select
                value={row.method}
                onChange={(e) =>
                  setRows((rs) =>
                    rs.map((r, i) => (i === idx ? { ...r, method: e.target.value as AllocationMethod } : r)),
                  )
                }
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
                <option value="manual">Manual</option>
                <option value="equal_split">Equal split</option>
                <option value="none">None</option>
              </Select>
            </Field>
            {row.method === "percentage" && (
              <Field label="%" className="sm:col-span-2">
                <Input
                  type="number"
                  value={row.percentage ?? ""}
                  onChange={(e) =>
                    setRows((rs) =>
                      rs.map((r, i) => (i === idx ? { ...r, percentage: Number(e.target.value) } : r)),
                    )
                  }
                />
              </Field>
            )}
            {(row.method === "fixed" || row.method === "manual") && (
              <Field label="Amount" className="sm:col-span-2">
                <Input
                  type="number"
                  value={row.method === "fixed" ? (row.fixedAmount ?? "") : (row.manualAmount ?? "")}
                  onChange={(e) =>
                    setRows((rs) =>
                      rs.map((r, i) =>
                        i === idx
                          ? row.method === "fixed"
                            ? { ...r, fixedAmount: Number(e.target.value) }
                            : { ...r, manualAmount: Number(e.target.value) }
                          : r,
                      ),
                    )
                  }
                />
              </Field>
            )}
            {row.method === "percentage" && (
              <Field label="Basis" className="sm:col-span-3">
                <Select
                  value={row.calculationBasis}
                  onChange={(e) =>
                    setRows((rs) =>
                      rs.map((r, i) =>
                        i === idx ? { ...r, calculationBasis: e.target.value as CalculationBasis } : r,
                      ),
                    )
                  }
                >
                  <option value="actual">Actual bill</option>
                  <option value="expected">Expected amount</option>
                </Select>
              </Field>
            )}
            <div className="flex items-end justify-between sm:col-span-12">
              <p className="font-mono text-xs text-u-accent">
                Share {formatCAD(preview[idx]?.share ?? 0)}
              </p>
              <button
                onClick={() => setRows((rs) => rs.filter((_, i) => i !== idx))}
                className="rounded-lg p-1.5 text-u-danger hover:bg-u-danger/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addRow}>
          Add tenant share
        </Button>
        <div className="text-right text-xs">
          <p className="text-u-muted">
            Tenant total {formatCAD(total)} · Landlord {formatCAD(bill.amount - total)}
          </p>
          {error && <p className="text-u-danger">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}
