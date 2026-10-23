# Supabase Edge Functions

| Function | What it does | JWT check |
|---|---|---|
| `send-sms` | Sends one text message through Twilio for a signed-in staff member, and records it in `communication_logs` | on (default) |
| `twilio-status` | Receives Twilio's delivery receipts and marks the message delivered / failed | **off**: Twilio cannot sign in; every request is verified with `X-Twilio-Signature` instead |

The Twilio credentials live only in the function secrets — never in the web app, the repository or chat.

## One-time setup

Run these from the repository root (the folder that contains `supabase/`). `npx supabase` works without installing anything globally.

1. **Sign in and link your project** (the project ref is in your Supabase URL: `https://<ref>.supabase.co`):

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   ```

2. **Store the Twilio secrets** (values from the Twilio Console → Account info; the number from Phone Numbers → Active numbers):

   ```bash
   npx supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx TWILIO_FROM_NUMBER=+15551234567
   ```

   With a Twilio Messaging Service, set `TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxx` instead of `TWILIO_FROM_NUMBER`.

3. **Deploy the functions**:

   ```bash
   npx supabase functions deploy send-sms
   npx supabase functions deploy twilio-status --no-verify-jwt
   ```

## What sends a text

* **Message Templates → Test send** on an SMS template: texts the number entered in the dialog.
* **Messages**: a reply or new conversation on the **SMS** channel (not an internal note) is texted to every participant outside your team who has a mobile number on file. Tenants who turned SMS off or withdrew consent (`tenant_communication_preferences`) are skipped.

Not yet: announcements, automation rules (no background worker) and email.

## Trial accounts

A Twilio trial account can only text numbers you have verified in the Twilio Console, and adds a "Sent from your Twilio trial account" prefix.
For Canadian and US numbers, sending at volume requires toll-free verification or A2P 10DLC registration in Twilio.
