import { isSupabaseConfigured } from "../../lib/supabase";
import { sendSms } from "../../lib/sms";
import type { Channel, CommunicationLog } from "./types";

export type DispatchRequest = {
  channel: Channel;
  recipient: CommunicationLog["recipient"];
  subject: string;
  body: string;
  sender?: { name: string; email: string; replyTo?: string };
  /** what the delivery record should point at */
  meta?: { templateId?: string | null; templateVersion?: number | null; triggerSource?: "manual" | "test"; category?: string | null };
};
export type DispatchResult = { ok: boolean; provider: string; providerMessageId?: string; code?: string; message?: string };
export interface CommunicationProvider {
  name: string;
  channel: Channel;
  configured: boolean;
  dispatch(request: DispatchRequest): Promise<DispatchResult>;
}

class UnconfiguredProvider implements CommunicationProvider {
  name = "Not configured";
  configured = false;
  constructor(public channel: Channel) {}
  async dispatch(): Promise<DispatchResult> {
    return {
      ok: false,
      provider: this.name,
      code: "PROVIDER_NOT_CONFIGURED",
      message: `No ${this.channel === "in_app" ? "realtime notification" : this.channel.toUpperCase()} delivery provider is connected. The message was not handed off or sent.`,
    };
  }
}

/** Text messages through Twilio, via the send-sms Edge Function (which also writes the delivery record). */
class TwilioSmsProvider implements CommunicationProvider {
  name = "Twilio";
  channel: Channel = "sms";
  configured = true;
  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    const result = await sendSms({
      to: request.recipient.phone, body: request.body, recipientName: request.recipient.name, templateId: request.meta?.templateId ?? null,
      templateVersion: request.meta?.templateVersion ?? null, triggerSource: request.meta?.triggerSource ?? "test", category: request.meta?.category ?? null,
    });
    return { ok: result.ok, provider: this.name, providerMessageId: result.providerMessageId, code: result.ok ? undefined : "TWILIO_ERROR", message: result.error };
  }
}

const providers: Record<Channel, CommunicationProvider> = {
  email: new UnconfiguredProvider("email"),
  sms: isSupabaseConfigured ? new TwilioSmsProvider() : new UnconfiguredProvider("sms"),
  in_app: new UnconfiguredProvider("in_app"),
};

export function getProvider(channel: Channel) {
  return providers[channel];
}

export function getProviderStatuses() {
  return (Object.keys(providers) as Channel[]).map((channel) => ({ channel, name: providers[channel].name, configured: providers[channel].configured, environmentKey: channel === "email" ? "EMAIL_PROVIDER" : channel === "sms" ? "SMS_PROVIDER" : "IN_APP_PROVIDER" }));
}
