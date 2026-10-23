import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  MessageBubble,
} from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { RelatedRecordCard } from './RelatedRecordCard';
import { AuditLogDrawer } from './AuditLogDrawer';
import {
  Flag,
  CornerUpLeft,
  Archive,
  RotateCcw,
  UserCheck,
  CheckCircle,
  Mail,
  Lock,
  Users,
  Layers,
  History,
  MessageSquare,
} from 'lucide-react';
import { getPriorityBadge, getStatusBadge, getChannelDetails } from '../utils/formatters';
import { ConversationStatus, Priority, MessageCategory } from '../types';

interface ConversationDetailProps {
  onBackMobile?: () => void;
}

export const ConversationDetail: React.FC<ConversationDetailProps> = ({ onBackMobile }) => {
  const {
    conversations,
    selectedConversationId,
    messages,
    users,
    currentUser,
    canViewMessage,
    updateConversationStatus,
    updateConversationPriority,
    updateConversationCategory,
    assignConversation,
    archiveConversation,
    unarchiveConversation,
    toggleStar,
    markConversationUnread,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'timeline' | 'record' | 'audit'>('timeline');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [quoteBody, setQuoteBody] = useState<string>('');

  const conversation = conversations.find((c) => c.id === selectedConversationId);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-u-s2/50 text-center text-u-muted">
        <MessageSquare className="w-12 h-12 text-u-s3 mb-3" />
        <h3 className="text-base font-bold text-u-ink2">No Conversation Selected</h3>
        <p className="text-xs text-u-muted mt-1 max-w-sm">
          Select a message from the list or start a new conversation to communicate with residents, owners, or maintenance staff.
        </p>
      </div>
    );
  }

  // Filter messages for this conversation and apply privacy rules
  const convMessages = messages
    .filter((m) => m.conversationId === conversation.id)
    .filter(canViewMessage)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Participants
  const participants = conversation.participantIds
    .map((pid) => users.find((u) => u.id === pid))
    .filter(Boolean);

  const assignedStaff = users.find((u) => u.id === conversation.assignedTo);
  const priorityBadge = getPriorityBadge(conversation.priority);
  const statusBadge = getStatusBadge(conversation.status);
  const channelDetails = getChannelDetails(conversation.primaryChannel);
  const isStarred = conversation.starredBy.includes(currentUser.id);
  const isArchived = Boolean(conversation.archivedAt);

  const handleStatusChange = (newStatus: ConversationStatus) => {
    updateConversationStatus(conversation.id, newStatus);
  };

  const handlePriorityChange = (newPriority: Priority) => {
    updateConversationPriority(conversation.id, newPriority);
  };

  const handleCategoryChange = (newCat: MessageCategory) => {
    updateConversationCategory(conversation.id, newCat);
  };

  const handleConfirmAssign = () => {
    if (assigneeId) {
      assignConversation(conversation.id, assigneeId, assignmentNotes);
      setIsAssignModalOpen(false);
      setAssigneeId('');
      setAssignmentNotes('');
    }
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
    <div className="flex-1 min-w-[420px] flex flex-col h-full bg-u-card overflow-hidden relative">
      {/* Reading pane command bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-u-line bg-u-s2 shrink-0 flex-wrap">
        <button
          onClick={() => { setActiveTab('timeline'); document.getElementById('ms-reply-box')?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md text-u-accent hover:bg-u-accent-soft"
        >
          <CornerUpLeft className="w-4 h-4" /> Reply
        </button>
        {isArchived ? (
          <button onClick={() => unarchiveConversation(conversation.id)} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-u-ink2 hover:bg-u-s3" title="Move back to inbox">
            <RotateCcw className="w-4 h-4" /> Restore
          </button>
        ) : (
          <button onClick={() => archiveConversation(conversation.id)} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-u-ink2 hover:bg-u-s3" title="Archive">
            <Archive className="w-4 h-4" /> Archive
          </button>
        )}
        <button onClick={() => markConversationUnread(conversation.id)} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-u-ink2 hover:bg-u-s3" title="Mark as unread">
          <Mail className="w-4 h-4" /> Unread
        </button>
        <button onClick={() => toggleStar(conversation.id)} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-u-ink2 hover:bg-u-s3" title={isStarred ? 'Clear flag' : 'Flag'}>
          <Flag className={`w-4 h-4 ${isStarred ? 'text-u-danger fill-u-danger' : ''}`} /> {isStarred ? 'Flagged' : 'Flag'}
        </button>
        {currentUser.isStaff && (
          <button onClick={() => setIsAssignModalOpen(true)} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-u-ink2 hover:bg-u-s3">
            <UserCheck className="w-4 h-4" /> Assign
          </button>
        )}
        {currentUser.isStaff && conversation.status !== 'resolved' && (
          <button onClick={() => handleStatusChange('resolved')} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-u-ok hover:bg-u-ok-soft">
            <CheckCircle className="w-4 h-4" /> Resolve
          </button>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={() => setActiveTab('timeline')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs ${activeTab === 'timeline' ? 'bg-u-card text-u-accent font-semibold shadow-2xs' : 'text-u-ink2 hover:bg-u-s3'}`}>
            <MessageSquare className="w-3.5 h-3.5" /> Thread ({convMessages.length})
          </button>
          {conversation.relatedEntityType && (
            <button onClick={() => setActiveTab('record')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs ${activeTab === 'record' ? 'bg-u-card text-u-accent font-semibold shadow-2xs' : 'text-u-ink2 hover:bg-u-s3'}`}>
              <Layers className="w-3.5 h-3.5" /> Linked record
            </button>
          )}
          {currentUser.isStaff && (
            <button onClick={() => setActiveTab('audit')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs ${activeTab === 'audit' ? 'bg-u-card text-u-accent font-semibold shadow-2xs' : 'text-u-ink2 hover:bg-u-s3'}`}>
              <History className="w-3.5 h-3.5" /> Audit
            </button>
          )}
        </div>
      </div>

      {/* Subject + properties */}
      <div className="px-5 pt-4 pb-3 border-b border-u-line bg-u-card shrink-0 space-y-2">
        <h2 className="text-xl font-semibold text-u-ink leading-snug">{conversation.subject}</h2>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border ${channelDetails.badge}`}>
            <span>{channelDetails.icon}</span><span>{channelDetails.label}</span>
          </span>
          {conversation.visibility === 'internal_only' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-u-warn-soft text-u-warn border border-u-warn/30">
              <Lock className="w-3 h-3" /> Staff only
            </span>
          )}
          {conversation.relatedEntityRef && (
            <button onClick={() => setActiveTab('record')} className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-u-accent-soft text-u-accent border border-u-accent/30">
              <Layers className="w-3 h-3" /> {conversation.relatedEntityRef}
            </button>
          )}
          {currentUser.isStaff ? (
            <>
              <select value={conversation.status} onChange={(e) => handleStatusChange(e.target.value as any)} className={`text-[11px] font-semibold rounded px-2 py-0.5 border cursor-pointer focus:outline-none ${statusBadge.bg}`} title="Status">
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="waiting_for_reply">Waiting for reply</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select value={conversation.priority} onChange={(e) => handlePriorityChange(e.target.value as any)} className={`text-[11px] font-semibold rounded px-2 py-0.5 border cursor-pointer focus:outline-none ${priorityBadge.bg} ${priorityBadge.text}`} title="Priority">
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
              <select value={conversation.category} onChange={(e) => handleCategoryChange(e.target.value as any)} className="text-[11px] rounded px-2 py-0.5 border border-u-line bg-u-card text-u-ink2 cursor-pointer focus:outline-none" title="Category">
                {categoriesList.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </>
          ) : (
            <>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge.bg}`}>{statusBadge.label}</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityBadge.bg} ${priorityBadge.text}`}>{priorityBadge.label}</span>
            </>
          )}
        </div>
        <p className="text-[11px] text-u-muted flex items-center gap-1.5 flex-wrap">
          <Users className="w-3.5 h-3.5" />
          {participants.map((p) => p?.name).filter(Boolean).join(', ')}
          <span className="mx-1">·</span>
          Assigned to <span className="font-semibold text-u-ink2">{assignedStaff ? assignedStaff.name : 'nobody'}</span>
        </p>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-u-s2">
        {activeTab === 'timeline' && (
          <div className="space-y-3 max-w-4xl">
            {convMessages.length === 0 ? (
              <div className="p-8 text-center text-xs text-u-muted">
                No visible messages in this thread.
              </div>
            ) : (
              convMessages.map((msg) => {
                const sender = users.find((u) => u.id === msg.senderId);
                const isCurrentUser = msg.senderId === currentUser.id;
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    sender={sender}
                    isCurrentUser={isCurrentUser}
                    recipients={participants as any}
                    onQuoteReply={(text) => setQuoteBody(text)}
                  />
                );
              })
            )}
          </div>
        )}

        {activeTab === 'record' && (
          <div className="max-w-2xl mx-auto space-y-4 pt-2">
            <RelatedRecordCard
              entityType={conversation.relatedEntityType}
              entityId={conversation.relatedEntityId}
              referenceLabel={conversation.relatedEntityRef}
            />
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="max-w-2xl mx-auto pt-2">
            <AuditLogDrawer conversationId={conversation.id} />
          </div>
        )}
      </div>

      {/* Bottom Message Composer */}
      {activeTab === 'timeline' && (
        <div id="ms-reply-box" className="shrink-0"><MessageComposer
          conversation={conversation}
          initialBody={quoteBody}
          onClearInitialBody={() => setQuoteBody('')}
        /></div>
      )}

      {/* Reassign Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-u-ink2/60 p-4 animate-in fade-in">
          <div className="bg-u-card rounded-2xl max-w-md w-full p-6 shadow-2xl border border-u-line space-y-4">
            <div className="flex items-center justify-between border-b border-u-line pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-u-accent" />
                <h3 className="font-bold text-u-ink text-sm">Assign Conversation</h3>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-u-muted hover:text-u-ink2 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-u-ink2 mb-1">
                  Assign to Staff Member
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full p-2.5 bg-u-s2 border border-u-line rounded-xl text-xs text-u-ink font-medium focus:outline-none focus:ring-2 focus:ring-u-accent/60"
                >
                  <option value="">Select staff coordinator...</option>
                  {users
                    .filter((u) => u.isStaff)
                    .map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} — {staff.title}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-u-ink2 mb-1">
                  Assignment Instructions / Reason
                </label>
                <textarea
                  rows={2}
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="e.g. Please follow up on technician arrival and invoice copy..."
                  className="w-full p-2.5 bg-u-s2 border border-u-line rounded-xl text-xs text-u-ink focus:outline-none focus:ring-2 focus:ring-u-accent/60"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-u-line">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-u-s3 text-u-ink2 rounded-lg hover:bg-u-line"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!assigneeId}
                onClick={handleConfirmAssign}
                className="px-4 py-2 text-xs font-bold bg-u-accent hover:bg-u-accent-strong text-u-onaccent rounded-lg shadow-sm disabled:opacity-40"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
