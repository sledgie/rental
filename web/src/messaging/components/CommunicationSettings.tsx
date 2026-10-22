import React, { useState } from 'react';
import {
  Settings,
  CheckCircle2,
  Clock,
  Bell,
  Save,
  Info,
  Server,
} from 'lucide-react';

export const CommunicationSettings: React.FC = () => {
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [autoReplyMessage, setAutoReplyMessage] = useState(
    'Thank you for reaching RentPulse Management. We have received your message. If this is an urgent life safety or water emergency, our emergency on-call team has been paged immediately.'
  );
  const [urgentSlaMinutes, setUrgentSlaMinutes] = useState(60);
  const [normalSlaHours, setNormalSlaHours] = useState(24);
  const [savedNotification, setSavedNotification] = useState(false);

  const handleSave = () => {
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2500);
  };

  return (
    <div className="flex-1 h-full bg-u-s2 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-u-line">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-u-accent" />
            <h1 className="text-lg sm:text-xl font-bold text-u-ink">
              Communication Gateway & SLA Settings
            </h1>
          </div>
          <p className="text-xs text-u-muted mt-0.5">
            Configure multi-channel message delivery, automated responders, and service targets.
          </p>
        </div>

        {savedNotification && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-u-ok-soft text-u-ok text-xs font-bold rounded-lg animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-u-ok" />
            <span>Settings Saved (Session Mock)</span>
          </span>
        )}
      </div>

      {/* Simulated Multi-Channel Status Card */}
      <div className="p-5 bg-u-card border border-u-line rounded-2xl shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-u-line pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-u-accent" />
            <h3 className="font-bold text-u-ink text-sm">
              Multi-Channel Dispatcher Gateways (Simulated Sandbox)
            </h3>
          </div>
          <span className="text-[11px] font-mono bg-u-ok-soft text-u-ok px-2.5 py-0.5 rounded-full font-bold border border-u-ok/30">
            All 4 Channels Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* SMS */}
          <div className="p-3.5 bg-u-s2 border border-u-line rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-u-ink flex items-center gap-1.5">
                <span>💬</span> <span>SMS Dispatch Gateway</span>
              </span>
              <span className="text-[10px] bg-u-ok-soft text-u-ok font-bold px-1.5 py-0.5 rounded">
                Twilio Mock Active
              </span>
            </div>
            <p className="text-u-muted text-[11px]">
              Simulated phone number: <code>+1 (555) 019-2831</code>
            </p>
            <p className="text-[10px] text-u-muted">
              Dispatches instant text alerts to active tenant mobile numbers with zero telco latency.
            </p>
          </div>

          {/* WhatsApp */}
          <div className="p-3.5 bg-u-s2 border border-u-line rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-u-ink flex items-center gap-1.5">
                <span>📱</span> <span>WhatsApp Cloud API</span>
              </span>
              <span className="text-[10px] bg-u-blue-soft text-u-blue font-bold px-1.5 py-0.5 rounded">
                Meta Sandbox Linked
              </span>
            </div>
            <p className="text-u-muted text-[11px]">
              WABA Account ID: <code>WABA-882194-RP</code>
            </p>
            <p className="text-[10px] text-u-muted">
              Supports contractor photo sharing, read receipts, and rapid maintenance coordination.
            </p>
          </div>

          {/* Email */}
          <div className="p-3.5 bg-u-s2 border border-u-line rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-u-ink flex items-center gap-1.5">
                <span>✉️</span> <span>Email SMTP / Transactional</span>
              </span>
              <span className="text-[10px] bg-u-accent-soft text-u-accent font-bold px-1.5 py-0.5 rounded">
                SendGrid Ready
              </span>
            </div>
            <p className="text-u-muted text-[11px]">
              From Address: <code>notifications@rentpulse.com</code>
            </p>
            <p className="text-[10px] text-u-muted">
              Generates formal lease renewals, rent statements, and itemized billing accounting.
            </p>
          </div>

          {/* Portal */}
          <div className="p-3.5 bg-u-s2 border border-u-line rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-u-ink flex items-center gap-1.5">
                <span>🔔</span> <span>In-App Resident Portal & Staff Chat</span>
              </span>
              <span className="text-[10px] bg-u-accent-soft text-u-accent font-bold px-1.5 py-0.5 rounded">
                WebSocket Emulated
              </span>
            </div>
            <p className="text-u-muted text-[11px]">
              Privacy Engine: <code>Internal Notes Encrypted</code>
            </p>
            <p className="text-[10px] text-u-muted">
              Guarantees strict separation: tenants never see internal property management remarks.
            </p>
          </div>
        </div>

        <div className="p-3 bg-u-accent-soft/70 border border-u-accent/30 rounded-xl flex items-start gap-2.5 text-xs text-u-accent">
          <Info className="w-4 h-4 text-u-accent shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>Architecture Notice:</strong> The frontend message dispatchers are structured with complete data contracts so they can be immediately connected to backend WebSockets, Twilio Webhooks, or AWS SES without redesigning UI state models.
          </p>
        </div>
      </div>

      {/* SLA & Response Targets */}
      <div className="p-5 bg-u-card border border-u-line rounded-2xl shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-u-line pb-3">
          <Clock className="w-4 h-4 text-u-warn" />
          <h3 className="font-bold text-u-ink text-sm">
            Service Level Agreement (SLA) & Overdue Deadlines
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-u-ink2 mb-1">
              Urgent Maintenance Response Target (Minutes)
            </label>
            <input
              type="number"
              value={urgentSlaMinutes}
              onChange={(e) => setUrgentSlaMinutes(Number(e.target.value))}
              className="w-full p-2.5 bg-u-s2 border border-u-line rounded-xl font-semibold"
            />
            <p className="text-[10px] text-u-muted mt-1">
              Emergency plumbing, gas, electrical, or lockouts alert supervisors if unassigned after this window.
            </p>
          </div>

          <div>
            <label className="block font-bold text-u-ink2 mb-1">
              Normal Inquiry Target (Hours)
            </label>
            <input
              type="number"
              value={normalSlaHours}
              onChange={(e) => setNormalSlaHours(Number(e.target.value))}
              className="w-full p-2.5 bg-u-s2 border border-u-line rounded-xl font-semibold"
            />
            <p className="text-[10px] text-u-muted mt-1">
              General lease inquiries, parking changes, or billing balance questions.
            </p>
          </div>
        </div>
      </div>

      {/* Automated Out-of-Office Responder */}
      <div className="p-5 bg-u-card border border-u-line rounded-2xl shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-u-line pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-u-violet" />
            <h3 className="font-bold text-u-ink text-sm">
              Automated Out-of-Hours Auto-Responder
            </h3>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoReplyEnabled}
              onChange={(e) => setAutoReplyEnabled(e.target.checked)}
              className="w-4 h-4 text-u-accent rounded"
            />
            <span className="text-xs font-bold text-u-ink2">Enabled</span>
          </label>
        </div>

        <div className="space-y-2 text-xs">
          <label className="block font-bold text-u-ink2">
            Auto-Reply Message Body
          </label>
          <textarea
            rows={3}
            value={autoReplyMessage}
            onChange={(e) => setAutoReplyMessage(e.target.value)}
            className="w-full p-3 bg-u-s2 border border-u-line rounded-xl text-u-ink"
          />
          <p className="text-[11px] text-u-muted">
            Automatically replies to inbound resident SMS and emails received outside 8:30 AM – 5:30 PM.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-u-accent hover:bg-u-accent-strong text-u-onaccent rounded-xl text-xs font-bold shadow-sm shadow-u-accent transition-all active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>Save Gateway Configurations</span>
        </button>
      </div>
    </div>
  );
};
