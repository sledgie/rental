import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowUpDown,
  Paperclip,
  Lock,
  CheckSquare,
  Square,
  Archive,
  MailCheck,
  X,
  Inbox,
  SlidersHorizontal,
  AlertCircle,
  Flag,
} from 'lucide-react';
import {
  getChannelDetails,
} from '../utils/formatters';
import { MessageCategory, Priority } from '../types';

export const ConversationList: React.FC = () => {
  const {
    conversations,
    messages,
    users,
    currentUser,
    activeFolder,
    activeChannelFilter,
    selectedConversationId,
    setSelectedConversationId,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    priorityFilter,
    setPriorityFilter,
    statusFilter,
    setStatusFilter,
    assignedFilter,
    setAssignedFilter,
    sortBy,
    setSortBy,
    selectedConversationIds,
    toggleSelectConversation,
    selectAllConversations,
    clearSelectedConversations,
    bulkMarkAsRead,
    bulkArchive,
    toggleStar,
    markConversationRead,
    canAccessConversation,
    readTracker,
    openComposeModal,
  } = useApp();

  const [showFilters, setShowFilters] = useState(false);

  // 1. Filter conversations by activeFolder
  const folderFiltered = useMemo(() => {
    return conversations.filter((conv) => {
      // General authorization check
      if (!canAccessConversation(conv)) return false;

      switch (activeFolder) {
        case 'inbox':
          return !conv.archivedAt;
        case 'unread':
          return !conv.archivedAt && readTracker[conv.id] === false;
        case 'sent':
          return conv.createdBy === currentUser.id && !conv.archivedAt;
        case 'assigned':
          return conv.assignedTo === currentUser.id && !conv.archivedAt;
        case 'internal':
          return conv.visibility === 'internal_only' && !conv.archivedAt;
        case 'drafts':
          return Boolean(conv.draftBody) && !conv.archivedAt;
        case 'archived':
          return Boolean(conv.archivedAt);
        default:
          return !conv.archivedAt;
      }
    });
  }, [conversations, canAccessConversation, activeFolder, currentUser.id, readTracker]);

  // 2. Filter by activeChannelFilter
  const channelFiltered = useMemo(() => {
    if (activeChannelFilter === 'all') return folderFiltered;
    return folderFiltered.filter((conv) => conv.primaryChannel === activeChannelFilter);
  }, [folderFiltered, activeChannelFilter]);

  // 3. Search & additional filter queries
  const fullyFiltered = useMemo(() => {
    return channelFiltered.filter((conv) => {
      // Category filter
      if (categoryFilter && conv.category !== categoryFilter) return false;

      // Priority filter
      if (priorityFilter && conv.priority !== priorityFilter) return false;

      // Status filter
      if (statusFilter && conv.status !== statusFilter) return false;

      // Assigned filter
      if (assignedFilter && conv.assignedTo !== assignedFilter) return false;

      // Search query (subject, preview, participants, linked ref)
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const subjectMatch = conv.subject.toLowerCase().includes(q);
        const refMatch = conv.relatedEntityRef?.toLowerCase().includes(q) || false;
        const categoryMatch = conv.category.toLowerCase().includes(q);

        // Check participant names
        const participantMatch = conv.participantIds.some((pid) => {
          const u = users.find((user) => user.id === pid);
          return u?.name.toLowerCase().includes(q) || u?.companyOrUnit?.toLowerCase().includes(q);
        });

        // Check messages body
        const messageMatch = messages.some(
          (m) => m.conversationId === conv.id && m.body.toLowerCase().includes(q)
        );

        if (!subjectMatch && !refMatch && !categoryMatch && !participantMatch && !messageMatch) {
          return false;
        }
      }

      return true;
    });
  }, [channelFiltered, categoryFilter, priorityFilter, statusFilter, assignedFilter, searchQuery, users, messages]);

  // 4. Sort conversations
  const sortedConversations = useMemo(() => {
    return [...fullyFiltered].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      if (sortBy === 'priority') {
        const priorityRank: Record<Priority, number> = { urgent: 4, high: 3, normal: 2, low: 1 };
        return priorityRank[b.priority] - priorityRank[a.priority];
      }
      if (sortBy === 'status') {
        return a.status.localeCompare(b.status);
      }
      return 0;
    });
  }, [fullyFiltered, sortBy]);

  // Helper to get latest message for a conversation
  const getLatestMessage = (convId: string) => {
    const convMsgs = messages.filter((m) => m.conversationId === convId);
    if (convMsgs.length === 0) return null;
    return convMsgs[convMsgs.length - 1];
  };

  // Helper to check if any message has attachments
  const hasAttachments = (convId: string) => {
    return messages.some((m) => m.conversationId === convId && m.attachments.length > 0);
  };

  const hasActiveFilters = Boolean(
    categoryFilter || priorityFilter || statusFilter || assignedFilter || searchQuery
  );

  const clearAllFilters = () => {
    setCategoryFilter('');
    setPriorityFilter('');
    setStatusFilter('');
    setAssignedFilter('');
    setSearchQuery('');
  };

  const isAllSelected =
    sortedConversations.length > 0 &&
    sortedConversations.every((c) => selectedConversationIds.includes(c.id));

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      clearSelectedConversations();
    } else {
      selectAllConversations(sortedConversations.map((c) => c.id));
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

  const FOLDER_TITLES: Record<string, string> = {
    inbox: 'Inbox',
    unread: 'Unread',
    sent: 'Sent Items',
    assigned: 'Assigned to me',
    internal: 'Internal staff',
    drafts: 'Drafts',
    archived: 'Archive',
  };

  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOf(today) - startOf(d)) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };
  const timeLabel = (iso: string) => {
    const d = new Date(iso);
    const sameDay = new Date().toDateString() === d.toDateString();
    return sameDay ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const groupByDay = sortBy === 'newest' || sortBy === 'oldest';
  const initials = (name?: string) => (name ? name.split(' ').map((n) => n[0]).slice(0, 2).join('') : 'U');

  return (
    <div className="w-[380px] shrink-0 bg-u-card border-r border-u-line flex flex-col h-full">
      {/* Folder title + sort/filter (Outlook list header) */}
      <div className="px-4 pt-3 pb-2 border-b border-u-line space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h3 className="text-base font-semibold text-u-ink">{FOLDER_TITLES[activeFolder] ?? 'Inbox'}</h3>
            <span className="text-[11px] text-u-muted">{sortedConversations.length} items</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${
                showFilters || hasActiveFilters ? 'bg-u-accent-soft text-u-accent' : 'text-u-ink2 hover:bg-u-s3'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter{hasActiveFilters ? ' •' : ''}
            </button>
            <div className="flex items-center gap-1 text-u-ink2">
              <ArrowUpDown className="w-3 h-3 text-u-muted" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-[11px] font-semibold bg-transparent text-u-ink2 focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="priority">Priority</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="flex items-center gap-1.5 flex-wrap pb-1">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="text-[11px] bg-u-card border border-u-line rounded-md px-2 py-1 text-u-ink2 cursor-pointer">
              <option value="">All categories</option>
              {categoriesList.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="text-[11px] bg-u-card border border-u-line rounded-md px-2 py-1 text-u-ink2 cursor-pointer">
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-[11px] bg-u-card border border-u-line rounded-md px-2 py-1 text-u-ink2 cursor-pointer">
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="waiting_for_reply">Waiting for reply</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            {currentUser.isStaff && (
              <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)} className="text-[11px] bg-u-card border border-u-line rounded-md px-2 py-1 text-u-ink2 cursor-pointer">
                <option value="">All staff</option>
                {users.filter((u) => u.isStaff).map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
              </select>
            )}
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="text-[11px] font-semibold text-u-danger px-2 py-1 flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        )}

        {/* Select all + bulk actions */}
        <div className="flex items-center justify-between text-xs">
          <button onClick={handleSelectAllToggle} className="text-u-muted hover:text-u-ink2 flex items-center gap-1.5 text-[11px] font-medium" title="Select all">
            {isAllSelected ? <CheckSquare className="w-3.5 h-3.5 text-u-accent" /> : <Square className="w-3.5 h-3.5" />}
            <span>{selectedConversationIds.length > 0 ? `${selectedConversationIds.length} selected` : 'Select all'}</span>
          </button>
          {selectedConversationIds.length > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={bulkMarkAsRead} className="px-2 py-1 text-[11px] font-semibold text-u-ink2 rounded hover:bg-u-s3 flex items-center gap-1">
                <MailCheck className="w-3 h-3" /> Mark read
              </button>
              <button onClick={bulkArchive} className="px-2 py-1 text-[11px] font-semibold text-u-ink2 rounded hover:bg-u-s3 flex items-center gap-1">
                <Archive className="w-3 h-3" /> Archive
              </button>
              <button onClick={clearSelectedConversations} className="p-1 text-u-muted hover:text-u-ink2">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Message rows */}
      <div className="flex-1 overflow-y-auto">
        {sortedConversations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-u-muted space-y-3">
            <Inbox className="w-10 h-10 stroke-[1.2]" />
            <div>
              <p className="text-sm font-semibold text-u-ink2">{hasActiveFilters ? 'No matching messages' : 'Nothing here'}</p>
              <p className="text-xs mt-1">
                {hasActiveFilters ? 'Nothing matches your search or filters.' : `Your ${FOLDER_TITLES[activeFolder] ?? activeFolder} folder is empty.`}
              </p>
            </div>
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="text-xs font-semibold text-u-accent underline underline-offset-2">Clear filters</button>
            )}
          </div>
        ) : (
          sortedConversations.map((conv, index) => {
            const isSelected = selectedConversationId === conv.id;
            const isChecked = selectedConversationIds.includes(conv.id);
            const isUnread = readTracker[conv.id] === false;
            const isStarred = conv.starredBy.includes(currentUser.id);
            const channelBadge = getChannelDetails(conv.primaryChannel);
            const latestMsg = getLatestMessage(conv.id);
            const withAttachments = hasAttachments(conv.id);
            const otherParticipantIds = conv.participantIds.filter((id) => id !== currentUser.id);
            const primaryOtherUser = users.find((u) => u.id === (otherParticipantIds[0] || conv.createdBy));
            const assignedStaffUser = users.find((u) => u.id === conv.assignedTo);
            const header = groupByDay && (index === 0 || dayLabel(sortedConversations[index - 1].updatedAt) !== dayLabel(conv.updatedAt)) ? dayLabel(conv.updatedAt) : null;

            return (
              <React.Fragment key={conv.id}>
                {header && (
                  <div className="px-4 py-1.5 text-[11px] font-semibold text-u-ink2 bg-u-s2 border-y border-u-line sticky top-0 z-10">{header}</div>
                )}
                <div
                  onClick={() => {
                    setSelectedConversationId(conv.id);
                    markConversationRead(conv.id);
                  }}
                  className={`group relative flex gap-3 pl-4 pr-3 py-2.5 cursor-pointer border-b border-u-line/70 border-l-[3px] ${
                    isSelected ? 'bg-u-accent-soft border-l-u-accent' : 'border-l-transparent hover:bg-u-s2'
                  }`}
                >
                  {/* Avatar / checkbox */}
                  <div className="shrink-0 w-8 pt-0.5">
                    {isChecked || selectedConversationIds.length > 0 ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelectConversation(conv.id); }} className="w-8 h-8 flex items-center justify-center">
                        {isChecked ? <CheckSquare className="w-4 h-4 text-u-accent" /> : <Square className="w-4 h-4 text-u-muted" />}
                      </button>
                    ) : (
                      <>
                        <div className="group-hover:hidden w-8 h-8 rounded-full bg-u-accent-soft text-u-accent font-semibold text-[11px] flex items-center justify-center">
                          {initials(primaryOtherUser?.name)}
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelectConversation(conv.id); }} className="hidden group-hover:flex w-8 h-8 items-center justify-center">
                          <Square className="w-4 h-4 text-u-muted" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Sender + time */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[13px] truncate ${isUnread ? 'font-bold text-u-ink' : 'font-medium text-u-ink'}`}>
                        {primaryOtherUser?.name || 'Multiple participants'}
                      </span>
                      <span className={`text-[11px] shrink-0 ${isUnread ? 'font-semibold text-u-accent' : 'text-u-muted'}`}>{timeLabel(conv.updatedAt)}</span>
                    </div>

                    {/* Subject + indicators */}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className={`text-xs truncate ${isUnread ? 'font-bold text-u-accent' : 'text-u-ink2'}`}>{conv.subject}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {conv.priority === 'urgent' && <AlertCircle className="w-3.5 h-3.5 text-u-danger" aria-label="Urgent" />}
                        {conv.visibility === 'internal_only' && <Lock className="w-3 h-3 text-u-warn" aria-label="Staff only" />}
                        {withAttachments && <Paperclip className="w-3 h-3 text-u-muted" />}
                        <button type="button" onClick={(e) => { e.stopPropagation(); toggleStar(conv.id); }} className={isStarred ? '' : 'opacity-0 group-hover:opacity-100'}>
                          <Flag className={`w-3.5 h-3.5 ${isStarred ? 'text-u-danger fill-u-danger' : 'text-u-muted hover:text-u-danger'}`} />
                        </button>
                      </span>
                    </div>

                    {/* Preview */}
                    <p className="text-xs text-u-muted truncate mt-0.5">
                      {conv.draftBody ? (
                        <span className="text-u-danger"><span className="font-semibold">[Draft]</span> {conv.draftBody}</span>
                      ) : latestMsg ? (
                        latestMsg.isInternalNote ? <span className="text-u-warn italic">[Internal note] {latestMsg.body}</span> : latestMsg.body
                      ) : (
                        'No messages in thread'
                      )}
                    </p>

                    {/* Category chips like Outlook colour categories */}
                    <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                      <span className="px-1.5 py-px rounded bg-u-s3 text-u-ink2">{conv.category}</span>
                      {conv.relatedEntityRef && <span className="px-1.5 py-px rounded font-mono bg-u-accent-soft text-u-accent">{conv.relatedEntityRef}</span>}
                      <span className="text-u-muted" title={`Channel: ${channelBadge.label}`}>{channelBadge.icon}</span>
                      {assignedStaffUser && <span className="text-u-muted truncate" title={`Assigned to ${assignedStaffUser.name}`}>→ {assignedStaffUser.name.split(' ')[0]}</span>}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
};
