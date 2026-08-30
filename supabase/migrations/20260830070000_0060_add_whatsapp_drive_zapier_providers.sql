-- A retail/commerce POS marketplace commonly covers a few categories this
-- one didn't have yet: sending customer-facing messages over WhatsApp
-- (very widely used for order/receipt updates in the markets this product
-- targets), backing up exports to cloud storage, and generic workflow
-- automation. All four are real, well-known products; none of these rows
-- claim a capability the product doesn't have a real credential-storage +
-- connection path for — same pattern as every other row in
-- seed_integrations.sql (github, sentry, mixpanel, etc. are listed the
-- same way: connectable, not deeply custom-built per provider).

insert into integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, capabilities, minimum_plan, is_featured, is_active
) values
  ('whatsapp_business', 'WhatsApp Business', 'Send receipts and order updates to customers over WhatsApp',
   'https://cdn.simpleicons.org/whatsapp/25D366',
   'https://developers.facebook.com/docs/whatsapp',
   'communication', 'messaging', 'api_key',
   ARRAY['send_receipts', 'order_updates'],
   'starter', TRUE, TRUE),

  ('gmail', 'Gmail', 'Send invoices and receipts to customers from your own inbox',
   'https://cdn.simpleicons.org/gmail/EA4335',
   'https://developers.google.com/gmail/api',
   'communication', 'email', 'oauth2',
   ARRAY['send_invoices', 'send_receipts'],
   'starter', FALSE, TRUE),

  ('google_drive', 'Google Drive', 'Back up your sales, stock and reports exports to the cloud',
   'https://cdn.simpleicons.org/googledrive/4285F4',
   'https://developers.google.com/drive',
   'storage', 'cloud_storage', 'oauth2',
   ARRAY['backup_exports'],
   'pro', FALSE, TRUE),

  ('zapier', 'Zapier', 'Connect this platform to thousands of other apps without code',
   'https://cdn.simpleicons.org/zapier/FF4A00',
   'https://zapier.com/developer',
   'automation', 'workflow', 'api_key',
   ARRAY['workflow_automation'],
   'pro', FALSE, TRUE)
on conflict (provider_key) do nothing;
