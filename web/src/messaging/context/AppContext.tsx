import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import {
  User,
  Conversation,
  Message,
  Announcement,
  MessageTemplate,
  ConversationAuditLog,
  InAppNotification,
  ChannelType,
  ConversationStatus,
  Priority,
  MessageCategory,
  Visibility,
  RelatedEntityType,
  Attachment,
  Property,
  Unit,
  Tenant,
  Lease,
  MaintenanceRequest,
  Invoice,
  Vendor,
  Inspection,
} from '../types';
import {
  MOCK_USERS,
  MOCK_PROPERTIES,
  MOCK_UNITS,
  MOCK_TENANTS,
  MOCK_LEASES,
  MOCK_MAINTENANCE,
  MOCK_INVOICES,
  MOCK_VENDORS,
  MOCK_INSPECTIONS,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  MOCK_TEMPLATES,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS,
} from '../data/mockData';

export type AppModule =
  | 'messages'
  | 'dashboard'
  | 'properties'
  | 'tenants'
  | 'leases'
  | 'maintenance'
  | 'invoices'
  | 'vendors';

export type MessageFolder =
  | 'inbox'
  | 'unread'
  | 'sent'
  | 'assigned'
  | 'internal'
  | 'announcements'
  | 'drafts'
  | 'archived'
  | 'templates'
  | 'metrics'
  | 'settings';

export interface ComposeInitialData {
  recipientIds?: string[];
  subject?: string;
  category?: MessageCategory;
  priority?: Priority;
  channel?: ChannelType;
  visibility?: Visibility;
  body?: string;
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: string;
  relatedEntityRef?: string;
}

interface AppContextType {
  // Current user & Users
  users: User[];
  currentUser: User;
  setCurrentUser: (user: User) => void;

  // Navigation
  activeModule: AppModule;
  setActiveModule: (mod: AppModule) => void;
  activeFolder: MessageFolder;
  setActiveFolder: (folder: MessageFolder) => void;

  // Messages UI State
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  activeChannelFilter: ChannelType | 'all';
  setActiveChannelFilter: (ch: ChannelType | 'all') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  categoryFilter: string;
  setCategoryFilter: (c: string) => void;
  priorityFilter: string;
  setPriorityFilter: (p: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  assignedFilter: string;
  setAssignedFilter: (a: string) => void;
  sortBy: 'newest' | 'oldest' | 'priority' | 'status';
  setSortBy: (s: 'newest' | 'oldest' | 'priority' | 'status') => void;

  // Bulk actions
  selectedConversationIds: string[];
  toggleSelectConversation: (id: string) => void;
  selectAllConversations: (ids: string[]) => void;
  clearSelectedConversations: () => void;

  // Data collections
  conversations: Conversation[];
  messages: Message[];
  announcements: Announcement[];
  templates: MessageTemplate[];
  auditLogs: ConversationAuditLog[];
  notifications: InAppNotification[];

  // Rental Management Data
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  maintenanceRequests: MaintenanceRequest[];
  invoices: Invoice[];
  vendors: Vendor[];
  inspections: Inspection[];

  // Compose Modal
  isComposeOpen: boolean;
  composeInitialData: ComposeInitialData | null;
  openComposeModal: (initialData?: ComposeInitialData) => void;
  closeComposeModal: () => void;

  // Actions
  sendMessage: (
    conversationId: string,
    body: string,
    channel: ChannelType,
    isInternalNote: boolean,
    attachments?: Attachment[]
  ) => void;

  createConversation: (data: {
    subject: string;
    category: MessageCategory;
    priority: Priority;
    visibility: Visibility;
    primaryChannel: ChannelType;
    participantIds: string[];
    assignedTo?: string;
    body: string;
    attachments?: Attachment[];
    relatedEntityType?: RelatedEntityType;
    relatedEntityId?: string;
    relatedEntityRef?: string;
  }) => Conversation;

  updateConversationStatus: (id: string, status: ConversationStatus, reason?: string) => void;
  updateConversationPriority: (id: string, priority: Priority) => void;
  updateConversationCategory: (id: string, category: MessageCategory) => void;
  assignConversation: (id: string, staffId: string, notes?: string) => void;
  toggleStar: (id: string) => void;
  markConversationRead: (id: string) => void;
  markConversationUnread: (id: string) => void;
  archiveConversation: (id: string) => void;
  unarchiveConversation: (id: string) => void;
  bulkMarkAsRead: () => void;
  bulkArchive: () => void;
  saveDraft: (conversationId: string, draftText: string) => void;
  deleteDraft: (conversationId: string) => void;

  // Template Actions
  createTemplate: (tpl: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  updateTemplate: (tpl: MessageTemplate) => void;
  deleteTemplate: (id: string) => void;

  // Announcement Actions
  createAnnouncement: (ann: Omit<Announcement, 'id' | 'createdAt' | 'createdBy' | 'acknowledgedUserIds'>) => void;
  publishAnnouncement: (id: string) => void;
  acknowledgeAnnouncement: (id: string) => void;

  // Notification Actions
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Deep linking helper
  openConversationByRelatedRecord: (type: RelatedEntityType, id: string, label?: string) => void;

  // Permission & count helpers
  canAccessConversation: (conv: Conversation) => boolean;
  canViewMessage: (msg: Message) => boolean;
  unreadCount: number;
  totalUnreadNotificationCount: number;
  readTracker: Record<string, boolean>; // convId -> isRead for current user
}

const MODULE_ROUTES: Partial<Record<AppModule, string>> = {
  dashboard: 'dashboard',
  properties: 'properties',
  tenants: 'tenants',
  leases: 'leases',
  maintenance: 'maintenance-requests',
  invoices: 'invoices',
  vendors: 'vendors',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode; initialFolder?: MessageFolder }> = ({ children, initialFolder }) => {
  const [users] = useState<User[]>(MOCK_USERS);
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]); // Alex Rivera (Property Manager)

  const [activeModule, setActiveModuleState] = useState<AppModule>('messages');
  // Records live on other pages of the host app, so those modules navigate by hash instead of swapping an in-page view.
  const setActiveModule = useCallback((mod: AppModule) => {
    const route = MODULE_ROUTES[mod];
    if (route) window.location.hash = '#/' + route;
    else setActiveModuleState(mod);
  }, []);
  const [activeFolder, setActiveFolder] = useState<MessageFolder>(initialFolder ?? 'inbox');

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>('conv_001');
  const [activeChannelFilter, setActiveChannelFilter] = useState<ChannelType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority' | 'status'>('newest');

  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);

  // Core Data
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [templates, setTemplates] = useState<MessageTemplate[]>(MOCK_TEMPLATES);
  const [auditLogs, setAuditLogs] = useState<ConversationAuditLog[]>(INITIAL_AUDIT_LOGS);
  const [notifications, setNotifications] = useState<InAppNotification[]>(INITIAL_NOTIFICATIONS);

  // Entities
  const [properties] = useState<Property[]>(MOCK_PROPERTIES);
  const [units] = useState<Unit[]>(MOCK_UNITS);
  const [tenants] = useState<Tenant[]>(MOCK_TENANTS);
  const [leases] = useState<Lease[]>(MOCK_LEASES);
  const [maintenanceRequests] = useState<MaintenanceRequest[]>(MOCK_MAINTENANCE);
  const [invoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [vendors] = useState<Vendor[]>(MOCK_VENDORS);
  const [inspections] = useState<Inspection[]>(MOCK_INSPECTIONS);

  // Tracking read state per conversation for current user in mock
  // By default, conv_001 is unread for demonstration until clicked
  const [readTracker, setReadTracker] = useState<Record<string, boolean>>({
    conv_001: false,
    conv_002: true,
    conv_003: true,
    conv_004: false,
    conv_005: true,
    conv_006: true,
    conv_007: true,
    conv_008: true,
    conv_009: true,
  });

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeInitialData, setComposeInitialData] = useState<ComposeInitialData | null>(null);

  const openComposeModal = useCallback((initialData?: ComposeInitialData) => {
    setComposeInitialData(initialData || null);
    setIsComposeOpen(true);
  }, []);

  const closeComposeModal = useCallback(() => {
    setIsComposeOpen(false);
    setComposeInitialData(null);
  }, []);

  // Permission Checks:
  // Role expectations and strict privacy:
  // - Tenants & Vendors can never view internal_only conversations
  // - Tenants can only view conversations where they are a participant
  // - Vendors can only view conversations where they are a participant
  // - Landlords can only view their participant conversations
  // - Staff (PM, leasing, maintenance, accounting, admin) can view appropriate property & internal conversations
  const canAccessConversation = useCallback(
    (conv: Conversation): boolean => {
      if (conv.visibility === 'internal_only' && !currentUser.isStaff) {
        return false;
      }
      if (currentUser.role === 'tenant' || currentUser.role === 'vendor' || currentUser.role === 'landlord') {
        return conv.participantIds.includes(currentUser.id);
      }
      // Staff members
      return true;
    },
    [currentUser]
  );

  const canViewMessage = useCallback(
    (msg: Message): boolean => {
      // Internal staff notes must never be shown to non-staff!
      if (msg.isInternalNote && !currentUser.isStaff) {
        return false;
      }
      return true;
    },
    [currentUser]
  );

  // Mark conversation read
  const markConversationRead = useCallback((convId: string) => {
    setReadTracker((prev) => ({ ...prev, [convId]: true }));
  }, []);

  const markConversationUnread = useCallback((convId: string) => {
    setReadTracker((prev) => ({ ...prev, [convId]: false }));
  }, []);

  // Toggle star
  const toggleStar = useCallback(
    (convId: string) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          const isStarred = c.starredBy.includes(currentUser.id);
          const newStarred = isStarred
            ? c.starredBy.filter((uid) => uid !== currentUser.id)
            : [...c.starredBy, currentUser.id];
          return { ...c, starredBy: newStarred };
        })
      );
    },
    [currentUser.id]
  );

  // Update Status
  const updateConversationStatus = useCallback(
    (convId: string, newStatus: ConversationStatus, reason?: string) => {
      const timestamp = new Date().toISOString();
      let oldStatus: ConversationStatus = 'open';

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          oldStatus = c.status;
          return {
            ...c,
            status: newStatus,
            updatedAt: timestamp,
            resolvedAt: newStatus === 'resolved' ? timestamp : c.resolvedAt,
          };
        })
      );

      // Audit log entry
      const newAudit: ConversationAuditLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        conversationId: convId,
        eventType: 'status_changed',
        actorId: currentUser.id,
        timestamp,
        oldValue: oldStatus,
        newValue: newStatus,
        notes: reason || `Status changed by ${currentUser.name}`,
      };
      setAuditLogs((prev) => [newAudit, ...prev]);
    },
    [currentUser]
  );

  // Update Priority
  const updateConversationPriority = useCallback(
    (convId: string, newPriority: Priority) => {
      const timestamp = new Date().toISOString();
      let oldPriority: Priority = 'normal';

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          oldPriority = c.priority;
          return { ...c, priority: newPriority, updatedAt: timestamp };
        })
      );

      const newAudit: ConversationAuditLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        conversationId: convId,
        eventType: 'priority_changed',
        actorId: currentUser.id,
        timestamp,
        oldValue: oldPriority,
        newValue: newPriority,
        notes: `Priority changed to ${newPriority}`,
      };
      setAuditLogs((prev) => [newAudit, ...prev]);
    },
    [currentUser]
  );

  // Update Category
  const updateConversationCategory = useCallback(
    (convId: string, newCategory: MessageCategory) => {
      const timestamp = new Date().toISOString();
      let oldCategory: MessageCategory = 'General Inquiry';

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          oldCategory = c.category;
          return { ...c, category: newCategory, updatedAt: timestamp };
        })
      );

      const newAudit: ConversationAuditLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        conversationId: convId,
        eventType: 'category_changed',
        actorId: currentUser.id,
        timestamp,
        oldValue: oldCategory,
        newValue: newCategory,
      };
      setAuditLogs((prev) => [newAudit, ...prev]);
    },
    [currentUser]
  );

  // Assign conversation
  const assignConversation = useCallback(
    (convId: string, staffId: string, notes?: string) => {
      const timestamp = new Date().toISOString();
      const staffUser = users.find((u) => u.id === staffId);
      let oldAssigned = 'Unassigned';

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          if (c.assignedTo) {
            const oldUser = users.find((u) => u.id === c.assignedTo);
            oldAssigned = oldUser ? oldUser.name : c.assignedTo;
          }
          return {
            ...c,
            assignedTo: staffId,
            assignedAt: timestamp,
            assignedBy: currentUser.id,
            assignmentNotes: notes,
            updatedAt: timestamp,
          };
        })
      );

      const newAudit: ConversationAuditLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        conversationId: convId,
        eventType: 'assigned',
        actorId: currentUser.id,
        timestamp,
        oldValue: oldAssigned,
        newValue: staffUser ? `${staffUser.name} (${staffUser.title})` : staffId,
        notes: notes || 'Assigned via Messages module',
      };
      setAuditLogs((prev) => [newAudit, ...prev]);

      // Add in-app notification for the assignee
      if (staffId !== currentUser.id) {
        const notif: InAppNotification = {
          id: `notif_${Date.now()}`,
          title: 'Conversation Assigned to You',
          description: `${currentUser.name} assigned a conversation to you: "${notes || 'No notes provided'}"`,
          timestamp,
          isRead: false,
          conversationId: convId,
          type: 'assignment',
        };
        setNotifications((prev) => [notif, ...prev]);
      }
    },
    [currentUser, users]
  );

  // Archive / Unarchive
  const archiveConversation = useCallback(
    (convId: string) => {
      const timestamp = new Date().toISOString();
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, archivedAt: timestamp, updatedAt: timestamp } : c))
      );
      const newAudit: ConversationAuditLog = {
        id: `log_${Date.now()}`,
        conversationId: convId,
        eventType: 'archived',
        actorId: currentUser.id,
        timestamp,
        newValue: 'Conversation archived',
      };
      setAuditLogs((prev) => [newAudit, ...prev]);
    },
    [currentUser]
  );

  const unarchiveConversation = useCallback(
    (convId: string) => {
      const timestamp = new Date().toISOString();
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, archivedAt: undefined, updatedAt: timestamp } : c))
      );
      const newAudit: ConversationAuditLog = {
        id: `log_${Date.now()}`,
        conversationId: convId,
        eventType: 'reopened',
        actorId: currentUser.id,
        timestamp,
        newValue: 'Conversation unarchived / reopened',
      };
      setAuditLogs((prev) => [newAudit, ...prev]);
    },
    [currentUser]
  );

  // Send Reply / Message
  const sendMessage = useCallback(
    (
      conversationId: string,
      body: string,
      channel: ChannelType,
      isInternalNote: boolean,
      attachments: Attachment[] = []
    ) => {
      const timestamp = new Date().toISOString();
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const newMsg: Message = {
        id: messageId,
        conversationId,
        senderId: currentUser.id,
        body,
        createdAt: timestamp,
        channel,
        deliveryStatus: 'simulated_delivered',
        isInternalNote,
        attachments,
      };

      setMessages((prev) => [...prev, newMsg]);

      // Update conversation
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          // Clear draft if any
          return {
            ...c,
            updatedAt: timestamp,
            status: c.status === 'resolved' ? 'open' : c.status,
            draftBody: undefined,
          };
        })
      );

      // Current user has read it
      markConversationRead(conversationId);

      // Audit Log
      const newAudit: ConversationAuditLog = {
        id: `log_${Date.now()}`,
        conversationId,
        eventType: isInternalNote ? 'internal_note_added' : 'message_sent',
        actorId: currentUser.id,
        timestamp,
        newValue: isInternalNote
          ? `Added internal staff note via ${channel}`
          : `Sent message via ${channel.toUpperCase()}`,
      };
      setAuditLogs((prev) => [newAudit, ...prev]);
    },
    [currentUser, markConversationRead]
  );

  // Create New Conversation
  const createConversation = useCallback(
    (data: {
      subject: string;
      category: MessageCategory;
      priority: Priority;
      visibility: Visibility;
      primaryChannel: ChannelType;
      participantIds: string[];
      assignedTo?: string;
      body: string;
      attachments?: Attachment[];
      relatedEntityType?: RelatedEntityType;
      relatedEntityId?: string;
      relatedEntityRef?: string;
    }): Conversation => {
      const timestamp = new Date().toISOString();
      const convId = `conv_${Date.now()}`;
      const msgId = `msg_${Date.now()}_1`;

      const allParticipants = Array.from(new Set([currentUser.id, ...data.participantIds]));

      const newConv: Conversation = {
        id: convId,
        subject: data.subject,
        category: data.category,
        priority: data.priority,
        status: 'open',
        visibility: data.visibility,
        primaryChannel: data.primaryChannel,
        participantIds: allParticipants,
        assignedTo: data.assignedTo || (currentUser.isStaff ? currentUser.id : 'usr_pm_1'),
        assignedAt: timestamp,
        assignedBy: currentUser.id,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
        relatedEntityRef: data.relatedEntityRef,
        createdBy: currentUser.id,
        createdAt: timestamp,
        updatedAt: timestamp,
        starredBy: [],
      };

      const newMsg: Message = {
        id: msgId,
        conversationId: convId,
        senderId: currentUser.id,
        body: data.body,
        createdAt: timestamp,
        channel: data.primaryChannel,
        deliveryStatus: 'simulated_delivered',
        isInternalNote: data.visibility === 'internal_only',
        attachments: data.attachments || [],
      };

      setConversations((prev) => [newConv, ...prev]);
      setMessages((prev) => [...prev, newMsg]);
      setSelectedConversationId(convId);
      markConversationRead(convId);

      const audit: ConversationAuditLog = {
        id: `log_${Date.now()}`,
        conversationId: convId,
        eventType: 'conversation_created',
        actorId: currentUser.id,
        timestamp,
        newValue: `Started new conversation: "${data.subject}" via ${data.primaryChannel.toUpperCase()}`,
      };
      setAuditLogs((prev) => [audit, ...prev]);

      return newConv;
    },
    [currentUser, markConversationRead]
  );

  // Drafts
  const saveDraft = useCallback((convId: string, draftText: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, draftBody: draftText, updatedAt: new Date().toISOString() } : c))
    );
  }, []);

  const deleteDraft = useCallback((convId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, draftBody: undefined } : c))
    );
  }, []);

  // Templates
  const createTemplate = useCallback(
    (tpl: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
      const newTpl: MessageTemplate = {
        ...tpl,
        id: `tpl_${Date.now()}`,
        createdBy: currentUser.id,
        updatedAt: new Date().toISOString(),
      };
      setTemplates((prev) => [newTpl, ...prev]);
    },
    [currentUser]
  );

  const updateTemplate = useCallback((tpl: MessageTemplate) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === tpl.id ? { ...tpl, updatedAt: new Date().toISOString() } : t))
    );
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Announcements
  const createAnnouncement = useCallback(
    (ann: Omit<Announcement, 'id' | 'createdAt' | 'createdBy' | 'acknowledgedUserIds'>) => {
      const newAnn: Announcement = {
        ...ann,
        id: `ann_${Date.now()}`,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
        acknowledgedUserIds: [],
      };
      setAnnouncements((prev) => [newAnn, ...prev]);
    },
    [currentUser]
  );

  const publishAnnouncement = useCallback((id: string) => {
    const timestamp = new Date().toISOString();
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'published', publishedAt: timestamp } : a))
    );
  }, []);

  const acknowledgeAnnouncement = useCallback(
    (id: string) => {
      setAnnouncements((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          const hasAcked = a.acknowledgedUserIds.includes(currentUser.id);
          return {
            ...a,
            acknowledgedUserIds: hasAcked ? a.acknowledgedUserIds : [...a.acknowledgedUserIds, currentUser.id],
          };
        })
      );
    },
    [currentUser.id]
  );

  // Bulk actions
  const toggleSelectConversation = useCallback((id: string) => {
    setSelectedConversationIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const selectAllConversations = useCallback((ids: string[]) => {
    setSelectedConversationIds(ids);
  }, []);

  const clearSelectedConversations = useCallback(() => {
    setSelectedConversationIds([]);
  }, []);

  const bulkMarkAsRead = useCallback(() => {
    setReadTracker((prev) => {
      const next = { ...prev };
      selectedConversationIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
    setSelectedConversationIds([]);
  }, [selectedConversationIds]);

  const bulkArchive = useCallback(() => {
    const timestamp = new Date().toISOString();
    setConversations((prev) =>
      prev.map((c) =>
        selectedConversationIds.includes(c.id) ? { ...c, archivedAt: timestamp } : c
      )
    );
    setSelectedConversationIds([]);
  }, [selectedConversationIds]);

  // Notifications
  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  // Open conversation from other modules
  const openConversationByRelatedRecord = useCallback(
    (type: RelatedEntityType, id: string, label?: string) => {
      // Find existing
      const existing = conversations.find(
        (c) => c.relatedEntityType === type && c.relatedEntityId === id && canAccessConversation(c)
      );

      setActiveModule('messages');
      if (existing) {
        setSelectedConversationId(existing.id);
        markConversationRead(existing.id);
      } else {
        // Open Compose pre-populated with this record
        openComposeModal({
          relatedEntityType: type,
          relatedEntityId: id,
          relatedEntityRef: label || `${type.toUpperCase()} #${id}`,
          subject: `Inquiry regarding ${label || `${type} #${id}`}`,
        });
      }
    },
    [conversations, canAccessConversation, markConversationRead, openComposeModal]
  );

  // Calculate unread count for current user
  const unreadCount = useMemo(() => {
    return conversations.filter((c) => {
      if (!canAccessConversation(c)) return false;
      if (c.archivedAt) return false;
      return readTracker[c.id] === false;
    }).length;
  }, [conversations, canAccessConversation, readTracker]);

  const totalUnreadNotificationCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  return (
    <AppContext.Provider
      value={{
        users,
        currentUser,
        setCurrentUser,
        activeModule,
        setActiveModule,
        activeFolder,
        setActiveFolder,
        selectedConversationId,
        setSelectedConversationId,
        activeChannelFilter,
        setActiveChannelFilter,
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
        conversations,
        messages,
        announcements,
        templates,
        auditLogs,
        notifications,
        properties,
        units,
        tenants,
        leases,
        maintenanceRequests,
        invoices,
        vendors,
        inspections,
        isComposeOpen,
        composeInitialData,
        openComposeModal,
        closeComposeModal,
        sendMessage,
        createConversation,
        updateConversationStatus,
        updateConversationPriority,
        updateConversationCategory,
        assignConversation,
        toggleStar,
        markConversationRead,
        markConversationUnread,
        archiveConversation,
        unarchiveConversation,
        bulkMarkAsRead,
        bulkArchive,
        saveDraft,
        deleteDraft,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        createAnnouncement,
        publishAnnouncement,
        acknowledgeAnnouncement,
        markNotificationRead,
        markAllNotificationsRead,
        openConversationByRelatedRecord,
        canAccessConversation,
        canViewMessage,
        unreadCount,
        totalUnreadNotificationCount,
        readTracker,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
