import React from 'react';
import { useApp } from '../context/AppContext';
import {
  BarChart3,
  AlertTriangle,
  Zap,
  Users,
  TrendingUp,
} from 'lucide-react';

export const CommunicationMetrics: React.FC = () => {
  const { conversations, users, currentUser, readTracker } = useApp();

  // Metrics derived deterministically
  const totalConvs = conversations.length;
  const unreadCount = conversations.filter((c) => !c.archivedAt && readTracker[c.id] === false).length;
  const openCount = conversations.filter((c) => c.status === 'open').length;
  const inProgressCount = conversations.filter((c) => c.status === 'in_progress').length;
  const resolvedCount = conversations.filter((c) => c.status === 'resolved').length;
  const urgentCount = conversations.filter((c) => c.priority === 'urgent' && c.status !== 'resolved').length;
  const assignedToMeCount = conversations.filter((c) => c.assignedTo === currentUser.id && !c.archivedAt).length;

  // Channel breakdown
  const channelCounts = {
    email: conversations.filter((c) => c.primaryChannel === 'email').length,
    sms: conversations.filter((c) => c.primaryChannel === 'sms').length,
    whatsapp: conversations.filter((c) => c.primaryChannel === 'whatsapp').length,
    in_app: conversations.filter((c) => c.primaryChannel === 'in_app').length,
  };

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  conversations.forEach((c) => {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
  });

  // Staff breakdown
  const staffMembers = users.filter((u) => u.isStaff);
  const staffCounts = staffMembers.map((s) => ({
    staff: s,
    count: conversations.filter((c) => c.assignedTo === s.id && !c.archivedAt).length,
  }));

  return (
    <div className="flex-1 h-full bg-u-s2 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-u-line">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-u-ok" />
            <h1 className="text-lg sm:text-xl font-bold text-u-ink">
              Communication & SLA Analytics
            </h1>
          </div>
          <p className="text-xs text-u-muted mt-0.5">
            Real-time performance metrics, multi-channel volume, and resident responsiveness.
          </p>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 bg-u-ok-soft text-u-ok border border-u-ok/30 rounded-lg font-semibold">
          Mock Operational Telemetry Active
        </span>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-u-card border border-u-line rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">
            Unread Inquiries
          </span>
          <p className="text-2xl font-extrabold text-u-accent">{unreadCount}</p>
          <span className="text-[10px] text-u-muted font-medium">Requires initial review</span>
        </div>

        <div className="p-4 bg-u-card border border-u-line rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">
            Urgent SLA
          </span>
          <p className="text-2xl font-extrabold text-u-danger">{urgentCount}</p>
          <span className="text-[10px] text-u-danger font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Priority escalated
          </span>
        </div>

        <div className="p-4 bg-u-card border border-u-line rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">
            Open Tickets
          </span>
          <p className="text-2xl font-extrabold text-u-ink">{openCount + inProgressCount}</p>
          <span className="text-[10px] text-u-muted">{inProgressCount} in progress</span>
        </div>

        <div className="p-4 bg-u-card border border-u-line rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">
            Assigned to Me
          </span>
          <p className="text-2xl font-extrabold text-u-violet">{assignedToMeCount}</p>
          <span className="text-[10px] text-u-muted">Your direct queue</span>
        </div>

        <div className="p-4 bg-u-card border border-u-line rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">
            Avg First Response
          </span>
          <p className="text-2xl font-extrabold text-u-ok">18 min</p>
          <span className="text-[10px] text-u-ok font-medium">Target: &lt; 60 min</span>
        </div>

        <div className="p-4 bg-u-card border border-u-line rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">
            Resolution Rate
          </span>
          <p className="text-2xl font-extrabold text-u-blue">
            {Math.round((resolvedCount / Math.max(totalConvs, 1)) * 100)}%
          </p>
          <span className="text-[10px] text-u-muted">{resolvedCount} resolved</span>
        </div>
      </div>

      {/* Middle Grid: Multi-Channel Distribution & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Multi-Channel Message Gateway Volume */}
        <div className="p-5 bg-u-card border border-u-line rounded-2xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-u-line pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-u-accent" />
              <h3 className="font-bold text-u-ink text-sm">
                Multi-Channel Communications Distribution
              </h3>
            </div>
            <span className="text-xs text-u-muted">Total: {totalConvs} Threads</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-u-accent">
                  <span>✉️</span> <span>Email Gateway (Official Notices & Leases)</span>
                </span>
                <span>{channelCounts.email} threads</span>
              </div>
              <div className="w-full h-2.5 bg-u-s3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-u-accent rounded-full"
                  style={{ width: `${(channelCounts.email / Math.max(totalConvs, 1)) * 100}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-u-ok">
                  <span>💬</span> <span>SMS Dispatch (Urgent Repairs & Access)</span>
                </span>
                <span>{channelCounts.sms} threads</span>
              </div>
              <div className="w-full h-2.5 bg-u-s3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-u-ok rounded-full"
                  style={{ width: `${(channelCounts.sms / Math.max(totalConvs, 1)) * 100}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-u-blue">
                  <span>📱</span> <span>WhatsApp Business (Contractor & Vendor Coordination)</span>
                </span>
                <span>{channelCounts.whatsapp} threads</span>
              </div>
              <div className="w-full h-2.5 bg-u-s3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-u-blue rounded-full"
                  style={{ width: `${(channelCounts.whatsapp / Math.max(totalConvs, 1)) * 100}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-u-accent">
                  <span>🔔</span> <span>In-App Resident Portal & Internal Notes</span>
                </span>
                <span>{channelCounts.in_app} threads</span>
              </div>
              <div className="w-full h-2.5 bg-u-s3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-u-accent rounded-full"
                  style={{ width: `${(channelCounts.in_app / Math.max(totalConvs, 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Volume by Category */}
        <div className="p-5 bg-u-card border border-u-line rounded-2xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-u-line pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-u-violet" />
              <h3 className="font-bold text-u-ink text-sm">Conversation Categories</h3>
            </div>
            <span className="text-xs text-u-muted">{Object.keys(categoryCounts).length} Categories</span>
          </div>

          <div className="space-y-2.5">
            {Object.entries(categoryCounts).map(([cat, count]) => {
              const pct = Math.round((count / Math.max(totalConvs, 1)) * 100);
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-u-ink2">{cat}</span>
                    <span className="font-bold text-u-ink">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-u-s3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-u-violet rounded-full"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Staff Load & SLA Target Table */}
      <div className="p-5 bg-u-card border border-u-line rounded-2xl shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-u-line pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-u-accent" />
            <h3 className="font-bold text-u-ink text-sm">Staff Conversation Distribution</h3>
          </div>
          <span className="text-xs text-u-muted">Current active workload</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {staffCounts.map(({ staff, count }) => (
            <div
              key={staff.id}
              className="p-3.5 bg-u-s2 border border-u-line rounded-xl space-y-2"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-u-accent-soft text-u-accent font-bold text-xs flex items-center justify-center shrink-0">
                  {staff.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-u-ink truncate">{staff.name}</p>
                  <p className="text-[10px] text-u-muted truncate">{staff.title}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-u-line/60">
                <span className="text-u-muted text-[11px]">Assigned Queue:</span>
                <span className="font-extrabold text-u-accent">{count} Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
