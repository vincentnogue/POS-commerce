-- Notification settings — the missing link between "connect an
-- integration" and "the integration actually does something".
--
-- Audit finding: of the 25 real providers in integration_providers,
-- connecting one only ever writes a row to integration_connections and
-- flips a green "Connected" badge. Nothing anywhere in the app reads that
-- connection afterwards — including notifications-twilio, a fully working
-- edge function (real Twilio API calls, real per-tenant credential
-- decryption) that no frontend code has ever called. A tenant connecting
-- WhatsApp/Twilio today gets literally nothing beyond the badge.
--
-- This migration adds the tenant-level switch; the actual call site is
-- wired into POSPage at checkout in the same commit. Scoped to Twilio only
-- for now (the one comms provider with a working send function) — the
-- whatsapp_business provider (official Meta Cloud API) has no backend
-- implementation yet and connecting it still won't send anything; that's
-- a separate, larger piece of work, not something this migration should
-- pretend to solve by reusing this flag.
alter table public.tenants
  add column if not exists notification_settings jsonb not null default '{"auto_send_receipt_whatsapp": false}'::jsonb;
