-- Add PayUnit.net to integration providers
INSERT INTO integration_providers (
  name,
  display_name,
  description,
  category,
  status,
  icon_url,
  credentials_schema,
  webhook_event_types,
  test_mode_supported,
  rate_limit_per_minute,
  created_at
) VALUES (
  'payunit',
  'PayUnit.net',
  'Global payment processing platform with support for cards, wallets, and regional methods. Covers 200+ countries with real-time settlement and instant notifications.',
  'payments',
  'active',
  'https://payunit.net/logo.png',
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
  '["payment.succeeded", "payment.failed", "refund.completed", "payment.pending"]',
  true,
  1000,
  now()
) ON CONFLICT (name) DO NOTHING;

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

CREATE POLICY payunit_webhooks_multi_tenant ON payunit_webhooks
  FOR ALL USING (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE id = auth.uid()::uuid 
        OR id IN (
          SELECT tenant_id FROM users 
          WHERE id = auth.uid()
        )
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS payunit_webhooks_tenant_idx ON payunit_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS payunit_webhooks_reference_idx ON payunit_webhooks(transaction_reference);
CREATE INDEX IF NOT EXISTS payunit_webhooks_created_idx ON payunit_webhooks(created_at DESC);
