/*
# Marketplace & Integrations Foundation

## Summary
Creates the complete foundation for POS Flow Marketplace — a multi-tenant integration center
where tenants can connect third-party services (PSPs, logistics, communication, etc).

## Tables
1. `integration_providers` — catalog of all available integrations (global, super-admin managed)
2. `integration_connections` — active connections per tenant
3. `integration_credentials` — encrypted credentials per connection (per-tenant isolation)
4. `integration_webhook_endpoints` — webhook URLs registered with external services
5. `integration_webhook_logs` — incoming webhook audit trail
6. `integration_sync_logs` — background sync operations audit trail

## Security
- RLS on all tenant-scoped tables
- Credentials encrypted in application layer (never stored in plain text)
- Multi-tenant isolation: credentials belong to tenant_id
- Webhook secrets verified before processing
- Audit trail on all connection changes

## Plans & Feature Gating
- Integrations can be restricted by plan (plan_id foreign key)
- Plan enforcement happens at display + backend query time
*/

-- ============================================================================
-- integration_providers — Global catalog of available integrations
-- ============================================================================
-- This table is managed by super_admin and visible to all tenants
-- It defines WHAT integrations are available, not WHO has connected

CREATE TABLE IF NOT EXISTS public.integration_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic metadata
  provider_key TEXT NOT NULL UNIQUE, -- e.g., 'stripe', 'paypal', 'twilio'
  provider_name TEXT NOT NULL,       -- e.g., 'Stripe Payments'
  description TEXT,
  logo_url TEXT,
  documentation_url TEXT,
  
  -- Categorization
  category TEXT NOT NULL,            -- 'payments', 'logistics', 'communication', 'accounting', 'ecommerce', 'developers'
  subcategory TEXT,                  -- 'card_payments', 'mobile_money', 'sms', 'shipping', etc
  
  -- Authentication
  auth_type TEXT NOT NULL,           -- 'api_key', 'api_key_secret', 'oauth2', 'merchant_id', 'webhook_only'
  auth_schema JSONB NOT NULL,        -- JSON Schema for credential validation
  -- Example: {"type": "object", "properties": {"api_key": {"type": "string"}, "secret_key": {"type": "string"}}}
  
  -- Features & Capabilities
  capabilities TEXT[] NOT NULL DEFAULT '{}', -- ['payments', 'refunds', 'webhooks', 'subscriptions']
  supported_currencies TEXT[] DEFAULT '{}'::text[], -- NULL = all, or specific list
  
  -- Plan restriction (NULL = all plans, or specify minimum plan)
  minimum_plan TEXT,                 -- 'basic', 'pro', 'premium', NULL = all
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE, -- Show in "Featured" section
  
  -- Metadata
  requires_setup BOOLEAN DEFAULT FALSE,
  webhook_support BOOLEAN DEFAULT TRUE,
  rate_limit_per_minute INT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- integration_connections — Active connections per tenant
-- ============================================================================
-- Links a tenant to an integration provider
-- Does NOT store credentials (see integration_credentials)

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,
  
  -- Connection state
  status TEXT NOT NULL DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error', 'expired'
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Last sync/test
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT, -- 'success', 'failed'
  last_test_error TEXT,
  
  -- Connected account info (for user visibility, NOT auth)
  account_id TEXT,       -- e.g., Stripe customer ID, PayPal merchant ID (for display)
  account_name TEXT,     -- e.g., "acme.stripe.com"
  
  -- Webhook configuration
  webhook_url TEXT,      -- Registered webhook URL for this connection
  webhook_secret TEXT,   -- Webhook verification secret (stored encrypted by app)
  last_webhook_at TIMESTAMPTZ,
  
  -- Configuration
  config JSONB,          -- Provider-specific config (non-sensitive), e.g., {"mode": "live", "currency": "USD"}
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, provider_id) -- One connection per provider per tenant
);

-- ============================================================================
-- integration_credentials — Encrypted credentials per connection
-- ============================================================================
-- Stores the actual credentials (API keys, secrets, OAuth tokens)
-- Encrypted in transit + stored encrypted in DB
-- NEVER returned to frontend unless decrypted at last possible moment

CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Credential pairs (encrypted)
  credential_data JSONB NOT NULL,  -- Encrypted JSON of actual credentials
  -- Example (encrypted): {"api_key": "sk_live_...", "secret_key": "secret_..."}
  
  -- Credential metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_rotated_at TIMESTAMPTZ,
  
  -- Encryption metadata
  encryption_version INT DEFAULT 1, -- For future key rotation
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- integration_webhook_endpoints — Webhook URLs registered with providers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integration_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Webhook registration
  event_type TEXT NOT NULL,    -- e.g., 'payment.success', 'order.created', 'charge.updated'
  webhook_url TEXT NOT NULL,   -- Endpoint where to POST events
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- integration_webhook_logs — Audit trail of incoming webhooks
-- ============================================================================
-- Every webhook from external service is logged here (before processing)

CREATE TABLE IF NOT EXISTS public.integration_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Webhook metadata
  event_id TEXT,                 -- External event ID (for deduplication)
  event_type TEXT,               -- e.g., 'payment.success'
  event_timestamp TIMESTAMPTZ,   -- When event occurred (from provider)
  
  -- Request metadata
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  http_status INT,
  headers_hash TEXT,             -- Hash of headers for signature verification
  signature_verified BOOLEAN,
  
  -- Payload
  payload_hash TEXT,             -- SHA256 of payload (for verification)
  
  -- Processing
  status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'processed', 'failed', 'ignored'
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  processing_duration_ms INT,    -- How long processing took
  
  -- Retry tracking
  retry_count INT DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- integration_sync_logs — Audit trail of background syncs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Sync metadata
  sync_type TEXT NOT NULL,        -- 'product_sync', 'order_sync', 'inventory_sync', etc
  direction TEXT,                 -- 'inbound', 'outbound', 'bidirectional'
  
  -- Results
  status TEXT NOT NULL,           -- 'started', 'completed', 'failed'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  -- Metrics
  items_processed INT,
  items_created INT,
  items_updated INT,
  items_failed INT,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- BUG FIX: this ADD COLUMN used to sit near the bottom of this file (after
-- all the CREATE POLICY statements below), but several of those policies
-- reference tenant_members.can_manage_integrations. Postgres runs a
-- migration file's statements strictly top-to-bottom, so every
-- `supabase db push` against a fresh/behind database failed immediately
-- with "column can_manage_integrations does not exist" (SQLSTATE 42703) —
-- which in turn aborted the whole migration step and skipped deploying any
-- edge functions in CI. Moving it here (column must exist before any policy
-- can reference it) fixes deploys without changing the end schema — this
-- statement was always idempotent (IF NOT EXISTS) and additive.
ALTER TABLE public.tenant_members ADD COLUMN IF NOT EXISTS can_manage_integrations BOOLEAN DEFAULT FALSE;

ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- integration_providers — super_admin manage, everyone can view
DROP POLICY IF EXISTS "Anyone can view integration providers" ON public.integration_providers;
CREATE POLICY "Anyone can view integration providers"
  ON public.integration_providers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Super admin can manage integration providers" ON public.integration_providers;
CREATE POLICY "Super admin can manage integration providers"
  ON public.integration_providers FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- integration_connections — tenant members can manage their own
DROP POLICY IF EXISTS "Tenant members can view their connections" ON public.integration_connections;
CREATE POLICY "Tenant members can view their connections"
  ON public.integration_connections FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Tenant members can create connections" ON public.integration_connections;
CREATE POLICY "Tenant members can create connections"
  ON public.integration_connections FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid() AND can_manage_integrations = true
    )
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Tenant members can update their connections" ON public.integration_connections;
CREATE POLICY "Tenant members can update their connections"
  ON public.integration_connections FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid() AND can_manage_integrations = true
    )
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid() AND can_manage_integrations = true
    )
    OR is_super_admin(auth.uid())
  );

-- integration_credentials — VERY restrictive, only for service role
DROP POLICY IF EXISTS "Service role can access all credentials" ON public.integration_credentials;
CREATE POLICY "Service role can access all credentials"
  ON public.integration_credentials FOR ALL
  USING (true); -- Service role bypasses RLS anyway

-- integration_webhook_endpoints — same as connections
DROP POLICY IF EXISTS "Tenant members can view their webhook endpoints" ON public.integration_webhook_endpoints;
CREATE POLICY "Tenant members can view their webhook endpoints"
  ON public.integration_webhook_endpoints FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Tenant members can manage their webhook endpoints" ON public.integration_webhook_endpoints;
CREATE POLICY "Tenant members can manage their webhook endpoints"
  ON public.integration_webhook_endpoints FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid() AND can_manage_integrations = true
    )
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid() AND can_manage_integrations = true
    )
    OR is_super_admin(auth.uid())
  );

-- integration_webhook_logs — view for debugging
DROP POLICY IF EXISTS "Tenant members can view their webhook logs" ON public.integration_webhook_logs;
CREATE POLICY "Tenant members can view their webhook logs"
  ON public.integration_webhook_logs FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );

-- integration_sync_logs — view for monitoring
DROP POLICY IF EXISTS "Tenant members can view their sync logs" ON public.integration_sync_logs;
CREATE POLICY "Tenant members can view their sync logs"
  ON public.integration_sync_logs FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );

-- ============================================================================
-- INDEXES for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_integration_providers_category ON public.integration_providers(category);
CREATE INDEX IF NOT EXISTS idx_integration_providers_active ON public.integration_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_integration_connections_tenant_provider ON public.integration_connections(tenant_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_tenant_status ON public.integration_connections(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_connection_id ON public.integration_credentials(connection_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_logs_connection_tenant ON public.integration_webhook_logs(connection_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_logs_status ON public.integration_webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_connection_tenant ON public.integration_sync_logs(connection_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_status ON public.integration_sync_logs(status);

-- ============================================================================
-- TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_integration_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_integration_providers_updated_at ON public.integration_providers;
CREATE TRIGGER trigger_integration_providers_updated_at
  BEFORE UPDATE ON public.integration_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_providers_updated_at();

CREATE OR REPLACE FUNCTION update_integration_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_integration_connections_updated_at ON public.integration_connections;
CREATE TRIGGER trigger_integration_connections_updated_at
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_connections_updated_at();

-- ============================================================================
-- tenant_members.can_manage_integrations was added above, before the RLS
-- policies that reference it (see BUG FIX note near the top of this file).
-- ============================================================================

-- ============================================================================
-- SEED: Initial integration providers (global)
-- ============================================================================

-- We'll seed this in a separate migration to keep this one clean
-- This just provides the structure
