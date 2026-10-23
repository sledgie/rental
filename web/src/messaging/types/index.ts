export type UserRole =
  | 'property_manager'
  | 'leasing_staff'
  | 'maintenance_staff'
  | 'accounting_staff'
  | 'tenant'
  | 'landlord'
  | 'vendor'
  | 'admin';

export type ChannelType = 'email' | 'sms' | 'whatsapp' | 'in_app';

export type MessageCategory =
  | 'General Inquiry'
  | 'Maintenance'
  | 'Lease and Renewal'
  | 'Rent and Payments'
  | 'Invoice and Charges'
  | 'Deposit and Refund'
  | 'Inspection'
  | 'Property Announcement'
  | 'Complaint'
  | 'Document Request'
  | 'Vendor Coordination'
  | 'Internal Discussion'
  | 'Other';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export type ConversationStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_for_reply'
  | 'resolved'
  | 'closed'
  | 'archived';

export type Visibility = 'external' | 'internal_only';

export type RelatedEntityType =
  | 'property'
  | 'unit'
  | 'tenant'
  | 'lease'
  | 'maintenance'
  | 'invoice'
  | 'payment'
  | 'deposit'
  | 'inspection'
  | 'vendor'
  | 'other';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  title: string;
  companyOrUnit?: string;
  isStaff: boolean;
}

export interface Attachment {
  id: string;
  messageId?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  mockUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
  /** a newly chosen file, uploaded when the message is saved */
  file?: File;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  channel: ChannelType;
  deliveryStatus: 'simulated_sent' | 'simulated_delivered' | 'simulated_read' | 'draft';
  isInternalNote: boolean;
  attachments: Attachment[];
  replyToMessageId?: string;
}

export interface ConversationParticipant {
  userId: string;
  participantRole: UserRole;
  joinedAt: string;
  lastReadAt?: string;
}

export interface Conversation {
  id: string;
  subject: string;
  category: MessageCategory;
  priority: Priority;
  status: ConversationStatus;
  visibility: Visibility;
  primaryChannel: ChannelType;
  participantIds: string[];
  assignedTo?: string; // staff userId
  assignedAt?: string;
  assignedBy?: string;
  assignmentNotes?: string;
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: string;
  relatedEntityRef?: string; // e.g. "WO-8821" or "INV-2025-089"
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  resolvedAt?: string;
  starredBy: string[]; // userIds who marked starred
  tags?: string[];
  draftBody?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: MessageCategory;
  targetAudience: 'all_tenants' | 'property_tenants' | 'unit_tenants' | 'owners' | 'staff' | 'vendors';
  targetPropertyIds?: string[];
  targetUnitIds?: string[];
  createdBy: string;
  createdAt: string;
  scheduledAt?: string;
  publishedAt?: string;
  expiresAt?: string;
  priority: Priority;
  acknowledgementRequired: boolean;
  status: 'draft' | 'scheduled' | 'published' | 'expired' | 'cancelled';
  acknowledgedUserIds: string[];
  channels: ChannelType[];
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: MessageCategory;
  subject: string;
  body: string;
  availableVariables: string[];
  intendedAudience: 'tenants' | 'owners' | 'vendors' | 'staff' | 'all';
  status: 'active' | 'inactive';
  createdBy: string;
  updatedAt: string;
}

export interface ConversationAuditLog {
  id: string;
  conversationId: string;
  eventType:
    | 'conversation_created'
    | 'message_sent'
    | 'internal_note_added'
    | 'status_changed'
    | 'priority_changed'
    | 'category_changed'
    | 'assigned'
    | 'reassigned'
    | 'participant_added'
    | 'archived'
    | 'reopened'
    | 'record_linked';
  actorId: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
  notes?: string;
}

export interface InAppNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  conversationId?: string;
  type: 'message' | 'assignment' | 'urgent' | 'announcement' | 'status_change';
}

// Business Entity Models for Rental Management System
export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  unitsCount: number;
  occupiedCount: number;
  managerId: string;
  image: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  monthlyRent: number;
  status: 'occupied' | 'vacant' | 'maintenance';
  tenantId?: string;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  unitId: string;
  propertyId: string;
  leaseId: string;
  moveInDate: string;
  outstandingBalance: number;
  depositAmount: number;
  status: 'active' | 'pending' | 'past';
  avatar?: string;
}

export interface Lease {
  id: string;
  leaseNumber: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  status: 'active' | 'renewal_pending' | 'expiring_soon' | 'terminated';
}

export interface MaintenanceRequest {
  id: string;
  requestNumber: string;
  title: string;
  description: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  priority: Priority;
  status: 'new' | 'assigned' | 'in_progress' | 'parts_pending' | 'completed';
  assignedStaffId?: string;
  assignedVendorId?: string;
  createdAt: string;
  category: string;
  estimatedCost?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'unpaid' | 'overdue' | 'disputed';
  type: 'rent' | 'late_fee' | 'utilities' | 'repairs';
  description: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string; // e.g., "Plumbing", "Electrical", "HVAC", "Janitorial"
  contactPerson: string;
  email: string;
  phone: string;
  rating: number;
  activeJobsCount: number;
}

export interface Inspection {
  id: string;
  inspectionNumber: string;
  propertyId: string;
  unitId?: string;
  type: 'annual' | 'move_in' | 'move_out' | 'fire_safety';
  scheduledDate: string;
  inspectorName: string;
  status: 'scheduled' | 'completed' | 'follow_up_needed';
}
