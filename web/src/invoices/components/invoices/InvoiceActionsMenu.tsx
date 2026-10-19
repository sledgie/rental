import {
  Ban,
  CreditCard,
  Download,
  Eye,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { Menu, MenuItem, MenuSeparator } from "@inv/components/ui/Menu";
import { invoiceBalance, type Invoice } from "@inv/types/invoice";

interface InvoiceActionsMenuProps {
  invoice: Invoice;
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
  onDownload: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
}

export function InvoiceActionsMenu({
  invoice,
  onView,
  onEdit,
  onRecordPayment,
  onDownload,
  onVoid,
}: InvoiceActionsMenuProps) {
  const locked = invoice.status === "void";
  const editable = invoice.status === "draft" || invoice.status === "pending_approval";

  return (
    <Menu
      width="w-52"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={`Actions for invoice ${invoice.id}`}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`
            grid size-8 place-items-center rounded-md border transition-colors
            ${
              open
                ? "border-accent/50 bg-accent-soft text-ink"
                : "border-transparent text-ink-faint hover:border-line-strong hover:bg-surface-3 hover:text-ink"
            }
          `}
        >
          <MoreVertical className="size-4" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem
            icon={<Eye className="size-4" />}
            onClick={() => {
              close();
              onView(invoice);
            }}
          >
            View invoice
          </MenuItem>
          <MenuItem
            icon={<Pencil className="size-4" />}
            disabled={!editable}
            onClick={() => {
              close();
              onEdit(invoice);
            }}
          >
            Edit invoice
          </MenuItem>
          <MenuItem
            icon={<CreditCard className="size-4" />}
            disabled={locked || invoiceBalance(invoice) <= 0}
            onClick={() => {
              close();
              onRecordPayment(invoice);
            }}
          >
            Record payment
          </MenuItem>
          <MenuItem
            icon={<Download className="size-4" />}
            onClick={() => {
              close();
              onDownload(invoice);
            }}
          >
            Download PDF
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<Ban className="size-4" />}
            danger
            disabled={locked}
            onClick={() => {
              close();
              onVoid(invoice);
            }}
          >
            {locked ? "Invoice voided" : "Void invoice"}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
