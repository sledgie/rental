import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MessageTemplate, MessageCategory } from '../types';
import {
  BookOpen,
  Plus,
  Search,
  Copy,
  Check,
  Send,
  Edit,
  Code,
  Sparkles,
} from 'lucide-react';

export const TemplateManager: React.FC = () => {
  const { templates, createTemplate, updateTemplate, openComposeModal } = useApp();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(
    templates[0] || null
  );
  const [copied, setCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit / Create Form State
  const [editName, setEditName] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editCategory, setEditCategory] = useState<MessageCategory>('General Inquiry');
  const [editBody, setEditBody] = useState('');
  const [editAudience, setEditAudience] = useState<'tenants' | 'owners' | 'vendors' | 'staff' | 'all'>('tenants');

  const filteredTemplates = templates.filter((tpl) => {
    if (categoryFilter && tpl.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.subject.toLowerCase().includes(q) ||
        tpl.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEdit = (tpl?: MessageTemplate) => {
    if (tpl) {
      setEditName(tpl.name);
      setEditSubject(tpl.subject);
      setEditCategory(tpl.category);
      setEditBody(tpl.body);
      setEditAudience(tpl.intendedAudience);
    } else {
      setEditName('');
      setEditSubject('');
      setEditCategory('General Inquiry');
      setEditBody('');
      setEditAudience('tenants');
    }
    setIsEditModalOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!editName.trim() || !editSubject.trim() || !editBody.trim()) {
      alert('Please fill out name, subject, and body.');
      return;
    }

    if (selectedTemplate && isEditModalOpen && editName === selectedTemplate.name) {
      updateTemplate({
        ...selectedTemplate,
        name: editName,
        subject: editSubject,
        category: editCategory,
        body: editBody,
        intendedAudience: editAudience,
      });
    } else {
      createTemplate({
        name: editName,
        subject: editSubject,
        category: editCategory,
        body: editBody,
        availableVariables: ['{{TenantName}}', '{{PropertyName}}', '{{UnitNumber}}'],
        intendedAudience: editAudience,
        status: 'active',
      });
    }

    setIsEditModalOpen(false);
  };

  const handleUseInCompose = (tpl: MessageTemplate) => {
    openComposeModal({
      subject: tpl.subject,
      category: tpl.category,
      body: tpl.body,
    });
  };

  const supportedVariables = [
    { tag: '{{TenantName}}', desc: "Full name of the active tenant (e.g. Marcus Vance)" },
    { tag: '{{PropertyName}}', desc: "Building or community name (e.g. Highland Towers)" },
    { tag: '{{UnitNumber}}', desc: "Assigned unit or apartment number (e.g. Unit 4B)" },
    { tag: '{{LeaseEndDate}}', desc: "Expiration date of the current lease agreement" },
    { tag: '{{InvoiceNumber}}', desc: "Billed invoice reference (e.g. INV-2025-089)" },
    { tag: '{{OutstandingBalance}}', desc: "Current pending account balance (e.g. $75.00)" },
    { tag: '{{PaymentDueDate}}', desc: "Designated rent or invoice due date" },
    { tag: '{{MaintenanceRequestNumber}}', desc: "Work order ticket number (e.g. WO-8821)" },
    { tag: '{{AppointmentDate}}', desc: "Scheduled service appointment window" },
    { tag: '{{PropertyManagerName}}', desc: "Name of the sender or property supervisor" },
  ];

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full bg-u-card overflow-hidden">
      {/* Templates List Sidebar */}
      <div className="w-96 shrink-0 border-r border-u-line flex flex-col h-full bg-u-s2/50">
        <div className="p-4 border-b border-u-line bg-u-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-u-accent" />
              <h2 className="text-base font-bold text-u-ink">Message Templates</h2>
            </div>
            <button
              onClick={() => handleOpenEdit()}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-u-accent hover:bg-u-accent-strong text-u-onaccent rounded-lg shadow-sm shadow-u-accent transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create</span>
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-u-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-u-s2 border border-u-line rounded-lg text-xs placeholder:text-u-muted focus:bg-u-card focus:outline-none focus:ring-1 focus:ring-u-accent/60"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-u-s2 border border-u-line rounded-lg px-2 py-1 text-u-ink2"
            >
              <option value="">All Categories</option>
              <option value="Rent and Payments">Rent & Payments</option>
              <option value="Lease and Renewal">Lease & Renewal</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Inspection">Inspection</option>
            </select>
          </div>
        </div>

        {/* List of Templates */}
        <div className="flex-1 overflow-y-auto divide-y divide-u-line">
          {filteredTemplates.map((tpl) => {
            const isSelected = selectedTemplate?.id === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => setSelectedTemplate(tpl)}
                className={`p-3.5 cursor-pointer transition-colors border-l-4 ${
                  isSelected
                    ? 'bg-u-accent-soft/60 border-l-u-accent'
                    : 'bg-u-card border-l-transparent hover:bg-u-s2'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-u-accent bg-u-accent-soft px-1.5 py-0.5 rounded border border-u-accent/30">
                    {tpl.category}
                  </span>
                  <span className="text-[10px] text-u-muted capitalize">
                    {tpl.intendedAudience}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-u-ink leading-snug line-clamp-1 mb-0.5">
                  {tpl.name}
                </h3>
                <p className="text-[11px] text-u-muted line-clamp-1">{tpl.subject}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Detail Pane */}
      <div className="flex-1 flex flex-col h-full bg-u-card overflow-y-auto p-6 space-y-6">
        {selectedTemplate ? (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-u-line pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-u-accent-soft text-u-accent">
                    {selectedTemplate.category}
                  </span>
                  <span className="text-xs text-u-muted">
                    Audience: <strong className="text-u-ink2">{selectedTemplate.intendedAudience}</strong>
                  </span>
                </div>
                <h1 className="text-lg font-bold text-u-ink">{selectedTemplate.name}</h1>
                <p className="text-xs text-u-muted mt-0.5">
                  Subject Line: <strong className="text-u-ink">{selectedTemplate.subject}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopyText(selectedTemplate.body)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-u-s3 hover:bg-u-line text-u-ink2 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-u-ok" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>

                <button
                  onClick={() => handleOpenEdit(selectedTemplate)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-u-s3 hover:bg-u-line text-u-ink2 rounded-lg transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => handleUseInCompose(selectedTemplate)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-u-accent hover:bg-u-accent-strong text-u-onaccent rounded-lg shadow-sm shadow-u-accent transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Use in Compose</span>
                </button>
              </div>
            </div>

            {/* Template Body Card */}
            <div className="p-5 bg-u-s2 border border-u-line rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-u-muted">
                  Message Content & Variables
                </span>
                <span className="text-[11px] text-u-accent font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-resolves variables when inserted
                </span>
              </div>
              <div className="whitespace-pre-wrap text-xs sm:text-sm text-u-ink leading-relaxed font-sans bg-u-card p-4 rounded-xl border border-u-line">
                {selectedTemplate.body}
              </div>
            </div>

            {/* Variable Placeholders Reference Guide */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-u-ink">
                <Code className="w-4 h-4 text-u-accent" />
                <span>Available Dynamic Variable Placeholders</span>
              </div>
              <p className="text-xs text-u-muted">
                When you apply a template to an active conversation, RentPulse automatically resolves these placeholders using current tenant records, property details, and linked work orders.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {supportedVariables.map((v) => (
                  <div
                    key={v.tag}
                    className="p-2.5 rounded-xl border border-u-line bg-u-card flex items-start gap-2 shadow-2xs"
                  >
                    <code className="px-1.5 py-0.5 bg-u-accent-soft text-u-accent font-mono text-[11px] rounded font-bold shrink-0">
                      {v.tag}
                    </code>
                    <span className="text-u-ink2 text-[11px] leading-snug">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-u-muted">
            Select a template from the list.
          </div>
        )}
      </div>

      {/* Edit / Create Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-u-ink2/60 p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-u-card rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-u-line space-y-4">
            <h3 className="text-sm font-bold text-u-ink">
              {selectedTemplate ? 'Edit Message Template' : 'Create New Message Template'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-u-ink2 mb-1">Template Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Move-in Inspection Followup"
                  className="w-full p-2.5 bg-u-s2 border border-u-line rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-u-ink2 mb-1">Email / Subject Line</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="e.g. Welcome to {{PropertyName}}!"
                  className="w-full p-2.5 bg-u-s2 border border-u-line rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-u-ink2 mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as any)}
                    className="w-full p-2 bg-u-s2 border border-u-line rounded-xl"
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Rent and Payments">Rent and Payments</option>
                    <option value="Lease and Renewal">Lease and Renewal</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-u-ink2 mb-1">Intended Audience</label>
                  <select
                    value={editAudience}
                    onChange={(e) => setEditAudience(e.target.value as any)}
                    className="w-full p-2 bg-u-s2 border border-u-line rounded-xl"
                  >
                    <option value="tenants">Tenants</option>
                    <option value="owners">Owners</option>
                    <option value="vendors">Vendors</option>
                    <option value="staff">Staff</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-u-ink2 mb-1">Template Message Body</label>
                <textarea
                  rows={6}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Use {{TenantName}}, {{PropertyName}}, {{UnitNumber}} for automatic data replacement..."
                  className="w-full p-3 bg-u-s2 border border-u-line rounded-xl resize-y font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-u-line">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-u-s3 text-u-ink2 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="px-4 py-2 text-xs font-bold bg-u-accent hover:bg-u-accent-strong text-u-onaccent rounded-lg shadow-sm"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
