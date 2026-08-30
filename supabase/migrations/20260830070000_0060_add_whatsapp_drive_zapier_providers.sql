-- A retail/commerce POS marketplace commonly covers a few categories this
-- one didn't have yet: sending invoices/receipts by email, backing up
-- exports to cloud storage, and generic workflow automation. These are
-- real, well-known products; none of these rows claim a capability the
-- product doesn't have a real credential-storage + connection path for —
-- same pattern as every other row in seed_integrations.sql (github,
-- sentry, mixpanel, etc. are listed the same way: connectable, not deeply
-- custom-built per provider).
--
-- BUG FIX: this migration originally failed every deploy with
-- "null value in column auth_schema violates not-null constraint" — the
-- column list omitted auth_schema entirely even though it's NOT NULL on
-- integration_providers (see migration 0031). Added a real JSON schema
-- per provider, matching the auth_type each one declares.
--
-- Also removed a duplicate 'whatsapp_business' row: that provider already
-- exists from migration 0032, with a more complete OAuth2 definition
-- (business_account_id/phone_number_id/access_token) — inserting a second,
-- less complete definition under the same key would have either been
-- silently skipped by ON CONFLICT DO NOTHING (redundant) or, worse,
-- confusing if the schemas ever diverged.

insert into integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities, minimum_plan, is_featured, is_active
) values
  ('gmail', 'Gmail', 'Send invoices and receipts to customers from your own inbox',
   'https://cdn.simpleicons.org/gmail/EA4335',
   'https://developers.google.com/gmail/api',
   'communication', 'email', 'oauth2',
   '{"type":"object","properties":{"account_email":{"type":"string","title":"Gmail Address"}},"required":["account_email"]}'::jsonb,
   ARRAY['send_invoices', 'send_receipts'],
   'starter', FALSE, TRUE),

  ('google_drive', 'Google Drive', 'Back up your sales, stock and reports exports to the cloud',
   'https://cdn.simpleicons.org/googledrive/4285F4',
   'https://developers.google.com/drive',
   'storage', 'cloud_storage', 'oauth2',
   '{"type":"object","properties":{"account_email":{"type":"string","title":"Google Account"}},"required":["account_email"]}'::jsonb,
   ARRAY['backup_exports'],
   'pro', FALSE, TRUE),

  ('zapier', 'Zapier', 'Connect this platform to thousands of other apps without code',
   'https://cdn.simpleicons.org/zapier/FF4A00',
   'https://zapier.com/developer',
   'automation', 'workflow', 'api_key',
   '{"type":"object","properties":{"api_key":{"type":"string","title":"Zapier API Key"}},"required":["api_key"]}'::jsonb,
   ARRAY['workflow_automation'],
   'pro', FALSE, TRUE)
on conflict (provider_key) do nothing;
