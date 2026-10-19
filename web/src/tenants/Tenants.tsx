import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleDollarSign,
  CircleHelp,
  Download,
  FileCheck2,
  FileText,
  FolderClosed,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type {
  Database,
  LeaseAssociation,
  ProfileTab,
  Tenant,
  TenantInput,
} from "./types";
import { getWarningDays, setWarningDays, useTenantDb, useWarningDays } from "./store";
import {
  appendActivity,
  associatePerson,
  createLease,
  dashboardSummary,
  DEFAULT_WARNING_DAYS,
  downloadFile,
  filterTenants,
  fullName,
  leaseStatus,
  money,
  saveTenant,
  tenantCsv,
  today,
  uid,
  type DirectoryFilters,
} from "./lib/domain";
import { Button, IconButton, Overlay, Toast } from "./components/ui";
import { DirectoryControls, TenantTable } from "./components/TenantTable";
import type { DetailActions } from "./components/TenantDetails";
import {
  AddPersonForm,
  AssociateLeaseForm,
  emptyAssociation,
  PaymentForm,
  TenantForm,
  type PersonAssociationInput,
} from "./components/Forms";
import { TenantProfile } from "./components/TenantProfile";
import {
  LeaseDetail,
  PropertyDetail,
  UnitDetail,
} from "./components/EntityDetails";
import { WorkspacePanel, type WorkspaceView } from "./components/Workspace";

type DialogState =
  | { type: "tenant"; tenantId?: string }
  | { type: "person" | "associate" | "archive" | "payment"; tenantId: string }
  | null;
type EntityState = { type: "lease" | "property" | "unit"; id: string } | null;
const initialFilters: DirectoryFilters = {
  // (warningDays is replaced by the shared preference when the page opens)
  search: "",
  status: "All Tenants",
  outstanding: false,
  expiring: false,
  includeArchived: false,
  propertyId: "",
  sort: "default",
  descending: false,
  warningDays: DEFAULT_WARNING_DAYS,
};
export default function Tenants({ params }: { params?: Record<string, string> }) {
  const [db, setDb] = useTenantDb();
  const warningDaysPref = useWarningDays();
  const [filters, setFilters] = useState<DirectoryFilters>(() => ({ ...initialFilters, warningDays: getWarningDays() }));
  const [expandedId, setExpandedId] = useState<string | null>(() =>
    window.matchMedia("(min-width: 1161px)").matches ? "t1" : null,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [entity, setEntity] = useState<EntityState>(null);
  const [profile, setProfile] = useState<{
    id: string;
    tab: ProfileTab;
  } | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [dense, setDense] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const summary = useMemo(() => dashboardSummary(db), [db]);
  const filtered = useMemo(() => filterTenants(db, filters), [db, filters]);
  const expiringCount = db.leases.filter(
    (l) => leaseStatus(l, filters.warningDays) === "Expiring",
  ).length;
  const notify = useCallback(
    (message: string, type: "success" | "error" = "success") =>
      setToast({ message, type }),
    [],
  );
  const dismissToast = useCallback(() => setToast(null), []);
  const tenantById = (id: string) => db.tenants.find((t) => t.id === id)!;
  const changeFilters = (next: DirectoryFilters) => {
    setFilters(next);
    setPage(1);
  };
  const clearFilters = () =>
    changeFilters({ ...initialFilters, warningDays: filters.warningDays });
  const openAddTenant = () => {
    setWorkspace(null);
    setDialog({ type: "tenant" });
  };
  const openWorkspace = (view: WorkspaceView) => {
    setWorkspace(view);
  };

  const actions: DetailActions = {
    onProfile: (id, tab = "Overview") => {
      setProfile({ id, tab });
      setEntity(null);
      setWorkspace(null);
    },
    onLease: (id) => {
      setEntity({ type: "lease", id });
      setWorkspace(null);
    },
    onProperty: (id) => {
      setEntity({ type: "property", id });
      setWorkspace(null);
    },
    onUnit: (id) => {
      setEntity({ type: "unit", id });
      setWorkspace(null);
    },
    onAddPerson: (tenantId) => {
      const eligible = db.leaseParties.some(
        (p) =>
          p.tenantId === tenantId &&
          db.leases.some(
            (l) =>
              l.id === p.leaseId &&
              !["Expired", "Terminated"].includes(leaseStatus(l)),
          ),
      );
      if (!eligible) {
        setDialog({ type: "associate", tenantId });
        notify("Add a current lease first, then connect this household.");
      } else setDialog({ type: "person", tenantId });
    },
    onAddLease: (tenantId) => setDialog({ type: "associate", tenantId }),
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        dialog ||
        entity ||
        profile ||
        workspace ||
        target.closest("input, textarea, select, [contenteditable]") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setDialog({ type: "tenant" });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [dialog, entity, profile, workspace]);

  const clearDeepLink = () => {
    window.history.replaceState(null, "", "#/tenants");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  useEffect(() => {
    if (!params?.new) return;
    setDialog({ type: "tenant" });
    clearDeepLink();
  }, [params?.new]);
  useEffect(() => {
    const id = params?.tenant;
    if (!id) return;
    if (db.tenants.some((t) => t.id === id)) setProfile({ id, tab: "Overview" });
    clearDeepLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.tenant]);

  useEffect(() => {
    if (!params?.expiring && !params?.outstanding) return;
    changeFilters({
      ...initialFilters,
      warningDays: warningDaysPref,
      expiring: !!params.expiring,
      outstanding: !!params.outstanding,
      includeArchived: !!params.outstanding,
    });
    clearDeepLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.expiring, params?.outstanding]);

  const handleTenantSave = (
    input: TenantInput,
    association: LeaseAssociation,
    editingId?: string,
  ) => {
    const result = saveTenant(db, input, association, editingId);
    setDb(result.db);
    setDialog(null);
    if (!editingId) {
      clearFilters();
      setExpandedId(result.tenant.id);
    }
    notify(
      `${fullName(result.tenant)} ${editingId ? "updated" : "added to your directory"}.`,
    );
  };

  const handleAssociate = (tenantId: string, association: LeaseAssociation) => {
    let next = db;
    if (association.mode === "new" && association.newLease)
      next = createLease(
        db,
        tenantId,
        association.newLease,
        association.role,
        association.isSignatory,
      );
    else if (association.mode === "existing" && association.leaseId)
      next = associatePerson(
        db,
        tenantId,
        association.leaseId,
        association.role,
        association.unitIds,
        association.isSignatory,
      );
    setDb(next);
    setDialog(null);
    notify(
      association.mode === "new"
        ? "Lease created and associated with this tenant."
        : "Existing lease associated with this tenant.",
    );
  };

  const handleAddPerson = (input: PersonAssociationInput) => {
    let next = db;
    let tenantId = input.existingTenantId;
    if (input.newPerson) {
      const result = saveTenant(db, input.newPerson, emptyAssociation());
      next = result.db;
      tenantId = result.tenant.id;
    }
    if (!tenantId)
      throw new Error("Choose an existing person or provide their details.");
    next = associatePerson(
      next,
      tenantId,
      input.leaseId,
      input.role,
      input.unitIds,
      input.isSignatory,
    );
    const person = next.tenants.find((t) => t.id === tenantId)!;
    if (dialog && "tenantId" in dialog && dialog.tenantId)
      next = appendActivity(
        next,
        dialog.tenantId,
        "Household member added",
        `${fullName(person)} joined as ${input.role.toLowerCase()}.`,
      );
    setDb(next);
    setDialog(null);
    notify(`${fullName(person)} added as ${input.role.toLowerCase()}.`);
  };

  const handleArchive = (tenantId: string) => {
    const tenant = tenantById(tenantId);
    if (tenant.archivedAt) {
      const next = {
        ...db,
        tenants: db.tenants.map((t) =>
          t.id === tenantId
            ? {
                ...t,
                archivedAt: undefined,
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      };
      setDb(
        appendActivity(
          next,
          tenantId,
          "Tenant restored",
          "Record restored to the directory. Previous lease and financial history is unchanged.",
        ),
      );
      notify(`${fullName(tenant)} restored to the directory.`);
    } else setDialog({ type: "archive", tenantId });
  };

  const confirmArchive = (tenant: Tenant) => {
    const date = new Date().toISOString();
    const next: Database = {
      ...db,
      tenants: db.tenants.map((t) =>
        t.id === tenant.id
          ? { ...t, archivedAt: date, updatedAt: date, tenantStatus: "Former" }
          : t,
      ),
    };
    setDb(
      appendActivity(
        next,
        tenant.id,
        "Tenant archived",
        "Hidden from the default directory. All leases, documents, and transactions retained.",
      ),
    );
    setDialog(null);
    if (expandedId === tenant.id) setExpandedId(null);
    notify(`${fullName(tenant)} archived. All history has been preserved.`);
  };

  const handlePayment = (
    accountId: string,
    amount: number,
    date: string,
    description: string,
  ) => {
    const account = db.accounts.find((a) => a.id === accountId)!;
    const rounded = Math.round(amount * 100) / 100;
    const next: Database = {
      ...db,
      transactions: [
        ...db.transactions,
        {
          id: uid("txn"),
          accountId,
          accountType: account.accountType,
          leaseId: account.leaseId,
          unitId: account.unitId,
          tenantId: account.tenantId,
          transactionType: "Payment",
          description: `Payment - ${description}`,
          amount: rounded,
          transactionDate: date,
          paymentStatus: "Posted",
        },
      ],
    };
    setDb(
      appendActivity(
        next,
        account.tenantId,
        "Payment recorded",
        `${money(rounded)} CAD posted to ${account.label}.`,
      ),
    );
    setDialog(null);
    notify(`${money(rounded)} payment recorded. Account balances updated.`);
  };

  const sortBy = (sort: DirectoryFilters["sort"]) =>
    changeFilters({
      ...filters,
      sort,
      descending:
        filters.sort === sort
          ? !filters.descending
          : ["balance", "units"].includes(sort),
    });
  const profileTenant = profile ? tenantById(profile.id) : undefined;
  const dialogTenant =
    dialog && "tenantId" in dialog && dialog.tenantId
      ? tenantById(dialog.tenantId)
      : undefined;

  return (
    <div className="tn">
    <div className={`app-shell ${dense ? "density-compact" : ""}`}>
      <div className="main-shell">
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="page-title-line">
                <h1>Tenants</h1>
              </div>
              <p>Manage tenants, leases, occupants, and balances.</p>
            </div>
            <div className="page-heading-actions">
              <Button
                onClick={() => {
                  downloadFile(
                    `rentora-tenants-${today()}.csv`,
                    tenantCsv(db, filtered),
                    "text/csv;charset=utf-8",
                  );
                  notify(
                    `Exported ${filtered.length} tenant record${filtered.length === 1 ? "" : "s"} to CSV.`,
                  );
                }}
              >
                <Download size={15} />
                Export
              </Button>
              <Button onClick={() => openWorkspace("Settings")}>
                <Settings size={15} />
                Preferences
              </Button>
              <Button variant="primary" onClick={openAddTenant}>
                <Plus size={17} />
                Add tenant
              </Button>
            </div>
          </div>
          <section className="directory-panel" aria-label="Tenant directory">
            <DirectoryControls
              db={db}
              filters={filters}
              onChange={changeFilters}
              searchRef={searchRef}
            />
            <TenantTable
              db={db}
              tenants={filtered}
              expandedId={expandedId}
              onExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              actions={actions}
              onEdit={(tenantId) => setDialog({ type: "tenant", tenantId })}
              onArchive={handleArchive}
              filters={filters}
              onSort={sortBy}
              page={page}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              onReset={clearFilters}
              onAdd={openAddTenant}
            />
          </section>
          <div className="directory-footnote">
            <span>
              <ShieldCheck size={13} />
              Your records stay connected. Your history stays intact.
            </span>
            <span>
              All amounts in CAD
              <span className="footnote-separator">&middot;</span>Posted
              transactions only
            </span>
          </div>
        </main>
      </div>
      {profile && profileTenant && (
        <TenantProfile
          key={profile.id}
          db={db}
          tenant={profileTenant}
          tab={profile.tab}
          onTab={(tab) => setProfile({ ...profile, tab })}
          onClose={() => setProfile(null)}
          onEdit={() => setDialog({ type: "tenant", tenantId: profile.id })}
          onArchive={() => handleArchive(profile.id)}
          onPayment={() => setDialog({ type: "payment", tenantId: profile.id })}
          actions={actions}
          warningDays={filters.warningDays}
        />
      )}
      {workspace && (
        <WorkspacePanel
          key={workspace}
          view={workspace}
          db={db}
          actions={actions}
          onClose={() => setWorkspace(null)}
          warningDays={filters.warningDays}
          dense={dense}
          onSettings={(warningDays, compact) => {
            setFilters({ ...filters, warningDays });
            setWarningDays(warningDays);
            setDense(compact);
            setWorkspace(null);
            notify("Workspace preferences saved.");
          }}
          onAddTenant={openAddTenant}
        />
      )}
      {entity?.type === "lease" && (
        <LeaseDetail
          key={entity.id}
          db={db}
          lease={db.leases.find((l) => l.id === entity.id)!}
          actions={actions}
          warningDays={filters.warningDays}
          onClose={() => setEntity(null)}
          notify={notify}
        />
      )}
      {entity?.type === "property" && (
        <PropertyDetail
          db={db}
          propertyId={entity.id}
          actions={actions}
          onClose={() => setEntity(null)}
        />
      )}
      {entity?.type === "unit" && (
        <UnitDetail
          db={db}
          unitId={entity.id}
          actions={actions}
          warningDays={filters.warningDays}
          onClose={() => setEntity(null)}
        />
      )}
      {dialog?.type === "tenant" && (
        <TenantForm
          db={db}
          tenant={dialogTenant}
          onClose={() => setDialog(null)}
          onSave={handleTenantSave}
        />
      )}
      {dialog?.type === "associate" && dialogTenant && (
        <AssociateLeaseForm
          db={db}
          tenant={dialogTenant}
          onClose={() => setDialog(null)}
          onSave={(association) =>
            handleAssociate(dialogTenant.id, association)
          }
        />
      )}
      {dialog?.type === "person" && dialogTenant && (
        <AddPersonForm
          db={db}
          tenant={dialogTenant}
          onClose={() => setDialog(null)}
          onSave={handleAddPerson}
        />
      )}
      {dialog?.type === "payment" && dialogTenant && (
        <PaymentForm
          db={db}
          tenant={dialogTenant}
          onClose={() => setDialog(null)}
          onSave={handlePayment}
        />
      )}
      {dialog?.type === "archive" && dialogTenant && (
        <Overlay title="Archive tenant?" onClose={() => setDialog(null)}>
          <div className="archive-dialog">
            <span className="archive-symbol">
              <Archive size={27} />
            </span>
            <h3>Archive {fullName(dialogTenant)}?</h3>
            <p>
              This person will be hidden from the default directory and marked
              as a former tenant. You can find them again using{" "}
              <strong>Include archived tenants</strong>.
            </p>
            <div className="archive-promise">
              <Check size={15} />
              <span>
                Leases, documents, transactions, and activity are preserved.
              </span>
            </div>
            <p className="archive-account-note">
              Archiving does not terminate a lease or clear an outstanding
              balance.
            </p>
          </div>
          <div className="form-footer">
            <Button onClick={() => setDialog(null)}>Keep tenant</Button>
            <Button
              variant="danger"
              onClick={() => confirmArchive(dialogTenant)}
            >
              <Archive size={15} />
              Archive tenant
            </Button>
          </div>
        </Overlay>
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={dismissToast}
        />
      )}
    </div>
    </div>
  );
}
