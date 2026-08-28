-- BUG FIX: migration 0035 ("add_payunit_integration") inserted into
-- public.integration_providers using columns that do not exist on that
-- table: name, display_name, credentials_schema, status, icon_url.
-- The real table (see migration 0031) uses: provider_key, provider_name,
-- auth_type, auth_schema, is_active, logo_url. That INSERT fails against
-- the real schema, so PayUnit never actually got a provider row — it
-- could never appear as a connectable payment method anywhere in the app.
--
-- This migration re-inserts PayUnit with the correct columns. It's safe to
-- run whether or not 0035's INSERT partially succeeded, thanks to
-- ON CONFLICT (provider_key) DO NOTHING and IF NOT EXISTS everywhere else.

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support, requires_setup,
  rate_limit_per_minute
) VALUES (
  'payunit',
  'PayUnit.net',
  'Plateforme de paiement mondiale : cartes, portefeuilles mobiles et moyens de paiement régionaux, avec règlement en temps réel.',
  'https://payunit.net/logo.png',
  'https://docs.payunit.net',
  'payments', 'mobile_money',
  'api_key_secret',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"Clé API"},"merchant_id":{"type":"string","title":"ID marchand"},"test_mode":{"type":"boolean","title":"Mode test","default":true}},"required":["api_key","merchant_id"]}'::jsonb,
  ARRAY['payments', 'refunds', 'webhooks', 'mobile_money'],
  'basic', true, true, true, false,
  1000
) ON CONFLICT (provider_key) DO NOTHING;

-- Ensure the PayUnit webhook log table + RLS + indexes exist regardless of
-- whether 0035 got that far before its INSERT failed (all idempotent).
CREATE TABLE IF NOT EXISTS public.payunit_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  webhook_id text NOT NULL,
  event_type text NOT NULL,
  transaction_reference text NOT NULL,
  payload jsonb NOT NULL,
  status text DEFAULT 'received',
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payunit_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payunit_webhooks_multi_tenant ON public.payunit_webhooks;
CREATE POLICY payunit_webhooks_multi_tenant ON public.payunit_webhooks
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS payunit_webhooks_tenant_idx ON public.payunit_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS payunit_webhooks_reference_idx ON public.payunit_webhooks(transaction_reference);
CREATE INDEX IF NOT EXISTS payunit_webhooks_created_idx ON public.payunit_webhooks(created_at DESC);
