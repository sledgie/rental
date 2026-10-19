// Invoices: register (#/invoices) and detail (#/invoices?id=...). Ported from the reference project, on the app theme.
import { ToastProvider } from "@inv/components/ui/Toast";
import InvoiceDetailPage from "@inv/pages/InvoiceDetailPage";
import InvoiceListPage from "@inv/pages/InvoiceListPage";
import { useSearchParams } from "@inv/router";

export default function Invoices({ startCreate = false }: { startCreate?: boolean }) {
  const [params] = useSearchParams();
  return (
    <div className="rd min-h-screen bg-canvas text-ink">
      <ToastProvider>
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          {params.get("id") ? <InvoiceDetailPage /> : <InvoiceListPage startCreate={startCreate} />}
        </div>
      </ToastProvider>
    </div>
  );
}

// "+ Create New Invoice" opens the register with the new-invoice form already open.
export const NewInvoice = () => <Invoices startCreate />;
