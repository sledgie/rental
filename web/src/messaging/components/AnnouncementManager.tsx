import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Announcement, Priority, MessageCategory, ChannelType } from '../types';
import {
  Megaphone,
  Plus,
  AlertTriangle,
  Check,
  Send,
} from 'lucide-react';
import { formatDate, getPriorityBadge } from '../utils/formatters';

export const AnnouncementManager: React.FC = () => {
  const {
    announcements,
    properties,
    currentUser,
    createAnnouncement,
    publishAnnouncement,
    acknowledgeAnnouncement,
  } = useApp();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(
    announcements[0] || null
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New announcement form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category] = useState<MessageCategory>('Property Announcement');
  const [priority, setPriority] = useState<Priority>('normal');
  const [targetAudience, setTargetAudience] = useState<
    'all_tenants' | 'property_tenants' | 'unit_tenants' | 'owners' | 'staff' | 'vendors'
  >('property_tenants');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(['prop_highland']);
  const [acknowledgementRequired, setAcknowledgementRequired] = useState(true);
  const [scheduledDate] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<ChannelType[]>([
    'in_app',
    'sms',
    'email',
  ]);

  const filteredAnnouncements = announcements.filter((a) => {
    if (filterStatus === 'all') return true;
    return a.status === filterStatus;
  });

  // Calculate estimated recipients
  const getEstimatedRecipientsCount = (aud: string, propIds: string[]) => {
    if (aud === 'all_tenants') {
      return properties.reduce((acc, p) => acc + p.occupiedCount, 0);
    }
    if (aud === 'property_tenants') {
      return properties
        .filter((p) => propIds.includes(p.id))
        .reduce((acc, p) => acc + p.occupiedCount, 0);
    }
    if (aud === 'owners') return 4;
    if (aud === 'vendors') return 8;
    if (aud === 'staff') return 5;
    return 10;
  };

  const handleCreateAnnouncement = (isPublishImmediate: boolean) => {
    if (!title.trim() || !body.trim()) {
      alert('Please fill out the title and message content');
      return;
    }

    createAnnouncement({
      title: title.trim(),
      body: body.trim(),
      category,
      targetAudience,
      targetPropertyIds: selectedPropertyIds,
      priority,
      acknowledgementRequired,
      status: isPublishImmediate ? 'published' : scheduledDate ? 'scheduled' : 'draft',
      scheduledAt: scheduledDate || undefined,
      publishedAt: isPublishImmediate ? new Date().toISOString() : undefined,
      channels: selectedChannels,
    });

    setIsCreateModalOpen(false);
    setTitle('');
    setBody('');
  };

  const toggleProperty = (id: string) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleChannel = (ch: ChannelType) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full bg-u-card overflow-hidden">
      {/* Left List of Announcements */}
      <div className="w-96 shrink-0 border-r border-u-line flex flex-col h-full bg-u-s2/50">
        {/* Header */}
        <div className="p-4 border-b border-u-line bg-u-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-u-violet" />
              <h2 className="text-base font-bold text-u-ink">Property Notices</h2>
            </div>
            {currentUser.isStaff && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-u-violet hover:bg-u-violet text-u-onaccent rounded-lg shadow-sm shadow-u-violet transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Notice</span>
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-u-s3 p-1 rounded-lg text-xs overflow-x-auto">
            {['all', 'published', 'scheduled', 'draft'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-md font-semibold capitalize whitespace-nowrap transition-colors ${
                  filterStatus === st
                    ? 'bg-u-card text-u-ink shadow-2xs'
                    : 'text-u-muted hover:text-u-ink'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-u-line">
          {filteredAnnouncements.length === 0 ? (
            <div className="p-8 text-center text-xs text-u-muted">
              No notices match this status.
            </div>
          ) : (
            filteredAnnouncements.map((ann) => {
              const isSelected = selectedAnnouncement?.id === ann.id;
              const priority = getPriorityBadge(ann.priority);
              const isAcknowledgedByMe = ann.acknowledgedUserIds.includes(currentUser.id);

              return (
                <div
                  key={ann.id}
                  onClick={() => setSelectedAnnouncement(ann)}
                  className={`p-4 cursor-pointer transition-colors border-l-4 ${
                    isSelected
                      ? 'bg-u-violet/10 border-l-u-violet'
                      : 'bg-u-card border-l-transparent hover:bg-u-s2'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        ann.status === 'published'
                          ? 'bg-u-ok-soft text-u-ok'
                          : ann.status === 'scheduled'
                          ? 'bg-u-accent-soft text-u-accent'
                          : 'bg-u-line text-u-ink2'
                      }`}
                    >
                      {ann.status}
                    </span>
                    <span className="text-[10px] text-u-muted">
                      {formatDate(ann.publishedAt || ann.scheduledAt || ann.createdAt)}
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-bold text-u-ink line-clamp-1 mb-1">
                    {ann.title}
                  </h3>
                  <p className="text-xs text-u-muted line-clamp-2 mb-2">{ann.body}</p>

                  <div className="flex items-center justify-between text-[10px] text-u-muted">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold ${priority.text}`}>
                        ● {priority.label}
                      </span>
                      <span>•</span>
                      <span>{ann.targetAudience.replace('_', ' ')}</span>
                    </div>

                    {ann.acknowledgementRequired && (
                      <span
                        className={`font-semibold ${
                          isAcknowledgedByMe ? 'text-u-ok' : 'text-u-warn'
                        }`}
                      >
                        {isAcknowledgedByMe ? '✓ Acknowledged' : 'Ack Required'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Detail & Acknowledgement Tracker */}
      <div className="flex-1 flex flex-col h-full bg-u-card overflow-y-auto p-6 space-y-6">
        {selectedAnnouncement ? (
          <>
            {/* Header */}
            <div className="space-y-2 border-b border-u-line pb-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${
                      selectedAnnouncement.status === 'published'
                        ? 'bg-u-ok-soft text-u-ok'
                        : selectedAnnouncement.status === 'scheduled'
                        ? 'bg-u-accent-soft text-u-accent'
                        : 'bg-u-line text-u-ink2'
                    }`}
                  >
                    {selectedAnnouncement.status}
                  </span>
                  <span className="text-xs text-u-muted">
                    Broadcasted via:{' '}
                    <strong>{selectedAnnouncement.channels.join(', ').toUpperCase()}</strong>
                  </span>
                </div>

                {currentUser.isStaff && selectedAnnouncement.status === 'draft' && (
                  <button
                    onClick={() => publishAnnouncement(selectedAnnouncement.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-u-ok hover:bg-u-ok text-u-onaccent rounded-lg shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish Immediately</span>
                  </button>
                )}
              </div>

              <h1 className="text-lg sm:text-xl font-extrabold text-u-ink leading-snug">
                {selectedAnnouncement.title}
              </h1>

              <div className="flex items-center gap-4 text-xs text-u-muted pt-1 flex-wrap">
                <span>Created: {formatDate(selectedAnnouncement.createdAt)}</span>
                {selectedAnnouncement.publishedAt && (
                  <span>Published: {formatDate(selectedAnnouncement.publishedAt)}</span>
                )}
                <span>Category: {selectedAnnouncement.category}</span>
                <span>Audience: {selectedAnnouncement.targetAudience.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Announcement Message Body */}
            <div className="p-5 bg-u-s2 rounded-2xl border border-u-line space-y-3">
              <p className="text-xs font-bold uppercase text-u-muted">Notice Body</p>
              <div className="whitespace-pre-wrap text-sm text-u-ink leading-relaxed font-sans">
                {selectedAnnouncement.body}
              </div>
            </div>

            {/* Resident Acknowledgement Action Card */}
            {selectedAnnouncement.acknowledgementRequired && (
              <div className="p-4 rounded-xl border border-u-warn/30 bg-u-warn-soft/60 flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-u-warn" />
                    <h4 className="text-xs font-bold text-u-warn">
                      Mandatory Resident Acknowledgement Required
                    </h4>
                  </div>
                  <p className="text-[11px] text-u-warn">
                    Residents must confirm receipt of this safety or utility interruption notice.
                  </p>
                </div>

                {selectedAnnouncement.acknowledgedUserIds.includes(currentUser.id) ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-u-ok-soft text-u-ok rounded-lg text-xs font-bold">
                    <Check className="w-4 h-4 text-u-ok" />
                    <span>You Acknowledged This Notice</span>
                  </div>
                ) : (
                  <button
                    onClick={() => acknowledgeAnnouncement(selectedAnnouncement.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-u-warn hover:bg-u-warn text-u-onaccent rounded-lg text-xs font-bold shadow-sm transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Acknowledge as {currentUser.name}</span>
                  </button>
                )}
              </div>
            )}

            {/* Acknowledgement Status Audit Table (Staff view) */}
            {currentUser.isStaff && selectedAnnouncement.acknowledgementRequired && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink2">
                    Acknowledgement Audit & Delivery Tracking
                  </h3>
                  <span className="text-xs font-semibold text-u-accent">
                    {selectedAnnouncement.acknowledgedUserIds.length} Confirmed Receipts
                  </span>
                </div>

                <div className="border border-u-line rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-u-s2 text-u-muted border-b border-u-line font-semibold">
                      <tr>
                        <th className="p-3">Resident / Contact</th>
                        <th className="p-3">Unit / Property</th>
                        <th className="p-3">Delivery Status</th>
                        <th className="p-3">Acknowledgement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-u-line text-u-ink2">
                      <tr>
                        <td className="p-3 font-bold">Marcus Vance</td>
                        <td className="p-3">Highland Towers • Unit 4B</td>
                        <td className="p-3 text-u-ok font-semibold">Simulated Delivered (SMS)</td>
                        <td className="p-3">
                          {selectedAnnouncement.acknowledgedUserIds.includes('usr_tenant_1') ? (
                            <span className="text-u-ok font-bold bg-u-ok-soft px-2 py-0.5 rounded border border-u-ok/30">
                              ✓ Acknowledged (Demo)
                            </span>
                          ) : (
                            <span className="text-u-muted font-medium">Pending response</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold">Liam O'Connor</td>
                        <td className="p-3">Oakridge Commons • Unit 201</td>
                        <td className="p-3 text-u-ok font-semibold">Simulated Delivered (Email)</td>
                        <td className="p-3">
                          {selectedAnnouncement.acknowledgedUserIds.includes('usr_tenant_2') ? (
                            <span className="text-u-ok font-bold bg-u-ok-soft px-2 py-0.5 rounded border border-u-ok/30">
                              ✓ Acknowledged
                            </span>
                          ) : (
                            <span className="text-u-muted font-medium">Pending response</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-u-muted">
            Select a notice to view details.
          </div>
        )}
      </div>

      {/* Create Announcement Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-u-ink2/60 p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-u-card rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-u-line space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-u-line pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-u-violet" />
                <h3 className="font-bold text-u-ink text-sm">Create Property Announcement</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-u-muted hover:text-u-ink2 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-u-ink2 mb-1">Notice Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Domestic Cold Water Valve Maintenance Notice"
                  className="w-full p-2.5 bg-u-s2 border border-u-line rounded-xl text-xs text-u-ink focus:outline-none focus:ring-2 focus:ring-u-violet/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-u-ink2 mb-1">Target Audience</label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as any)}
                    className="w-full p-2.5 bg-u-s2 border border-u-line rounded-xl text-xs text-u-ink focus:outline-none"
                  >
                    <option value="property_tenants">Specific Property Tenants</option>
                    <option value="all_tenants">All Active Tenants (All Properties)</option>
                    <option value="owners">Property Owners / Landlords</option>
                    <option value="staff">Internal Staff Only</option>
                    <option value="vendors">Contractors & Vendors</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-u-ink2 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full p-2.5 bg-u-s2 border border-u-line rounded-xl text-xs text-u-ink focus:outline-none"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Property Selectors */}
              {targetAudience === 'property_tenants' && (
                <div>
                  <label className="block font-bold text-u-ink2 mb-1">Select Properties</label>
                  <div className="flex flex-wrap gap-2">
                    {properties.map((p) => {
                      const isSel = selectedPropertyIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProperty(p.id)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                            isSel
                              ? 'bg-u-violet/15 text-u-violet border-u-violet/30 font-bold'
                              : 'bg-u-card text-u-ink2 border-u-line'
                          }`}
                        >
                          {p.name} ({p.occupiedCount} units)
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Delivery Channels */}
              <div>
                <label className="block font-bold text-u-ink2 mb-1">Broadcast Channels</label>
                <div className="flex gap-2">
                  {(['in_app', 'sms', 'email'] as ChannelType[]).map((ch) => {
                    const isSel = selectedChannels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => toggleChannel(ch)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize ${
                          isSel
                            ? 'bg-u-violet/15 text-u-violet border-u-violet/30'
                            : 'bg-u-card text-u-muted border-u-line'
                        }`}
                      >
                        {ch === 'in_app' ? 'In-App Portal' : ch.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Estimated Recipients Pill */}
              <div className="p-2.5 bg-u-violet/15 border border-u-violet/30 rounded-xl text-xs text-u-violet font-medium">
                📊 Estimated Audience Reach:{' '}
                <strong>
                  {getEstimatedRecipientsCount(targetAudience, selectedPropertyIds)} verified residents
                </strong>
              </div>

              <div>
                <label className="block font-bold text-u-ink2 mb-1">Notice Content *</label>
                <textarea
                  required
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Detail the announcement, scheduled times, impact on residents, and instructions..."
                  className="w-full p-3 bg-u-s2 border border-u-line rounded-xl text-xs text-u-ink focus:outline-none focus:ring-2 focus:ring-u-violet/60"
                />
              </div>

              {/* Acknowledgement required toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acknowledgementRequired}
                  onChange={(e) => setAcknowledgementRequired(e.target.checked)}
                  className="w-4 h-4 text-u-violet rounded"
                />
                <span className="font-bold text-u-ink2 text-xs">
                  Require Resident Acknowledgement / Confirmation
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-u-line">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-u-s3 text-u-ink2 rounded-lg hover:bg-u-line"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateAnnouncement(false)}
                className="px-4 py-2 text-xs font-bold bg-u-line hover:bg-u-line text-u-ink rounded-lg"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleCreateAnnouncement(true)}
                className="px-4 py-2 text-xs font-bold bg-u-violet hover:bg-u-violet text-u-onaccent rounded-lg shadow-sm"
              >
                Publish Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
