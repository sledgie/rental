// Invoices: the register (#/invoices) with the invoice record opening in a side drawer (#/invoices?id=...), like Properties, Leases and Units.
import { ToastProvider } from "@inv/components/ui/Toast";
import { InvoiceDrawer } from "@inv/components/invoices/InvoiceDrawer";
import InvoiceListPage from "@inv/pages/InvoiceListPage";
import { useSearchParams } from "@inv/router";

export default function Invoices({ startCreate = false }: { startCreate?: boolean }) {
  const [params] = useSearchParams();
  const detail = params.get("id");
  return (
    <div className="rd contents">
      <ToastProvider>
        <InvoiceListPage startCreate={startCreate} />
        {detail ? <InvoiceDrawer key={detail} id={detail} /> : null}
      </ToastProvider>
    </div>
  );
}

// "+ Create New Invoice" opens the register with the new-invoice form already open.
export const NewInvoice = () => <Invoices startCreate />;
