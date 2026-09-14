-- Follow-up to 0098, triggered by a live report: "Provider gmail not
-- supported yet". Same root cause, same fix — but this time checked
-- EVERY provider_key actually present in supabase/migrations/ (not just
-- the ones already suspected) against real backend code.
--
-- gmail / google_drive: oauth2 auth_type but the auth_schema only
--   collects an email address — no client_id/secret, no token exchange
--   at all, so even the "connect" flow was incomplete by construction.
--   Zero backend code anywhere sends an email via Gmail or backs up to
--   Drive.
-- zapier: no outbound-event dispatcher anywhere in the codebase.
-- paddle (as a tenant-connectable marketplace app): paddle-checkout
--   exists, but it's exclusively POS Flow's OWN platform subscription
--   billing (/subscribe), reading a platform-level PADDLE_API_KEY env
--   var — never a tenant's own connected credentials. No
--   paddle-payments function (the tenant-facing equivalent of
--   stripe-payments/flutterwave-payments) exists. Deactivating this
--   marketplace entry does not touch platform billing at all.
-- liafrik_ai_insights: zero usage anywhere outside its own catalog row.
-- posflow_api / posflow_webhooks: promise "build custom integrations via
--   our REST API" / "send custom webhooks for platform events" — neither
--   a public REST API nor an outbound webhook dispatcher exists in this
--   codebase.
update public.integration_providers
set is_active = false
where provider_key in ('gmail', 'google_drive', 'zapier', 'paddle', 'liafrik_ai_insights', 'posflow_api', 'posflow_webhooks');
