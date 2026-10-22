import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  MessageCategory,
  Priority,
  ChannelType,
  Visibility,
  RelatedEntityType,
  Attachment,
} from '../types';
import {
  X,
  Send,
  Paperclip,
  BookOpen,
  AlertCircle,
  Users,
  Layers,
  Save,
} from 'lucide-react';
import { resolveTemplateVariables } from '../utils/formatters';

export const ComposeModal: React.FC = () => {
  const {
    isComposeOpen,
    closeComposeModal,
    composeInitialData,
    currentUser,
    users,
    properties,
    leases,
    maintenanceRequests,
    invoices,
    templates,
    createConversation,
  } = useApp();

  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<MessageCategory>('General Inquiry');
  const [priority, setPriority] = useState<Priority>('normal');
  const [primaryChannel, setPrimaryChannel] = useState<ChannelType>('email');
  const [visibility, setVisibility] = useState<Visibility>('external');
  const [body, setBody] = useState('');
  const [relatedEntityType, setRelatedEntityType] = useState<RelatedEntityType | ''>('');
  const [relatedEntityId, setRelatedEntityId] = useState('');
  const [relatedEntityRef, setRelatedEntityRef] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Pre-fill if opened with context
  useEffect(() => {
    if (composeInitialData) {
      if (composeInitialData.recipientIds) setSelectedRecipientIds(composeInitialData.recipientIds);
      if (composeInitialData.subject) setSubject(composeInitialData.subject);
      if (composeInitialData.category) setCategory(composeInitialData.category);
      if (composeInitialData.priority) setPriority(composeInitialData.priority);
      if (composeInitialData.channel) setPrimaryChannel(composeInitialData.channel);
      if (composeInitialData.visibility) setVisibility(composeInitialData.visibility);
      if (composeInitialData.body) setBody(composeInitialData.body);
      if (composeInitialData.relatedEntityType) {
        setRelatedEntityType(composeInitialData.relatedEntityType);
        setRelatedEntityId(composeInitialData.relatedEntityId || '');
        setRelatedEntityRef(composeInitialData.relatedEntityRef || '');
      }
    } else {
      // Default reset
      setSelectedRecipientIds([]);
      setSubject('');
      setCategory('General Inquiry');
      setPriority('normal');
      setPrimaryChannel('email');
      setVisibility('external');
      setBody('');
      setRelatedEntityType('');
      setRelatedEntityId('');
      setRelatedEntityRef('');
      setAttachments([]);
      setValidationError(null);
      setShowPreview(false);
    }
  }, [composeInitialData, isComposeOpen]);

  if (!isComposeOpen) return null;

  // Filter possible recipients:
  // If current user is tenant, can only message staff
  // If current user is vendor, can only message staff
  // If staff, can message anyone
  const availableRecipients = users.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (!currentUser.isStaff) return u.isStaff;
    return true;
  });

  const handleToggleRecipient = (uid: string) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleAddMockFile = () => {
    const newAtt: Attachment = {
      id: `att_${Date.now()}`,
      filename: `document_${Math.floor(Math.random() * 900 + 100)}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 320000,
      uploadedBy: currentUser.id,
      uploadedAt: new Date().toISOString(),
    };
    setAttachments((prev) => [...prev, newAtt]);
  };

  const handleInsertTemplate = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;

    // Pick first recipient if any
    const firstRecipient = users.find((u) => u.id === selectedRecipientIds[0]);

    const vars: Record<string, string | number | undefined> = {
      TenantName: firstRecipient?.name || 'Resident',
      PropertyName: 'Highland Towers',
      UnitNumber: 'Unit 4B',
      LeaseEndDate: 'March 31, 2025',
      PaymentDueDate: 'March 1, 2025',
      OutstandingBalance: '75.00',
      InvoiceNumber: 'INV-2025-089',
      MaintenanceRequestNumber: 'WO-8821',
      AppointmentDate: 'Thursday, March 6 at 11:00 AM',
      PropertyManagerName: currentUser.name,
    };

    const { resolvedText } = resolveTemplateVariables(tpl.body, vars);
    setSubject(tpl.subject);
    setBody(resolvedText);
    setCategory(tpl.category);
    setIsTemplatePickerOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRecipientIds.length === 0) {
      setValidationError('Please select at least one recipient.');
      return;
    }
    if (!subject.trim()) {
      setValidationError('Conversation subject is required.');
      return;
    }
    if (!body.trim()) {
      setValidationError('Message body cannot be empty.');
      return;
    }

    createConversation({
      subject: subject.trim(),
      category,
      priority,
      visibility,
      primaryChannel,
      participantIds: selectedRecipientIds,
      body: body.trim(),
      attachments,
      relatedEntityType: relatedEntityType || undefined,
      relatedEntityId: relatedEntityId || undefined,
      relatedEntityRef: relatedEntityRef || undefined,
    });

    closeComposeModal();
  };

  const categoriesList: MessageCategory[] = [
    'General Inquiry',
    'Maintenance',
    'Lease and Renewal',
    'Rent and Payments',
    'Invoice and Charges',
    'Deposit and Refund',
    'Inspection',
    'Property Announcement',
    'Complaint',
    'Document Request',
    'Vendor Coordination',
    'Internal Discussion',
    'Other',
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-u-ink2/60 p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-u-card rounded-2xl max-w-2xl w-full shadow-2xl border border-u-line overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-u-line flex items-center justify-between bg-u-s2/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-u-accent text-u-onaccent flex items-center justify-center font-bold text-sm">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-u-ink text-sm">Compose New Conversation</h3>
              <p className="text-[11px] text-u-muted">
                Multi-channel communication with residents, staff, and contractors
              </p>
            </div>
          </div>
          <button
            onClick={closeComposeModal}
            className="text-u-muted hover:text-u-ink2 text-xl font-bold p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {validationError && (
            <div className="p-3 bg-u-danger-soft border border-u-danger/30 rounded-xl text-xs text-u-danger flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Recipients Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-u-ink2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-u-muted" />
                <span>Authorized Recipients *</span>
              </label>
              <span className="text-[11px] text-u-muted">
                {selectedRecipientIds.length} selected
              </span>
            </div>

            {/* Recipient Picker Chips */}
            <div className="p-2 border border-u-line rounded-xl bg-u-s2/60 max-h-36 overflow-y-auto flex flex-wrap gap-1.5">
              {availableRecipients.map((user) => {
                const isSelected = selectedRecipientIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleToggleRecipient(user.id)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                      isSelected
                        ? 'bg-u-accent text-u-onaccent border-u-accent/60 font-bold shadow-2xs'
                        : 'bg-u-card text-u-ink2 border-u-line hover:border-u-line2'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
                      {user.name[0]}
                    </span>
                    <span>{user.name}</span>
                    <span className="text-[10px] opacity-75">
                      ({user.role.replace('_', ' ')})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject & Channel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-u-ink2">Subject *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. March Rent Payment Confirmation or Sink Repair Update"
                className="w-full p-2.5 bg-u-card border border-u-line rounded-xl text-xs text-u-ink focus:outline-none focus:ring-2 focus:ring-u-accent/60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-u-ink2">Delivery Channel</label>
              <select
                value={primaryChannel}
                onChange={(e) => setPrimaryChannel(e.target.value as any)}
                className="w-full p-2.5 bg-u-card border border-u-line rounded-xl text-xs text-u-ink focus:outline-none focus:ring-2 focus:ring-u-accent/60"
              >
                <option value="email">✉️ Email (Official)</option>
                <option value="sms">💬 SMS (Mobile Text)</option>
                <option value="whatsapp">📱 WhatsApp</option>
                <option value="in_app">🔔 In-App Portal</option>
              </select>
            </div>
          </div>

          {/* Category, Priority & Visibility */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-u-ink2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full p-2 bg-u-card border border-u-line rounded-xl text-xs text-u-ink focus:outline-none focus:ring-2 focus:ring-u-accent/60"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-u-ink2">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full p-2 bg-u-card border border-u-line rounded-xl text-xs text-u-ink focus:outline-none focus:ring-2 focus:ring-u-accent/60"
              >
                <option value="low">Low (Standard)</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent (Immediate SLA)</option>
              </select>
            </div>

            {currentUser.isStaff && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-u-ink2">Thread Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-full p-2 bg-u-card border border-u-line rounded-xl text-xs text-u-ink focus:outline-none focus:ring-2 focus:ring-u-accent/60"
                >
                  <option value="external">External (Visible to Participants)</option>
                  <option value="internal_only">🔒 Internal (Staff Only)</option>
                </select>
              </div>
            )}
          </div>

          {/* Optional Linked Record */}
          <div className="p-3 bg-u-s2 border border-u-line rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-u-ink2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-u-accent" />
                <span>Link Rental Record (Optional Context)</span>
              </span>
              <span className="text-[10px] text-u-muted">Attach Work Order, Invoice, or Lease</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <select
                value={relatedEntityType}
                onChange={(e) => {
                  const val = e.target.value as RelatedEntityType | '';
                  setRelatedEntityType(val);
                  setRelatedEntityId('');
                  setRelatedEntityRef('');
                }}
                className="p-2 bg-u-card border border-u-line rounded-lg text-u-ink2 focus:outline-none"
              >
                <option value="">No linked record</option>
                <option value="property">Property</option>
                <option value="lease">Lease Agreement</option>
                <option value="maintenance">Maintenance Work Order</option>
                <option value="invoice">Invoice / Charge</option>
              </select>

              {/* Entity Picker depending on selection */}
              {relatedEntityType === 'maintenance' && (
                <select
                  value={relatedEntityId}
                  onChange={(e) => {
                    setRelatedEntityId(e.target.value);
                    const wo = maintenanceRequests.find((m) => m.id === e.target.value);
                    setRelatedEntityRef(wo ? wo.requestNumber : '');
                  }}
                  className="p-2 bg-u-card border border-u-line rounded-lg text-u-ink2 focus:outline-none"
                >
                  <option value="">Select Work Order...</option>
                  {maintenanceRequests.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.requestNumber} — {m.title}
                    </option>
                  ))}
                </select>
              )}

              {relatedEntityType === 'invoice' && (
                <select
                  value={relatedEntityId}
                  onChange={(e) => {
                    setRelatedEntityId(e.target.value);
                    const inv = invoices.find((i) => i.id === e.target.value);
                    setRelatedEntityRef(inv ? inv.invoiceNumber : '');
                  }}
                  className="p-2 bg-u-card border border-u-line rounded-lg text-u-ink2 focus:outline-none"
                >
                  <option value="">Select Invoice...</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — ${inv.amount} ({inv.description})
                    </option>
                  ))}
                </select>
              )}

              {relatedEntityType === 'lease' && (
                <select
                  value={relatedEntityId}
                  onChange={(e) => {
                    setRelatedEntityId(e.target.value);
                    const l = leases.find((item) => item.id === e.target.value);
                    setRelatedEntityRef(l ? l.leaseNumber : '');
                  }}
                  className="p-2 bg-u-card border border-u-line rounded-lg text-u-ink2 focus:outline-none"
                >
                  <option value="">Select Lease...</option>
                  {leases.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.leaseNumber} (${l.monthlyRent}/mo)
                    </option>
                  ))}
                </select>
              )}

              {relatedEntityType === 'property' && (
                <select
                  value={relatedEntityId}
                  onChange={(e) => {
                    setRelatedEntityId(e.target.value);
                    const p = properties.find((item) => item.id === e.target.value);
                    setRelatedEntityRef(p ? p.name : '');
                  }}
                  className="p-2 bg-u-card border border-u-line rounded-lg text-u-ink2 focus:outline-none"
                >
                  <option value="">Select Property...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.address})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Template helper button & preview toggle */}
          <div className="flex items-center justify-between pt-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsTemplatePickerOpen(!isTemplatePickerOpen)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-u-accent-soft text-u-accent rounded-lg hover:bg-u-accent-soft transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Apply Reusable Template</span>
              </button>

              {isTemplatePickerOpen && (
                <div className="absolute left-0 bottom-full mb-2 w-72 bg-u-card rounded-xl shadow-xl border border-u-line py-2 z-40 max-h-56 overflow-y-auto">
                  <div className="px-3 py-1 border-b border-u-line text-[10px] font-bold text-u-muted uppercase">
                    Choose Template
                  </div>
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleInsertTemplate(tpl.id)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-u-s2 transition-colors border-b border-u-line"
                    >
                      <p className="font-semibold text-u-ink">{tpl.name}</p>
                      <p className="text-[10px] text-u-muted">{tpl.category}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs font-semibold text-u-muted hover:text-u-ink"
            >
              {showPreview ? 'Edit Message' : 'Preview Message'}
            </button>
          </div>

          {/* Message Body or Preview */}
          {showPreview ? (
            <div className="p-4 bg-u-s2 border border-u-line rounded-xl space-y-2 text-xs">
              <p className="text-[10px] uppercase font-bold text-u-muted">Message Preview</p>
              <div className="whitespace-pre-wrap font-sans text-u-ink">{body || 'No text'}</div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-bold text-u-ink2">Message Content *</label>
              <textarea
                required
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message here. Line breaks and bullet formatting supported..."
                className="w-full p-3 bg-u-card border border-u-line rounded-xl text-xs sm:text-sm text-u-ink focus:outline-none focus:ring-2 focus:ring-u-accent/60 resize-y"
              />
            </div>
          )}

          {/* Mock Attachments */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-u-line">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddMockFile}
                className="flex items-center gap-1 text-u-muted hover:text-u-ink px-2 py-1 rounded bg-u-s3 hover:bg-u-line font-medium text-xs transition-colors"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Attach Mock PDF</span>
              </button>

              {attachments.length > 0 && (
                <span className="text-[11px] text-u-muted">
                  {attachments.length} file attached
                </span>
              )}
            </div>

            <span className="text-[11px] text-u-muted italic">
              Simulated {primaryChannel.toUpperCase()} Gateway
            </span>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 border-t border-u-line bg-u-s2 flex items-center justify-between">
          <button
            type="button"
            onClick={closeComposeModal}
            className="px-4 py-2 text-xs font-semibold text-u-ink2 hover:text-u-ink bg-u-card border border-u-line rounded-xl hover:bg-u-s3 transition-colors"
          >
            Discard
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                alert('Draft saved to session state');
                closeComposeModal();
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-u-ink2 bg-u-card border border-u-line rounded-xl hover:bg-u-s3 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-u-onaccent bg-u-accent hover:bg-u-accent-strong rounded-xl shadow-sm shadow-u-accent transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Message</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
