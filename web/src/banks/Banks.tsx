// Banks page: same directory layout as Properties and Tenants (Tenants stylesheet, .tn).
import { StoreProvider, useStore } from '../bankrecon/lib/store';
import { isSupabaseConfigured } from '../lib/supabase';
import { EmptyState } from '../tenants/components/ui';
import BankAccounts from './BankAccounts';

function Content({ notify }: { notify?: (message: string) => void }) {
  const { status, syncError, dismissSyncError } = useStore();
  if (isSupabaseConfigured && (!status.ready || status.error)) {
    return (
      <EmptyState
        title={status.error ? "We couldn't load your bank accounts" : 'Loading bank accounts…'}
        description={status.error ?? 'Fetching your accounts.'}
      />
    );
  }
  return (
    <>
      {syncError && (
        <div className="form-error" role="alert" style={{ marginBottom: 12 }}>
          <span>The change was not saved: {syncError}</span>
          <button type="button" className="text-link" style={{ marginLeft: 'auto' }} onClick={dismissSyncError}>Dismiss</button>
        </div>
      )}
      <BankAccounts notify={notify} />
    </>
  );
}

export default function Banks({ notify }: { notify?: (message: string) => void }) {
  return (
    <StoreProvider>
      <div className="tn">
        <div className="app-shell">
          <div className="main-shell">
            <main className="main-content">
              <Content notify={notify} />
            </main>
          </div>
        </div>
      </div>
    </StoreProvider>
  );
}
