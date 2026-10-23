import { isSupabaseConfigured } from '../../lib/supabase';
import React, { useState } from 'react';
import { Message, User } from '../types';
import { formatFileSize, getRoleBadge, getChannelDetails } from '../utils/formatters';
import { FileText, Image, Download, Eye, Lock, Check, CheckCheck, Copy, CornerUpLeft } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  sender?: User;
  isCurrentUser: boolean;
  recipients?: User[];
  onQuoteReply?: (text: string) => void;
}

/** One message in a thread, laid out like an email in a reading pane (not a chat bubble). */
export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, sender, isCurrentUser, recipients = [], onQuoteReply }) => {
  const [copied, setCopied] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);

  const roleBadge = sender ? getRoleBadge(sender.role) : null;
  const channel = getChannelDetails(message.channel);
  const isInternal = message.isInternalNote;
  const initials = sender?.name ? sender.name.split(' ').map((n) => n[0]).slice(0, 2).join('') : 'U';
  const when = new Date(message.createdAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const to = recipients.filter((r) => r.id !== message.senderId).map((r) => r.name);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className={`rounded-lg border ${isInternal ? 'border-u-warn/40 bg-u-warn-soft' : 'border-u-line bg-u-card'}`}>
      {isInternal && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-u-warn/30 text-[11px] font-semibold text-u-warn">
          <Lock className="w-3.5 h-3.5" />
          <span>Internal staff note. Hidden from tenants and vendors.</span>
        </div>
      )}

      {/* Mail header: avatar, From, To, date */}
      <header className="flex items-start gap-3 px-4 pt-3.5">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${isInternal ? 'bg-u-warn text-u-onaccent' : isCurrentUser ? 'bg-u-accent text-u-onaccent' : 'bg-u-accent-soft text-u-accent'}`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-u-ink">{isCurrentUser ? `${sender?.name ?? 'You'} (you)` : sender?.name || 'Unknown user'}</span>
                {roleBadge && <span className={`px-1.5 rounded text-[10px] font-semibold border ${roleBadge.bg} ${roleBadge.text}`}>{roleBadge.label}</span>}
                <span className="text-[11px] text-u-muted" title={`Sent via ${channel.label}`}>{channel.icon} {channel.label}</span>
              </div>
              {to.length > 0 && <p className="text-[11px] text-u-muted truncate">To: {to.join(', ')}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0 text-u-muted">
              <span className="text-[11px] mr-1">{when}</span>
              {onQuoteReply && (
                <button type="button" onClick={() => onQuoteReply(message.body)} title="Reply with quote" className="p-1 rounded hover:bg-u-s3 hover:text-u-ink">
                  <CornerUpLeft className="w-3.5 h-3.5" />
                </button>
              )}
              <button type="button" onClick={handleCopy} title="Copy text" className="p-1 rounded hover:bg-u-s3 hover:text-u-ink">
                {copied ? <Check className="w-3.5 h-3.5 text-u-ok" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="px-4 pb-3 pt-3 pl-[68px] text-sm text-u-ink whitespace-pre-wrap leading-relaxed">{message.body}</div>

      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="px-4 pb-3 pl-[68px] flex flex-wrap gap-2">
          {message.attachments.map((att) => {
            const isImg = att.mimeType.startsWith('image/');
            return (
              <div key={att.id} className="flex items-center gap-2 border border-u-line bg-u-s2 rounded-md pl-2.5 pr-1 py-1.5 text-xs max-w-[260px]">
                {isImg ? <Image className="w-4 h-4 shrink-0 text-u-warn" /> : <FileText className="w-4 h-4 shrink-0 text-u-accent" />}
                <div className="min-w-0">
                  <p className="font-medium truncate text-[11px] text-u-ink">{att.filename}</p>
                  <p className="text-[10px] text-u-muted">{formatFileSize(att.sizeBytes)}</p>
                </div>
                <button type="button" onClick={() => (att.mockUrl ? window.open(att.mockUrl, '_blank', 'noopener') : setPreviewAttachment(att.filename))} title="Preview" className="p-1 rounded text-u-muted hover:bg-u-s3">
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => (att.mockUrl ? window.open(att.mockUrl, '_blank', 'noopener') : alert(`Mock downloading attachment: ${att.filename} (${formatFileSize(att.sizeBytes)})`))} title="Download" className="p-1 rounded text-u-muted hover:bg-u-s3">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <footer className="px-4 pb-2.5 pl-[68px] text-[10px] text-u-muted flex items-center gap-1">
        {isInternal ? (
          <span className="text-u-warn">Logged to internal operations</span>
        ) : (
          <>
            <CheckCheck className="w-3 h-3 text-u-ok" />
            <span>{isSupabaseConfigured ? 'Recorded' : 'Delivered (simulated)'}</span>
          </>
        )}
      </footer>

      {previewAttachment && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-u-ink2/60 p-4">
          <div className="bg-u-card rounded-xl max-w-lg w-full p-6 shadow-2xl border border-u-line space-y-4">
            <div className="flex items-center justify-between border-b border-u-line pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-u-accent" />
                <h4 className="font-semibold text-u-ink text-sm truncate">{previewAttachment}</h4>
              </div>
              <button onClick={() => setPreviewAttachment(null)} className="text-u-muted hover:text-u-ink2 text-xl font-bold">&times;</button>
            </div>
            <div className="bg-u-s2 border border-u-line rounded-lg p-8 text-center space-y-2">
              <FileText className="w-12 h-12 text-u-muted mx-auto" />
              <p className="font-semibold text-u-ink2 text-xs">Simulated file viewer</p>
              <p className="text-[11px] text-u-muted">"{previewAttachment}" was verified and virus-scanned in the mock storage sandbox.</p>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setPreviewAttachment(null)} className="px-4 py-2 text-xs font-semibold bg-u-s3 text-u-ink2 rounded-lg hover:bg-u-line">Close</button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
