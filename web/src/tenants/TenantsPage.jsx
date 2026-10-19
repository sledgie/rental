// Tenants list page: toolbar, quick-view panel, filter chips, data grid, drawers.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Modal, Status, useLoad } from '../ui.jsx';
import LeaseTerms from '../leaseTerms.jsx';
import { COL, defaultState, mergeState } from './columns.js';
import { applyFilters } from './filters.js';
import Toolbar from './Toolbar.jsx';
import QuickViewPanel, { VIEWS } from './QuickViewPanel.jsx';
import { FilterChips } from './FilterBuilder.jsx';
import BulkBar from './BulkBar.jsx';
import DataGrid from './DataGrid.jsx';
import CustomizeTableDrawer from './CustomizeTableDrawer.jsx';
import PreviewDrawer from './PreviewDrawer.jsx';
import TenantForm from './TenantForm.jsx';

const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const compare = (c, a, b) => {
  const x = c.value(a); const y = c.value(b);
  if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1; // blanks sort last either way
  if (y === null || y === undefined) return -1;
  return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
};

export default function TenantsPage({ notify, refreshProps, params = {} }) {
  const { data, error, loading, reload } = useLoad(() => api.get('/tenants'), []);
  const us = useLoad(() => api.get('/units'), []);
  const [view, setView] = useState('all'); const [filters, setFilters] = useState([]);
  const [saved, setSaved] = useState(() => store.get('tv.saved', [])); const [activeSaved, setActiveSaved] = useState(null);
  const [cols, setCols] = useState(() => { const s = store.get('tv.cols', null); return s ? mergeState(s) : defaultState(); });
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(0); const [pageSize, setPageSize] = useState(store.get('tv.size', 25));
  const [selected, setSelected] = useState(new Set()); const [quickOpen, setQuickOpen] = useState(store.get('tv.quick', true));
  const [form, setForm] = useState(null); const [leaseId, setLeaseId] = useState(null); const [preview, setPreview] = useState(null);
  const [settings, setSettings] = useState(false); const [confirm, setConfirm] = useState(null); const [busy, setBusy] = useState(false);

  const all = data || [];
  const counts = useMemo(() => Object.fromEntries(VIEWS.map(([k]) => [k, k === 'all' ? all.length : all.filter((t) => t.status === k).length])), [all]);
  const rows = useMemo(() => {
    const c = COL[sort.key] || COL.name;
    const out = applyFilters(all.filter((t) => view === 'all' || t.status === view), filters).sort((a, b) => compare(c, a, b));
    return sort.dir === 'desc' ? out.reverse() : out;
  }, [all, view, filters, sort]);
  useEffect(() => { setPage(0); }, [view, filters, pageSize]);
  useEffect(() => { setSelected((s) => { const ids = new Set(all.map((t) => t.id)); const n = new Set([...s].filter((id) => ids.has(id))); return n.size === s.size ? s : n; }); }, [all]);

  const changeCols = (c) => { setCols(c); store.set('tv.cols', c); };
  const sortBy = (key, dir) => setSort({ key, dir });
  const changeFilters = (f) => { setFilters(f); setActiveSaved(null); };
  const refresh = () => { reload(); us.reload(); refreshProps(); };
  const edit = (t) => setForm({ t });
  // Links from other pages: #/tenants?tenant=ID edits that tenant, #/tenants?add=UNIT_ID starts a new tenant on the unit, #/tenants?new=1 a blank one.
  useEffect(() => {
    if (params.new) setForm({});
    else if (params.add && us.data) setForm({ unit: params.add });
    else if (params.tenant && data) { const t = data.find((x) => x.id === params.tenant); if (t) setForm({ t }); else notify('Tenant not found'); }
  }, [params.new, params.add, params.tenant, data, us.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeForm = () => { setForm(null); if (params.add || params.tenant || params.new) window.location.hash = '#/tenants'; };

  const saveSearch = (name) => { const s = { id: Math.random().toString(36).slice(2), name, filters: filters.map((f) => ({ ...f })) }; const n = [...saved, s]; setSaved(n); store.set('tv.saved', n); setActiveSaved(s.id); notify(`Saved search "${name}"`); };
  const deleteSaved = (id) => { const n = saved.filter((s) => s.id !== id); setSaved(n); store.set('tv.saved', n); if (activeSaved === id) setActiveSaved(null); };
  const applySaved = (s) => { setView('all'); setFilters(s.filters.map((f) => ({ ...f }))); setActiveSaved(s.id); };

  const deactivate = async () => {
    setBusy(true); let done = 0;
    try { for (const t of confirm) { await api.post(`/tenants/${t.id}/move-out`); done += 1; } notify(done === 1 ? `${confirm[0].first} ${confirm[0].last} moved out` : `${done} tenants moved out`); }
    catch (e) { notify(e.message); }
    setBusy(false); setConfirm(null); setSelected(new Set()); setPreview(null); refresh();
  };

  const title = activeSaved ? saved.find((s) => s.id === activeSaved)?.name : VIEWS.find(([k]) => k === view)[1];
  const chosen = all.filter((t) => selected.has(t.id));
  return (
    <div className="tv-page">
      <Toolbar title={title} count={rows.length} quickOpen={quickOpen} onQuick={() => { setQuickOpen(!quickOpen); store.set('tv.quick', !quickOpen); }}
        onAddFilter={(f) => changeFilters([...filters, f])} onAdd={(role) => setForm({ role })} onSettings={() => { setPreview(null); setSettings(!settings); }} />
      <FilterChips filters={filters} onChange={changeFilters} onClear={() => changeFilters([])} onSave={saveSearch} />
      <div className="tv-body">
        {quickOpen && <QuickViewPanel view={view} onView={(k) => { setView(k); setActiveSaved(null); setFilters([]); }} counts={counts} saved={saved} activeSaved={activeSaved} onApplySaved={applySaved} onDeleteSaved={deleteSaved} />}
        <div className="tv-main">
          <BulkBar rows={chosen} onClear={() => setSelected(new Set())} onDeactivate={setConfirm} />
          <Status loading={loading && !data} error={error} onRetry={reload} />
          {data && (
            <DataGrid rows={rows} total={rows.length} cols={cols} onCols={changeCols} sort={sort} onSort={sortBy} selected={selected} onSelect={setSelected}
              page={page} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); store.set('tv.size', n); }} loading={loading}
              onPreview={(t) => { setSettings(false); setPreview(t); }} onOpen={edit} onEdit={edit} onLease={(t) => setLeaseId(t.leaseId)} onDeactivate={setConfirm} />
          )}
        </div>
        {settings && <CustomizeTableDrawer cols={cols} onCols={changeCols} onReset={() => changeCols(defaultState())} onClose={() => setSettings(false)} />}
        {preview && <PreviewDrawer row={all.find((t) => t.id === preview.id) || preview} onClose={() => setPreview(null)} onEdit={(t) => { setPreview(null); edit(t); }} onLease={(t) => setLeaseId(t.leaseId)} />}
      </div>
      {form && <TenantForm tenant={form.t} presetUnit={form.unit} presetRole={form.role} units={us.data || []} onClose={closeForm} onSaved={(m) => { notify(m); closeForm(); refresh(); }} />}
      {leaseId && <LeaseTerms leaseId={leaseId} onClose={() => setLeaseId(null)} onSaved={(m) => { setLeaseId(null); notify(m); refresh(); }} />}
      {confirm && (
        <Modal title="Deactivate tenant" onClose={() => !busy && setConfirm(null)} footer={<><button type="button" className="btn pri" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} disabled={busy} onClick={deactivate}>{busy ? 'Working...' : 'Deactivate'}</button><button type="button" className="btn" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></>}>
          <p style={{ margin: 0 }}>{confirm.length === 1 ? `${confirm[0].first} ${confirm[0].last} will be moved out and marked as a past tenant.` : `${confirm.length} tenants will be moved out and marked as past tenants.`} If they are the primary tenant, the lease passes to a co-tenant, or ends when nobody liable is left. Their balance and history stay on record.</p>
        </Modal>
      )}
    </div>
  );
}
