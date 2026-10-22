import { Landmark } from 'lucide-react';
import { Button as TnButton } from '../tenants/components/ui';
import { StoreProvider } from '../bankrecon/lib/store';
import BankAccounts from './BankAccounts';
import '../bankrecon/bankrecon.css';

export default function Banks() {
  return (
    <StoreProvider>
      <div className="tn br">
        <div className="app-shell">
          <div className="main-shell">
            <main className="main-content">
              <div className="page-heading">
                <div>
                  <div className="page-title-line">
                    <h1>Banks</h1>
                    <span className="muted">Simulated bank data</span>
                  </div>
                  <p>Bank accounts used for payments, deposits and reconciliation. Account numbers are masked and no online banking credentials are stored.</p>
                </div>
                <div className="page-heading-actions no-print">
                  <TnButton onClick={() => { window.location.hash = '#/bank-reconciliation'; }}><Landmark size={15} />Bank Reconciliation</TnButton>
                </div>
              </div>
              <section className="directory-panel" aria-label="Banks">
                <div className="u-root br-body" style={{ borderTop: 0 }}>
                  <BankAccounts />
                </div>
              </section>
              <div className="directory-footnote no-print">
                <span>Demonstration data is stored in this browser only and is shared with Bank Reconciliation.</span>
              </div>
            </main>
          </div>
        </div>
      </div>
    </StoreProvider>
  );
}
