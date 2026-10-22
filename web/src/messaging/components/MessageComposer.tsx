import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Conversation, ChannelType, Attachment } from '../types';
import {
  Send,
  Lock,
  Paperclip,
  BookOpen,
  Smile,
  List,
  ListOrdered,
  Bold,
  Italic,
  X,
  AlertTriangle,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { resolveTemplateVariables } from '../utils/formatters';

interface MessageComposerProps {
  conversation: Conversation;
  initialBody?: string;
  onClearInitialBody?: () => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  conversation,
  initialBody = '',
  onClearInitialBody,
}) => {
  const {
    currentUser,
    sendMessage,
    templates,
    tenants,
    properties,
    units,
    leases,
    maintenanceRequests,
    invoices,
    saveDraft,
    deleteDraft,
  } = useApp();

  const [body, setBody] = useState(initialBody || conversation.draftBody || '');
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>(conversation.primaryChannel);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [sendSuccessToast, setSendSuccessToast] = useState<string | null>(null);
  const [unresolvedWarning, setUnresolvedWarning] = useState<string[] | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync initial body if provided from outside (e.g. quote reply)
  React.useEffect(() => {
    if (initialBody) {
      setBody((prev) => (prev ? `${prev}\n\n> ${initialBody}\n` : `> ${initialBody}\n`));
      if (onClearInitialBody) onClearInitialBody();
      textareaRef.current?.focus();
    }
  }, [initialBody, onClearInitialBody]);

  // Handle Send
  const handleSend = () => {
    if (!body.trim()) return;

    sendMessage(
      conversation.id,
      body.trim(),
      isInternalNote ? 'in_app' : selectedChannel,
      isInternalNote,
      attachments
    );

    // Clear composer
    setBody('');
    setAttachments([]);
    setUnresolvedWarning(null);
    deleteDraft(conversation.id);

    // Show simulated confirmation toast
    const mode = isInternalNote
      ? 'Internal Staff Note logged'
      : `Message simulated sent via ${selectedChannel.toUpperCase()}`;
    setSendSuccessToast(mode);
    setTimeout(() => setSendSuccessToast(null), 3000);
  };

  // Handle Save Draft
  const handleSaveDraft = () => {
    if (body.trim()) {
      saveDraft(conversation.id, body.trim());
      setSendSuccessToast('Draft saved successfully');
      setTimeout(() => setSendSuccessToast(null), 2500);
    }
  };

  // Add mock file attachment
  const handleAddMockAttachment = (type: 'photo' | 'pdf' | 'doc') => {
    const mockFiles: Record<string, { filename: string; mime: string; size: number }> = {
      photo: { filename: 'inspection_site_photo.jpg', mime: 'image/jpeg', size: 1840000 },
      pdf: { filename: 'lease_addendum_doc.pdf', mime: 'application/pdf', size: 450000 },
      doc: { filename: 'maintenance_estimate_quote.docx', mime: 'application/msword', size: 310000 },
    };
    const file = mockFiles[type];
    const newAtt: Attachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      filename: file.filename,
      mimeType: file.mime,
      sizeBytes: file.size,
      uploadedBy: currentUser.id,
      uploadedAt: new Date().toISOString(),
    };
    setAttachments((prev) => [...prev, newAtt]);
  };

  // Remove attachment
  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Insert formatting tag
  const insertFormatting = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selected = body.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected.length || 4)
      );
    }, 50);
  };

  // Insert Template with intelligent variable resolution!
  const handleInsertTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;

    // Gather contextual data for variable replacement
    const tenant = tenants.find((t) => conversation.participantIds.includes(t.id));
    const property = properties.find((p) =>
      conversation.relatedEntityType === 'property'
        ? p.id === conversation.relatedEntityId
        : tenant
        ? p.id === tenant.propertyId
        : true
    );
    const unit = units.find((u) => (tenant ? u.id === tenant.unitId : true));
    const lease = leases.find((l) => (tenant ? l.id === tenant.leaseId : true));
    const maintenance = maintenanceRequests.find((m) =>
      conversation.relatedEntityType === 'maintenance' && m.id === conversation.relatedEntityId
    );
    const invoice = invoices.find((i) =>
      conversation.relatedEntityType === 'invoice' && i.id === conversation.relatedEntityId
    );

    const variablesMap: Record<string, string | number | undefined> = {
      TenantName: tenant?.name || 'Valued Resident',
      PropertyName: property?.name || 'RentPulse Community',
      UnitNumber: unit?.unitNumber || 'Unit 4B',
      LeaseEndDate: lease ? new Date(lease.endDate).toLocaleDateString() : 'March 31, 2025',
      PaymentDueDate: invoice ? new Date(invoice.dueDate).toLocaleDateString() : 'March 1, 2025',
      OutstandingBalance: tenant?.outstandingBalance !== undefined ? tenant.outstandingBalance.toFixed(2) : '0.00',
      InvoiceNumber: invoice?.invoiceNumber || 'INV-2025-089',
      MaintenanceRequestNumber: maintenance?.requestNumber || 'WO-8821',
      AppointmentDate: 'Thursday, March 6 at 11:00 AM',
      PropertyManagerName: currentUser.name || 'Alex Rivera',
    };

    const { resolvedText, unresolvedPlaceholders } = resolveTemplateVariables(
      tpl.body,
      variablesMap
    );

    setBody((prev) => (prev ? `${prev}\n\n${resolvedText}` : resolvedText));
    if (unresolvedPlaceholders.length > 0) {
      setUnresolvedWarning(unresolvedPlaceholders);
    } else {
      setUnresolvedWarning(null);
    }
    setIsTemplateDropdownOpen(false);
  };

  const channelOptions: { id: ChannelType; label: string; icon: string }[] = [
    { id: 'email', label: 'Email', icon: '✉️' },
    { id: 'sms', label: 'SMS', icon: '💬' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
    { id: 'in_app', label: 'In-App', icon: '🔔' },
  ];

  const emojis = ['👍', '👋', '🙏', '✅', '⚠️', '🔑', '🏠', '🔧', '📦', '⭐'];

  return (
    <div
      className={`border-t transition-colors ${
        isInternalNote
          ? 'bg-u-warn-soft/70 border-u-warn/30'
          : 'bg-u-card border-u-line'
      } p-3.5 space-y-3 relative`}
    >
      {/* Toast Notification */}
      {sendSuccessToast && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-u-ink2 text-u-onaccent text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 z-20 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-u-ok" />
          <span>{sendSuccessToast}</span>
        </div>
      )}

      {/* Warning for Unresolved Template Variables */}
      {unresolvedWarning && unresolvedWarning.length > 0 && (
        <div className="bg-u-warn-soft border border-u-warn/30 rounded-lg p-2.5 text-xs text-u-warn flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-u-warn shrink-0" />
            <div>
              <span className="font-bold">Template variables to review:</span>{' '}
              {unresolvedWarning.join(', ')}
            </div>
          </div>
          <button
            onClick={() => setUnresolvedWarning(null)}
            className="text-u-warn hover:text-u-warn font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Top Controls: Channel selector & Internal Note toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        {/* Channel Selection Buttons */}
        <div className="flex items-center gap-1 bg-u-s3 p-1 rounded-lg">
          {channelOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={isInternalNote}
              onClick={() => setSelectedChannel(opt.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                selectedChannel === opt.id && !isInternalNote
                  ? 'bg-u-card text-u-accent shadow-2xs font-bold'
                  : 'text-u-ink2 hover:text-u-ink disabled:opacity-40'
              }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Staff Only: Internal Note Toggle */}
        {currentUser.isStaff && (
          <label className="flex items-center gap-2 cursor-pointer select-none px-2 py-1 rounded-lg hover:bg-u-s3 transition-colors">
            <input
              type="checkbox"
              checked={isInternalNote}
              onChange={(e) => setIsInternalNote(e.target.checked)}
              className="rounded text-u-warn focus:ring-u-warn/60 w-3.5 h-3.5 accent-u-warn"
            />
            <span
              className={`flex items-center gap-1 text-[11px] font-bold ${
                isInternalNote ? 'text-u-warn' : 'text-u-ink2'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-u-warn" />
              <span>Internal Staff Note (Confidential)</span>
            </span>
          </label>
        )}
      </div>

      {/* Internal Note Banner Warning */}
      {isInternalNote && (
        <div className="p-2 bg-u-warn-soft/80 border border-u-warn/30 rounded-lg text-[11px] text-u-warn flex items-center gap-2">
          <Lock className="w-4 h-4 text-u-warn shrink-0" />
          <span>
            <strong>Staff Only Note:</strong> This entry will be permanently hidden from the tenant and vendors. Visible only to management personnel.
          </span>
        </div>
      )}

      {/* Formatting & Helper Toolbar */}
      <div className="flex items-center justify-between border-b border-u-line/80 pb-2 text-u-muted">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => insertFormatting('**', '**')}
            title="Bold"
            className="p-1.5 hover:bg-u-s3 rounded text-u-ink2"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('*', '*')}
            title="Italic"
            className="p-1.5 hover:bg-u-s3 rounded text-u-ink2"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('\n- ')}
            title="Bulleted List"
            className="p-1.5 hover:bg-u-s3 rounded text-u-ink2"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('\n1. ')}
            title="Numbered List"
            className="p-1.5 hover:bg-u-s3 rounded text-u-ink2"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          {/* Quick Emoji Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
              title="Insert Emoji"
              className="p-1.5 hover:bg-u-s3 rounded text-u-ink2"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {isEmojiPickerOpen && (
              <div className="absolute left-0 bottom-full mb-1 bg-u-card border border-u-line rounded-xl p-2 shadow-xl flex gap-1 z-30">
                {emojis.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      setBody((prev) => prev + em);
                      setIsEmojiPickerOpen(false);
                    }}
                    className="p-1.5 hover:bg-u-s3 rounded text-base"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right helper tools: Template Inserter & Attachments */}
        <div className="flex items-center gap-2">
          {/* Insert Template Button */}
          {currentUser.isStaff && !isInternalNote && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-u-accent-soft text-u-accent rounded-md hover:bg-u-accent-soft transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Insert Template</span>
              </button>

              {isTemplateDropdownOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-72 bg-u-card rounded-xl shadow-xl border border-u-line py-2 z-40 max-h-64 overflow-y-auto">
                  <div className="px-3 py-1.5 border-b border-u-line">
                    <p className="text-[11px] font-bold text-u-muted uppercase">
                      Select Reusable Template
                    </p>
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
          )}

          {/* Attach file dropdown */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleAddMockAttachment('photo')}
              title="Attach photo"
              className="text-xs text-u-muted hover:text-u-ink p-1 rounded hover:bg-u-s3 flex items-center gap-1"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Attach</span>
            </button>
          </div>
        </div>
      </div>

      {/* Attachment Chips */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {attachments.map((att) => (
            <span
              key={att.id}
              className="inline-flex items-center gap-1.5 bg-u-s3 border border-u-line text-u-ink2 text-xs px-2.5 py-1 rounded-full"
            >
              <Paperclip className="w-3 h-3 text-u-muted" />
              <span className="font-medium text-[11px]">{att.filename}</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="text-u-muted hover:text-u-danger font-bold ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          isInternalNote
            ? 'Write internal staff note here (e.g. contractor quotation approved, follow-up needed on deposit balance)...'
            : `Write your reply to ${conversation.subject} via ${selectedChannel.toUpperCase()}...`
        }
        className={`w-full p-3 text-xs sm:text-sm rounded-xl border focus:outline-none focus:ring-2 resize-y transition-all ${
          isInternalNote
            ? 'bg-u-warn-soft/50 border-u-warn/30 text-u-warn focus:ring-u-warn/30 focus:border-u-warn/60'
            : 'bg-u-s2/60 border-u-line text-u-ink focus:bg-u-card focus:ring-u-accent/20 focus:border-u-accent/60'
        }`}
      />

      {/* Bottom Send & Draft Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="flex items-center gap-1 text-xs text-u-muted hover:text-u-ink font-medium px-2 py-1 rounded hover:bg-u-s3 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!body.trim()}
            onClick={handleSend}
            className={`flex items-center gap-2 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              isInternalNote
                ? 'bg-u-warn hover:bg-u-warn text-u-onaccent shadow-u-warn'
                : 'bg-u-accent hover:bg-u-accent-strong text-u-onaccent shadow-u-accent'
            }`}
          >
            {isInternalNote ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Log Internal Note</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send via {selectedChannel.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
