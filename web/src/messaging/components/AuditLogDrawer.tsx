import React from 'react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/formatters';
import {
  History,
  UserCheck,
  CheckCircle,
  Tag,
  AlertCircle,
  Archive,
  RotateCcw,
  PlusCircle,
  Lock,
  MessageSquare,
} from 'lucide-react';

interface AuditLogDrawerProps {
  conversationId: string;
}

export const AuditLogDrawer: React.FC<AuditLogDrawerProps> = ({ conversationId }) => {
  const { auditLogs, users } = useApp();

  const convLogs = auditLogs.filter((log) => log.conversationId === conversationId);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'conversation_created':
        return <PlusCircle className="w-4 h-4 text-u-ok" />;
      case 'message_sent':
        return <MessageSquare className="w-4 h-4 text-u-accent" />;
      case 'internal_note_added':
        return <Lock className="w-4 h-4 text-u-warn" />;
      case 'assigned':
      case 'reassigned':
        return <UserCheck className="w-4 h-4 text-u-violet" />;
      case 'status_changed':
        return <CheckCircle className="w-4 h-4 text-u-accent" />;
      case 'priority_changed':
        return <AlertCircle className="w-4 h-4 text-u-danger" />;
      case 'category_changed':
        return <Tag className="w-4 h-4 text-u-ink2" />;
      case 'archived':
        return <Archive className="w-4 h-4 text-u-ink2" />;
      case 'reopened':
        return <RotateCcw className="w-4 h-4 text-u-blue" />;
      default:
        return <History className="w-4 h-4 text-u-muted" />;
    }
  };

  if (convLogs.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-u-muted space-y-2">
        <History className="w-6 h-6 mx-auto text-u-s3" />
        <p>No audit trail events recorded yet for this conversation.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-u-line">
        <div className="flex items-center gap-1.5 text-xs font-bold text-u-ink">
          <History className="w-4 h-4 text-u-accent" />
          <span>Compliance & Operational Audit Log</span>
        </div>
        <span className="text-[10px] text-u-muted font-mono font-medium">
          {convLogs.length} Events Recorded
        </span>
      </div>

      <div className="space-y-3">
        {convLogs.map((log) => {
          const actor = users.find((u) => u.id === log.actorId);
          return (
            <div
              key={log.id}
              className="p-3 bg-u-s2 border border-u-line rounded-xl text-xs space-y-1.5 relative hover:border-u-line2 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-u-card border border-u-line shadow-2xs">
                    {getEventIcon(log.eventType)}
                  </div>
                  <span className="font-bold text-u-ink capitalize">
                    {log.eventType.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-[10px] text-u-muted font-medium">
                  {formatDate(log.timestamp)}
                </span>
              </div>

              <div className="text-u-ink2 text-[11px] pl-7 space-y-0.5">
                <p>
                  <strong>Actor:</strong> {actor?.name || log.actorId}{' '}
                  {actor && <span className="text-u-muted">({actor.title})</span>}
                </p>

                {log.oldValue && (
                  <p>
                    <span className="text-u-muted">Previous:</span>{' '}
                    <span className="line-through text-u-muted">{log.oldValue}</span>
                  </p>
                )}

                {log.newValue && (
                  <p>
                    <span className="text-u-muted font-medium">Updated:</span>{' '}
                    <span className="font-semibold text-u-ink">{log.newValue}</span>
                  </p>
                )}

                {log.notes && (
                  <p className="text-[10px] text-u-muted italic mt-0.5 bg-u-card p-1.5 rounded border border-u-line">
                    Reason / Note: {log.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
