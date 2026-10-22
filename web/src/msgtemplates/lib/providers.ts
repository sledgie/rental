import type { Channel, CommunicationLog } from "./types";

export type DispatchRequest = {
  channel: Channel;
  recipient: CommunicationLog["recipient"];
  subject: string;
  body: string;
  sender?: { name: string; email: string; replyTo?: string };
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

const providers: Record<Channel, CommunicationProvider> = {
  email: new UnconfiguredProvider("email"),
  sms: new UnconfiguredProvider("sms"),
  in_app: new UnconfiguredProvider("in_app"),
};

export function getProvider(channel: Channel) {
  return providers[channel];
}

export function getProviderStatuses() {
  return (Object.keys(providers) as Channel[]).map((channel) => ({ channel, name: providers[channel].name, configured: providers[channel].configured, environmentKey: channel === "email" ? "EMAIL_PROVIDER" : channel === "sms" ? "SMS_PROVIDER" : "IN_APP_PROVIDER" }));
}
