import { UserRole, Priority, ConversationStatus, ChannelType } from '../types';

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  } catch {
    return dateString;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getRoleBadge(role: UserRole): { label: string; bg: string; text: string } {
  switch (role) {
    case 'property_manager':
      return { label: 'Property Manager', bg: 'bg-u-accent-soft border-u-accent/30', text: 'text-u-accent' };
    case 'leasing_staff':
      return { label: 'Leasing Staff', bg: 'bg-u-violet/15 border-u-violet/30', text: 'text-u-violet' };
    case 'maintenance_staff':
      return { label: 'Maintenance', bg: 'bg-u-warn-soft border-u-warn/30', text: 'text-u-warn' };
    case 'accounting_staff':
      return { label: 'Accounting', bg: 'bg-u-ok-soft border-u-ok/30', text: 'text-u-ok' };
    case 'tenant':
      return { label: 'Tenant', bg: 'bg-u-accent-soft border-u-accent/30', text: 'text-u-accent' };
    case 'landlord':
      return { label: 'Property Owner', bg: 'bg-u-blue-soft border-u-blue/30', text: 'text-u-blue' };
    case 'vendor':
      return { label: 'Vendor / Contractor', bg: 'bg-u-warn-soft border-u-warn/30', text: 'text-u-warn' };
    case 'admin':
      return { label: 'Admin', bg: 'bg-u-danger-soft border-u-danger/30', text: 'text-u-danger' };
    default:
      return { label: 'User', bg: 'bg-u-s2 border-u-line', text: 'text-u-ink2' };
  }
}

export function getPriorityBadge(priority: Priority): { label: string; bg: string; text: string; dot: string } {
  switch (priority) {
    case 'urgent':
      return { label: 'Urgent', bg: 'bg-u-danger-soft border-u-danger/30', text: 'text-u-danger', dot: 'bg-u-danger' };
    case 'high':
      return { label: 'High', bg: 'bg-u-warn-soft border-u-warn/30', text: 'text-u-warn', dot: 'bg-u-warn' };
    case 'normal':
      return { label: 'Normal', bg: 'bg-u-accent-soft border-u-accent/30', text: 'text-u-accent', dot: 'bg-u-accent' };
    case 'low':
      return { label: 'Low', bg: 'bg-u-s2 border-u-line', text: 'text-u-ink2', dot: 'bg-u-line2' };
  }
}

export function getStatusBadge(status: ConversationStatus): { label: string; bg: string; text: string } {
  switch (status) {
    case 'open':
      return { label: 'Open', bg: 'bg-u-accent-soft text-u-accent border-u-accent/30', text: 'text-u-accent' };
    case 'in_progress':
      return { label: 'In Progress', bg: 'bg-u-accent-soft text-u-accent border-u-accent/30', text: 'text-u-accent' };
    case 'waiting_for_reply':
      return { label: 'Waiting for Reply', bg: 'bg-u-warn-soft text-u-warn border-u-warn/30', text: 'text-u-warn' };
    case 'resolved':
      return { label: 'Resolved', bg: 'bg-u-ok-soft text-u-ok border-u-ok/30', text: 'text-u-ok' };
    case 'closed':
      return { label: 'Closed', bg: 'bg-u-s3 text-u-ink2 border-u-line', text: 'text-u-ink2' };
    case 'archived':
      return { label: 'Archived', bg: 'bg-u-s3 text-u-ink2 border-u-line', text: 'text-u-ink2' };
  }
}

export function getChannelDetails(channel: ChannelType): { label: string; icon: string; color: string; badge: string } {
  switch (channel) {
    case 'email':
      return { label: 'Email', icon: '✉️', color: 'text-u-accent', badge: 'bg-u-accent-soft text-u-accent border-u-accent/30' };
    case 'sms':
      return { label: 'SMS', icon: '💬', color: 'text-u-ok', badge: 'bg-u-ok-soft text-u-ok border-u-ok/30' };
    case 'whatsapp':
      return { label: 'WhatsApp', icon: '📱', color: 'text-u-blue', badge: 'bg-u-blue-soft text-u-blue border-u-blue/30' };
    case 'in_app':
      return { label: 'In-App Portal', icon: '🔔', color: 'text-u-accent', badge: 'bg-u-accent-soft text-u-accent border-u-accent/30' };
  }
}

export function resolveTemplateVariables(
  templateText: string,
  variables: Record<string, string | number | undefined>
): { resolvedText: string; unresolvedPlaceholders: string[] } {
  let resolved = templateText;
  const unresolved: string[] = [];

  const placeholderRegex = /\{\{([a-zA-Z0-9]+)\}\}/g;
  const matches = templateText.match(placeholderRegex) || [];

  matches.forEach((placeholder) => {
    const key = placeholder.replace(/\{\{|\}\}/g, '');
    const value = variables[key] ?? variables[placeholder];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      resolved = resolved.split(placeholder).join(String(value));
    } else {
      if (!unresolved.includes(placeholder)) {
        unresolved.push(placeholder);
      }
    }
  });

  return { resolvedText: resolved, unresolvedPlaceholders: unresolved };
}
