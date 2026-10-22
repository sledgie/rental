import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Copy, Eye, FilePlus2, FileText, Grid2X2, List, MoreHorizontal, Pencil, Power, SearchX, Send, Sparkles, Trash2, Workflow } from 'lucide-react';
import { Button as TnButton, IconButton, Overlay } from '../tenants/components/ui';
import { FilterField, FilterPopover, SearchField } from '../shell/directory';
import { ApiError, communicationApi, getSettings, listTemplates, subscribeTemplates, templatesVersion } from './lib/client-api';
import { CATEGORIES, CATEGORY_MAP, PROPERTIES } from './lib/catalog';
import type { MessageTemplate } from './lib/types';
import { Badge, Button, ChannelBadge, ConfirmDialog, Modal, Pagination, StatusBadge, ToastRegion, useToast } from './components/ui';
import { MessagePreview } from './components/message-preview';
import { TestSendDialog } from './components/test-send-dialog';
import { TemplateEditor } from './components/template-editor';
import './msgtemplates.css';

const PAGE_SIZE = 10;
const SORTS = [
  ['updated_desc', 'Recently modified'],
  ['updated_asc', 'Oldest modified'],
  ['name_asc', 'Name A–Z'],
  ['name_desc', 'Name Z–A'],
  ['category_asc', 'Category'],
] as const;
const CHANNEL_TABS = [
  ['', 'All templates'],
  ['email', 'Email'],
  ['sms', 'SMS'],
  ['in_app', 'In-App'],
] as const;

const formatDate = (value: string) => new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Toronto' }).format(new Date(value));
const goto = (query: string) => { window.location.hash = `#/message-templates${query ? `?${query}` : ''}`; };

function ActionMenu({ template, onView, onEdit, onPreview, onTest, onDuplicate, onStatus, onDelete, busy }: { template: MessageTemplate; onView: () => void; onEdit: () => void; onPreview: () => void; onTest: () => void; onDuplicate: () => void; onStatus: () => void; onDelete: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', key); };
  }, [open]);
  function toggle(event: React.MouseEvent) {
    event.stopPropagation();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: Math.min(rect.bottom + 4, window.innerHeight - 350), left: Math.max(8, rect.right - 208) });
    setOpen(!open);
  }
  const items = [
    { label: 'View details', icon: Eye, action: onView },
    { label: 'Edit template', icon: Pencil, action: onEdit },
    { label: 'Preview', icon: FileText, action: onPreview },
    { label: 'Test Send', icon: Send, action: onTest },
    { label: 'Duplicate', icon: Copy, action: onDuplicate },
    { label: template.status === 'active' ? 'Deactivate' : 'Activate', icon: Power, action: onStatus },
    { label: 'Delete', icon: Trash2, action: onDelete, danger: true },
  ];
  return (
    <>
      <button ref={buttonRef} onClick={toggle} disabled={busy} className="rounded-md p-2 text-u-muted hover:bg-u-s3 hover:text-u-ink disabled:opacity-40" aria-label={`Actions for ${template.name}`} aria-expanded={open}><MoreHorizontal size={17} /></button>
      {open && (
        <div className="fixed z-[120] w-52 rounded-lg border border-u-line bg-u-card p-1.5 shadow-xl" style={position} onClick={(event) => event.stopPropagation()} role="menu">
          {items.map((item) => (
            <button key={item.label} role="menuitem" onClick={() => { setOpen(false); item.action(); }} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs font-medium ${item.danger ? 'text-u-danger hover:bg-u-danger-soft' : 'text-u-ink2 hover:bg-u-s2 hover:text-u-ink'}`}>
              <item.icon size={14} />{item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default function MessageTemplates({ params }: { params?: Record<string, string> }) {
  useSyncExternalStore(subscribeTemplates, templatesVersion);
  const templates = listTemplates();
  const settings = getSettings();
  const { toasts, notify, dismiss } = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [channel, setChannel] = useState(params?.channel ?? '');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('updated_desc');
  const [view, setView] = useState<'list' | 'grid'>(() => { try { return localStorage.getItem('nb-template-view') === 'grid' ? 'grid' : 'list'; } catch { return 'list'; } });
  const [page, setPage] = useState(1);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [testTemplate, setTestTemplate] = useState<MessageTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<MessageTemplate | null>(null);
  const [scenarioId, setScenarioId] = useState('rent');
  const [busyId, setBusyId] = useState('');
  const [seeding, setSeeding] = useState(false);
  const editorDirty = useRef(false);

  const editId = params?.tpl ?? '';
  const viewId = params?.view ?? '';
  const isNew = params?.new === '1';
  const editing = editId ? templates.find((t) => t.id === editId) : undefined;
  const viewing = viewId ? templates.find((t) => t.id === viewId) : undefined;

  const filtered = (() => {
    const term = search.trim().toLowerCase();
    return templates
      .filter((t) => {
        const haystack = `${t.name} ${t.description} ${t.subject} ${t.body} ${t.updatedBy}`.toLowerCase();
        return (!term || haystack.includes(term)) && (!category || t.category === category) && (!channel || t.channel === channel) && (!status || t.status === status);
      })
      .sort((a, b) => sort === 'name_asc' ? a.name.localeCompare(b.name) : sort === 'name_desc' ? b.name.localeCompare(a.name) : sort === 'category_asc' ? (CATEGORY_MAP[a.category]?.label ?? a.category).localeCompare(CATEGORY_MAP[b.category]?.label ?? b.category) : sort === 'updated_asc' ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt));
  })();
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [search, category, channel, status, sort]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const popoverCount = (category ? 1 : 0) + (status ? 1 : 0) + (sort !== 'updated_desc' ? 1 : 0);
  const channelCount = (value: string) => templates.filter((t) => !value || t.channel === value).length;

  function changeView(next: 'list' | 'grid') { setView(next); try { localStorage.setItem('nb-template-view', next); } catch { /* optional */ } }
  function clearFilters() { setSearch(''); setCategory(''); setChannel(''); setStatus(''); setSort('updated_desc'); }
  async function runStatus(template: MessageTemplate) {
    setBusyId(template.id);
    try { await communicationApi.setTemplateStatus(template.id, template.status !== 'active'); notify(`${template.name} ${template.status === 'active' ? 'deactivated' : 'activated'}.`); }
    catch (caught) { notify(caught instanceof ApiError ? caught.message : 'Status could not be changed.', 'error'); }
    finally { setBusyId(''); }
  }
  async function runDuplicate(template: MessageTemplate) {
    setBusyId(template.id);
    try { const response = await communicationApi.duplicateTemplate(template.id); notify(`Created “${response.template.name}” as a draft.`); }
    catch { notify('The template could not be duplicated.', 'error'); }
    finally { setBusyId(''); }
  }
  async function runDelete() {
    if (!deleteTemplate) return;
    setBusyId(deleteTemplate.id);
    try { await communicationApi.deleteTemplate(deleteTemplate.id); notify(`“${deleteTemplate.name}” deleted.`, 'info'); setDeleteTemplate(null); }
    catch { notify('The template could not be deleted.', 'error'); }
    finally { setBusyId(''); }
  }
  async function seed() {
    setSeeding(true);
    try { const response = await communicationApi.seedTemplates(); notify(response.message, response.added ? 'success' : 'info'); }
    catch { notify('Example templates could not be loaded.', 'error'); }
    finally { setSeeding(false); }
  }

  function closeDrawer() {
    if (editorDirty.current && !window.confirm('Discard unsaved changes? Your latest edits have not been saved.')) return;
    editorDirty.current = false;
    goto('');
  }

  const actions = (template: MessageTemplate) => (
    <ActionMenu
      template={template}
      busy={busyId === template.id}
      onView={() => goto(`view=${template.id}`)}
      onEdit={() => goto(`tpl=${template.id}`)}
      onPreview={() => { setPreviewTemplate(template); setScenarioId('rent'); }}
      onTest={() => setTestTemplate(template)}
      onDuplicate={() => runDuplicate(template)}
      onStatus={() => runStatus(template)}
      onDelete={() => setDeleteTemplate(template)}
    />
  );
  const automationLink = (template: MessageTemplate) => template.automationNames?.length
    ? <span className="flex items-center gap-1.5 text-[11px] font-medium text-u-accent"><Workflow size={13} className="shrink-0" /><span className="truncate">{template.automationNames[0]}{template.automationNames.length > 1 ? ` +${template.automationNames.length - 1}` : ''}</span></span>
    : <span className="text-[11px] text-u-muted">Not linked</span>;

  return (
    <div className="tn mtp">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line">
                  <h1>Message Templates</h1>
                  <span className="muted">{templates.length} templates</span>
                </div>
                <p>Create reusable, property-aware email, SMS and in-app messages for every stage of the rental lifecycle. Content lives here; automation rules decide when and to whom it is sent.</p>
              </div>
              <div className="page-heading-actions no-print">
                <TnButton onClick={seed} disabled={seeding}><Sparkles size={15} />Add examples</TnButton>
                <TnButton variant="primary" onClick={() => goto('new=1')}><FilePlus2 size={15} />Create template</TnButton>
              </div>
            </div>

            <section className="directory-panel" aria-label="Message templates">
              <div className="directory-tabs no-print" aria-label="Filter templates by channel">
                {CHANNEL_TABS.map(([value, label]) => (
                  <button key={value} type="button" className={`directory-tab ${channel === value ? 'selected' : ''}`} aria-pressed={channel === value} onClick={() => setChannel(value)}>
                    {label}<span>{channelCount(value)}</span>
                  </button>
                ))}
                <div className="directory-tabs-end"><span className="live-dot" />Demo data</div>
              </div>
              <div className="directory-toolbar no-print">
                <SearchField label="Search templates" placeholder="Search templates, subjects or content..." value={search} onChange={setSearch} />
                <div className="toolbar-actions">
                  <FilterPopover title="Filter templates" count={popoverCount} onReset={() => { setCategory(''); setStatus(''); setSort('updated_desc'); }}>
                    <FilterField id="mt-category" label="Category">
                      <select id="mt-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="">All categories</option>
                        {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="mt-status" label="Status">
                      <select id="mt-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </FilterField>
                    <FilterField id="mt-sort" label="Sort by">
                      <select id="mt-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                        {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </FilterField>
                  </FilterPopover>
                  <IconButton label="List view" onClick={() => changeView('list')}><List size={16} /></IconButton>
                  <IconButton label="Grid view" onClick={() => changeView('grid')}><Grid2X2 size={15} /></IconButton>
                </div>
              </div>

              <div className="u-root mt mt-body">
                {templates.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-u-accent-soft text-u-accent"><FileText size={22} /></span>
                    <h2 className="mt-4 text-base font-semibold text-u-ink">Build your communication library</h2>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-u-muted">Start with a blank template or load the complete example catalogue. Examples are editable drafts and active content, not sent messages.</p>
                    <div className="mt-5 flex justify-center gap-2"><Button variant="secondary" onClick={seed} loading={seeding}>Load example templates</Button><Button onClick={() => goto('new=1')}>Create Template</Button></div>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <SearchX size={28} className="mx-auto text-u-s3" />
                    <h2 className="mt-3 text-sm font-semibold text-u-ink">No templates match these filters</h2>
                    <p className="mt-1.5 text-xs text-u-muted">Try a broader search or clear the category, channel and status filters.</p>
                    <Button variant="secondary" className="mt-4" onClick={clearFilters}>Clear all filters</Button>
                  </div>
                ) : (
                  <>
                    {view === 'list' && (
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="border-b border-u-line bg-u-s2 text-[10px] font-semibold uppercase tracking-[.07em] text-u-muted">
                              <th className="px-4 py-3">Template</th><th className="px-3 py-3">Category &amp; channel</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Automation</th><th className="px-3 py-3">Last modified</th><th className="w-14 px-3 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-u-line">
                            {visible.map((template) => (
                              <tr key={template.id} className="group hover:bg-u-s2">
                                <td className="max-w-[360px] px-4 py-3.5">
                                  <button onClick={() => goto(`view=${template.id}`)} className="block max-w-full text-left">
                                    <span className="flex items-center gap-2"><span className="truncate text-[13px] font-semibold text-u-ink group-hover:text-u-accent">{template.name}</span>{template.legalNotice && <Badge tone="amber">Legal review</Badge>}</span>
                                    <span className="mt-1 block truncate text-[11px] text-u-muted">{template.channel === 'email' ? template.subject || 'No subject' : template.description}</span>
                                  </button>
                                </td>
                                <td className="px-3 py-3.5"><p className="text-[11px] font-medium text-u-ink2">{CATEGORY_MAP[template.category]?.label ?? template.category}</p><div className="mt-1.5"><ChannelBadge channel={template.channel} /></div></td>
                                <td className="px-3 py-3.5"><StatusBadge status={template.status} /></td>
                                <td className="max-w-[180px] px-3 py-3.5">{automationLink(template)}</td>
                                <td className="whitespace-nowrap px-3 py-3.5"><p className="text-[11px] text-u-ink2">{formatDate(template.updatedAt)}</p><p className="mt-1 text-[10px] text-u-muted">{template.updatedBy} · v{template.version}</p></td>
                                <td className="px-3 py-3.5">{actions(template)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className={view === 'grid' ? 'grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3 p-3 md:hidden'}>
                      {visible.map((template) => (
                        <article key={template.id} className="rounded-lg border border-u-line bg-u-card p-4 transition-colors hover:border-u-line2">
                          <div className="flex items-start gap-3">
                            <button onClick={() => goto(`view=${template.id}`)} className="min-w-0 flex-1 text-left">
                              <h3 className="truncate text-[13px] font-semibold text-u-ink hover:text-u-accent">{template.name}</h3>
                              <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-u-muted">{template.description}</p>
                            </button>
                            {actions(template)}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5"><ChannelBadge channel={template.channel} /><StatusBadge status={template.status} />{template.legalNotice && <Badge tone="amber">Legal review</Badge>}</div>
                          {template.channel === 'email' && <p className="mt-3 truncate border-t border-u-line pt-3 text-[11px] text-u-ink2"><span className="text-u-muted">Subject:</span> {template.subject}</p>}
                          <div className="mt-3 flex items-center justify-between border-t border-u-line pt-3 text-[10px] text-u-muted">
                            <span>{CATEGORY_MAP[template.category]?.short ?? template.category} · {formatDate(template.updatedAt)}</span>
                            <span>{template.automationIds?.length ? `${template.automationIds.length} rule${template.automationIds.length === 1 ? '' : 's'}` : `v${template.version}`}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                    <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} shown={visible.length} />
                  </>
                )}
              </div>
            </section>

            <div className="directory-footnote no-print">
              <span>Demonstration data held in memory for this session. Test sends are validated and recorded; no email, SMS or in-app message is actually delivered.</span>
            </div>
          </main>
        </div>
      </div>

      {viewing && (
        <Overlay title={viewing.name} subtitle={viewing.description} drawer wide onClose={() => goto('')}>
          <div className="u-drawer-scroll">
            <div className="u-root mt">
              <div className="space-y-5 px-1 pb-4">
                <div className="flex flex-wrap gap-2"><ChannelBadge channel={viewing.channel} /><StatusBadge status={viewing.status} /><Badge>{CATEGORY_MAP[viewing.category]?.label ?? viewing.category}</Badge>{viewing.legalNotice && <Badge tone="amber">Jurisdiction review required</Badge>}</div>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {[
                    ['Data context', viewing.eventContext],
                    ['Availability', viewing.propertyScope.type === 'company' ? 'Company-wide' : viewing.propertyScope.propertyIds.map((id) => PROPERTIES.find((p) => p.id === id)?.name ?? id).join(', ')],
                    ['Language', viewing.language],
                    ['Version', `Version ${viewing.version}`],
                    ['Last modified', `${formatDate(viewing.updatedAt)} by ${viewing.updatedBy}`],
                    ['Created', `${formatDate(viewing.createdAt)} by ${viewing.createdBy}`],
                  ].map(([label, value]) => <div key={label}><dt className="text-[10px] font-semibold uppercase tracking-wide text-u-muted">{label}</dt><dd className="mt-1 text-xs leading-5 text-u-ink2">{value}</dd></div>)}
                </dl>
                {viewing.channel === 'email' && <div><p className="text-[10px] font-semibold uppercase tracking-wide text-u-muted">Email subject</p><p className="mt-1 rounded-lg bg-u-s2 p-3 text-xs text-u-ink2">{viewing.subject}</p></div>}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-u-muted">Merge fields used</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{viewing.availableVariables.length ? viewing.availableVariables.map((name) => <code key={name} className="rounded bg-u-accent-soft px-2 py-1 text-[10px] text-u-accent">{`{{${name}}}`}</code>) : <span className="text-xs text-u-muted">No merge fields</span>}</div>
                </div>
                {viewing.automationNames?.length ? <div><p className="text-[10px] font-semibold uppercase tracking-wide text-u-muted">Associated automation rules</p><ul className="mt-2 space-y-1.5">{viewing.automationNames.map((name) => <li key={name} className="flex items-center gap-2 text-xs text-u-ink2"><Workflow size={13} className="text-u-accent" />{name}</li>)}</ul></div> : null}
                {viewing.internalNotes && <div><p className="text-[10px] font-semibold uppercase tracking-wide text-u-muted">Internal notes</p><p className="mt-1 text-xs leading-5 text-u-ink2">{viewing.internalNotes}</p></div>}
                <div className="flex flex-wrap justify-end gap-2 border-t border-u-line pt-4">
                  <Button variant="secondary" onClick={() => goto('')}>Close</Button>
                  <Button variant="secondary" onClick={() => { setPreviewTemplate(viewing); setScenarioId('rent'); goto(''); }}>Preview</Button>
                  <Button onClick={() => goto(`tpl=${viewing.id}`)}><Pencil size={14} />Edit template</Button>
                </div>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {(isNew || editing) && (
        <Overlay title={editing ? 'Edit template' : 'Create template'} subtitle={editing ? editing.name : 'Define content once and reuse it across manual and automated communications'} drawer wide onClose={closeDrawer} className="mt-drawer">
          <div className="u-drawer-scroll">
            <div className="u-root mt">
              <TemplateEditor
                key={editing?.id ?? 'new'}
                initialTemplate={editing}
                settings={settings}
                onClose={() => { editorDirty.current = false; goto(''); }}
                onSaved={(saved) => { editorDirty.current = false; if (!editing) goto(`tpl=${saved.id}`); }}
                onDirtyChange={(dirty) => { editorDirty.current = dirty; }}
              />
            </div>
          </div>
        </Overlay>
      )}

      <div className="u-root mt">
        <Modal open={Boolean(previewTemplate)} onClose={() => setPreviewTemplate(null)} title={previewTemplate ? `Preview · ${previewTemplate.name}` : 'Template preview'} description="Uses clearly labelled sample data. Previewing never sends a message." size="xl">
          <div className="h-[74dvh] p-4">{previewTemplate && <MessagePreview template={previewTemplate} scenarioId={scenarioId} onScenarioChange={setScenarioId} />}</div>
        </Modal>
        <TestSendDialog open={Boolean(testTemplate)} onClose={() => setTestTemplate(null)} template={testTemplate} templateId={testTemplate?.id} defaultTestRecipient={settings.testRecipients.split(',')[0]?.trim()} onRecorded={(log) => notify(log.status === 'failed' ? 'Test request recorded as failed; nothing was sent.' : 'Request accepted by provider; delivery is not confirmed.', log.status === 'failed' ? 'info' : 'success')} />
        <ConfirmDialog open={Boolean(deleteTemplate)} onClose={() => setDeleteTemplate(null)} onConfirm={runDelete} loading={Boolean(deleteTemplate && busyId === deleteTemplate.id)} title={`Delete “${deleteTemplate?.name ?? ''}”?`} description={`This permanently deletes version ${deleteTemplate?.version ?? ''} of the template. Associated automation rules will remain but lose their template selection. Existing communication history is preserved.`} confirmLabel="Delete template" destructive />
        <ToastRegion toasts={toasts} dismiss={dismiss} />
      </div>
    </div>
  );
}
