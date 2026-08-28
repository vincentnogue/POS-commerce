-- Add PayUnit.net to integration providers
--
-- BUG FIX: this INSERT used to target columns that don't exist on
-- public.integration_providers (name, display_name, credentials_schema,
-- status, icon_url, webhook_event_types, test_mode_supported) — the real
-- table (see migration 0031) uses provider_key, provider_name, auth_type,
-- auth_schema, is_active, logo_url, capabilities, and has no
-- webhook_event_types/test_mode_supported columns at all. This made
-- 'supabase db push' fail with "column \"name\" of relation
-- \"integration_providers\" does not exist" on every run, aborting before
-- any later migration (including the exchange-rates edge function deploy)
-- could run. Rewritten against the real schema; ON CONFLICT now targets the
-- real unique column (provider_key, not name).
INSERT INTO public.integration_providers (
  provider_key,
  provider_name,
  description,
  category,
  subcategory,
  logo_url,
  auth_type,
  auth_schema,
  capabilities,
  webhook_support,
  rate_limit_per_minute,
  is_active,
  created_at
) VALUES (
  'payunit',
  'PayUnit.net',
  'Global payment processing platform with support for cards, wallets, and regional methods. Covers 200+ countries with real-time settlement and instant notifications.',
  'payments',
  'mobile_money',
  'https://payunit.net/logo.png',
  'api_key_secret',
  '{
    "type": "object",
    "properties": {
      "api_key": {
        "type": "string",
        "title": "API Key",
        "description": "Your PayUnit API key from dashboard"
      },
      "merchant_id": {
        "type": "string",
        "title": "Merchant ID",
        "description": "Your unique merchant identifier"
      },
      "test_mode": {
        "type": "boolean",
        "title": "Test Mode",
        "description": "Use sandbox environment for testing",
        "default": true
      }
    },
    "required": ["api_key", "merchant_id"]
  }'::jsonb,
  ARRAY['payments', 'refunds', 'webhooks', 'mobile_money'],
  true,
  1000,
  true,
  now()
) ON CONFLICT (provider_key) DO NOTHING;

-- Create PayUnit-specific webhook events log table
CREATE TABLE IF NOT EXISTS payunit_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  webhook_id text NOT NULL,
  event_type text NOT NULL,
  transaction_reference text NOT NULL,
  payload jsonb NOT NULL,
  status text DEFAULT 'received',
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS for PayUnit webhooks
ALTER TABLE payunit_webhooks ENABLE ROW LEVEL SECURITY;

-- BUG FIX: this policy used to reference a nonexistent `users` table
-- (`SELECT tenant_id FROM users WHERE id = auth.uid()`) and compared a
-- tenant's own id directly to auth.uid(), neither of which matches this
-- app's real multi-tenant model. Fixed to use tenant_members like every
-- other RLS policy in this codebase.
DROP POLICY IF EXISTS payunit_webhooks_multi_tenant ON payunit_webhooks;
CREATE POLICY payunit_webhooks_multi_tenant ON payunit_webhooks
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS payunit_webhooks_tenant_idx ON payunit_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS payunit_webhooks_reference_idx ON payunit_webhooks(transaction_reference);
CREATE INDEX IF NOT EXISTS payunit_webhooks_created_idx ON payunit_webhooks(created_at DESC);
