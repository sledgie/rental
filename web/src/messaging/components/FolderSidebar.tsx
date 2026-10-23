import { isSupabaseConfigured } from '../../lib/supabase';
import React from 'react';
import { useApp, MessageFolder } from '../context/AppContext';
import { Inbox, Mail, Send, UserCheck, Lock, Megaphone, FileEdit, Archive, BookOpen, BarChart3, Settings, ShieldAlert } from 'lucide-react';
import { ChannelType } from '../types';

export const FolderSidebar: React.FC = () => {
  const {
    activeFolder,
    setActiveFolder,
    activeChannelFilter,
    setActiveChannelFilter,
    conversations,
    announcements,
    templates,
    canAccessConversation,
    currentUser,
    readTracker,
    openComposeModal,
  } = useApp();

  // Calculate folder counts dynamically based on mock data
  const accessibleConvs = conversations.filter(canAccessConversation);

  const inboxConvs = accessibleConvs.filter((c) => !c.archivedAt);
  const unreadCount = inboxConvs.filter((c) => readTracker[c.id] === false).length;

  const assignedToMeCount = inboxConvs.filter((c) => c.assignedTo === currentUser.id).length;

  const internalCount = currentUser.isStaff
    ? accessibleConvs.filter((c) => c.visibility === 'internal_only' && !c.archivedAt).length
    : 0;

  const sentCount = accessibleConvs.filter((c) => c.createdBy === currentUser.id).length;

  const draftsCount = accessibleConvs.filter((c) => Boolean(c.draftBody)).length;

  const archivedCount = accessibleConvs.filter((c) => Boolean(c.archivedAt)).length;

  const activeAnnouncementsCount = announcements.filter(
    (a) => a.status === 'published' || a.status === 'scheduled'
  ).length;

  const folderItems: {
    id: MessageFolder;
    label: string;
    icon: React.ReactNode;
    count?: number;
    staffOnly?: boolean;
    color?: string;
  }[] = [
    { id: 'inbox', label: 'Inbox', icon: <Inbox className="w-4 h-4" />, count: unreadCount },
    { id: 'unread', label: 'Unread Only', icon: <Mail className="w-4 h-4" />, count: unreadCount },
    {
      id: 'assigned',
      label: 'Assigned to Me',
      icon: <UserCheck className="w-4 h-4" />,
      count: assignedToMeCount,
      staffOnly: true,
    },
    {
      id: 'internal',
      label: 'Internal Staff',
      icon: <Lock className="w-4 h-4 text-u-warn" />,
      count: internalCount,
      staffOnly: true,
    },
    { id: 'sent', label: 'Sent Messages', icon: <Send className="w-4 h-4" />, count: sentCount },
    { id: 'drafts', label: 'Drafts', icon: <FileEdit className="w-4 h-4" />, count: draftsCount },
    { id: 'archived', label: 'Archived', icon: <Archive className="w-4 h-4" />, count: archivedCount },
    {
      id: 'announcements',
      label: 'Announcements',
      icon: <Megaphone className="w-4 h-4 text-u-violet" />,
      count: activeAnnouncementsCount,
    },
    {
      id: 'templates',
      label: 'Message Templates',
      icon: <BookOpen className="w-4 h-4 text-u-accent" />,
      count: templates.length,
      staffOnly: true,
    },
    {
      id: 'metrics',
      label: 'Communication Metrics',
      icon: <BarChart3 className="w-4 h-4 text-u-ok" />,
      staffOnly: true,
    },
    {
      id: 'settings',
      label: 'Gateway Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const channelFilters: { id: ChannelType | 'all'; label: string; icon: string; count?: number }[] = [
    { id: 'all', label: 'All Channels', icon: '🌐' },
    { id: 'email', label: 'Email', icon: '✉️' },
    { id: 'sms', label: 'SMS', icon: '💬' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
    { id: 'in_app', label: 'In-App', icon: '🔔' },
  ];

  return (
    <aside className="w-56 bg-u-s2 border-r border-u-line flex flex-col h-full shrink-0 select-none">
      {/* Main Folders List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6">
        {/* Core Folders */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-u-muted mb-1.5">
            Folders
          </p>
          {folderItems.map((item) => {
            // If folder is staffOnly and current user is not staff, hide or show disabled
            if (item.staffOnly && !currentUser.isStaff) return null;

            const isActive = activeFolder === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveFolder(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-u-card text-u-accent font-bold shadow-xs border border-u-line/80'
                    : 'text-u-ink2 hover:text-u-ink hover:bg-u-line/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-u-accent' : 'text-u-muted'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      item.id === 'inbox' || item.id === 'unread'
                        ? 'bg-u-accent-soft text-u-accent'
                        : 'bg-u-line text-u-ink2'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Channel Filter Section */}
        <div className="space-y-1 pt-2 border-t border-u-line/70">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-u-muted mb-1.5">
            Channels
          </p>
          {channelFilters.map((cf) => {
            const isSelected = activeChannelFilter === cf.id;
            return (
              <button
                key={cf.id}
                onClick={() => setActiveChannelFilter(cf.id)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-u-line/80 text-u-ink font-bold'
                    : 'text-u-ink2 hover:text-u-ink hover:bg-u-s3'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{cf.icon}</span>
                  <span>{cf.label}</span>
                </div>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-u-accent"></span>}
              </button>
            );
          })}
        </div>

        {/* Persona Scope Warning / Info */}
        {!currentUser.isStaff && (
          <div className="p-3 bg-u-warn-soft/80 border border-u-warn/30 rounded-xl text-[11px] text-u-warn space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-3.5 h-3.5 text-u-warn" />
              <span>Restricted Tenant / Vendor Scope</span>
            </div>
            <p className="text-[10px] text-u-warn leading-tight">
              You are viewing as <strong className="font-semibold">{currentUser.name}</strong>. Internal staff notes & other residents' private messages are completely hidden.
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-u-line/80 text-[11px] text-u-muted flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-u-ok animate-pulse"></span>
          <span>{isSupabaseConfigured ? 'Saved to your organization' : 'Sync Status: Realtime Mock'}</span>
        </span>
        <span className="font-mono text-[10px] text-u-muted">v2.4</span>
      </div>
    </aside>
  );
};
