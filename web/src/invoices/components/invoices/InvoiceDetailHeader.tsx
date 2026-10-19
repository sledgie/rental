import { Link } from "@inv/router";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  MoreHorizontal,
  Pencil,
  Printer,
} from "lucide-react";
import { Button } from "@inv/components/ui/Button";
import { Menu, MenuItem, MenuSeparator } from "@inv/components/ui/Menu";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { useToast } from "@inv/components/ui/Toast";
import { typeLabels, type Invoice } from "@inv/types/invoice";

interface InvoiceDetailHeaderProps {
  invoice: Invoice;
  onEdit: () => void;
  onRecordPayment: () => void;
  onVoid: () => void;
  onApprove: () => void;
}

export function InvoiceDetailHeader({
  invoice,
  onEdit,
  onRecordPayment,
  onVoid,
  onApprove,
}: InvoiceDetailHeaderProps) {
  const toast = useToast();
  const locked = invoice.status === "void";
  const needsApproval = invoice.status === "draft" || invoice.status === "pending_approval";

  const placeholder = (what: string) =>
    toast({
      kind: "info",
      title: `${what} — placeholder`,
      body: "This prototype does not generate files or send live notifications.",
    });

  return (
    <header className="mb-5">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[12.5px]">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1 text-ink-muted transition-colors hover:text-ink"
        >
          <ChevronLeft className="size-3.5" />
          Invoices
        </Link>
        <ChevronRight className="size-3.5 text-ink-faint" />
        <span className="text-ink">{invoice.id}</span>
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-2xl">
              {invoice.id}
            </h1>
            <InvoiceStatusBadge status={invoice.status} />
            <span className="rounded-md border border-line-strong bg-surface-2 px-2 py-1 text-[11.5px] text-ink-muted">
              {typeLabels[invoice.type]}
            </span>
          </div>
          <p className="mt-1.5 text-[13.5px] text-ink-muted">
            {invoice.propertyName} · Unit {invoice.unit} · {invoice.tenant.name} ·{" "}
            <span className="text-ink-faint">Lease {invoice.leaseRef}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={onEdit} disabled={locked || !needsApproval}>
            <Pencil className="size-4" />
            Edit Invoice
          </Button>
          <Button variant="secondary" onClick={() => placeholder("Download PDF")}>
            <Download className="size-4" />
            Download PDF
          </Button>
          <Menu
            width="w-56"
            trigger={({ open, toggle }) => (
              <Button
                variant="secondary"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={toggle}
                className="px-2.5"
              >
                <MoreHorizontal className="size-4" />
                More Actions
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<CheckCircle2 className="size-4" />}
                  disabled={!needsApproval}
                  onClick={() => {
                    close();
                    onApprove();
                  }}
                >
                  {invoice.status === "pending_approval" ? "Approve & issue" : "Approve invoice"}
                </MenuItem>
                <MenuItem
                  icon={<CreditCard className="size-4" />}
                  disabled={locked}
                  onClick={() => {
                    close();
                    onRecordPayment();
                  }}
                >
                  Record payment
                </MenuItem>
                <MenuItem
                  icon={<Download className="size-4" />}
                  onClick={() => {
                    close();
                    placeholder("Download PDF");
                  }}
                >
                  Download PDF
                </MenuItem>
                <MenuItem
                  icon={<Printer className="size-4" />}
                  onClick={() => {
                    close();
                    placeholder("Print view");
                  }}
                >
                  Print / share
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={<Ban className="size-4" />}
                  danger
                  disabled={locked}
                  onClick={() => {
                    close();
                    onVoid();
                  }}
                >
                  {locked ? "Invoice voided" : "Void invoice"}
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>
    </header>
  );
}
