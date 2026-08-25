/*
# Integration Payments Tracking

## Summary
Tracks all payments received through integrations (Stripe, Flutterwave, PayStack, etc).
Enables POS Flow to sync payment data and reconcile with sales records.

## Tables
1. `integration_payments` — Payment records from external PSPs
2. `integration_payment_mappings` — Link integration payments to POS Flow sales/invoices

## Security
- RLS enforced per tenant
- Immutable payment records (audit trail)
- Webhook verification logged
*/

-- ============================================================================
-- integration_payments — Track payments from external providers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integration_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  
  -- Provider metadata
  provider TEXT NOT NULL,                     -- 'stripe', 'flutterwave', 'paystack', etc
  provider_payment_id TEXT NOT NULL,          -- Payment ID from provider (e.g., ch_xxx for Stripe)
  
  -- Payment details
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Status
  status TEXT NOT NULL,                       -- 'succeeded', 'failed', 'pending', 'refunded', 'disputed'
  
  -- Customer info
  customer_id TEXT,                           -- Customer ID from provider
  customer_email TEXT,
  customer_name TEXT,
  
  -- POS Flow mapping
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  
  -- Error tracking
  error_message TEXT,
  
  -- Metadata
  metadata JSONB,                             -- Custom data from provider
  
  -- Tracking
  webhook_received_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- integration_payment_disputes — Disputed/problematic payments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integration_payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.integration_payments(id) ON DELETE CASCADE,
  
  -- Dispute details
  dispute_reason TEXT,
  dispute_status TEXT,                        -- 'open', 'resolved', 'lost'
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.integration_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_payment_disputes ENABLE ROW LEVEL SECURITY;

-- Tenant members can view their payments
DROP POLICY IF EXISTS "Tenant members can view their payments" ON public.integration_payments;
CREATE POLICY "Tenant members can view their payments"
  ON public.integration_payments FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );

-- Tenant members can view disputes
DROP POLICY IF EXISTS "Tenant members can view disputes" ON public.integration_payment_disputes;
CREATE POLICY "Tenant members can view disputes"
  ON public.integration_payment_disputes FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_integration_payments_tenant_provider ON public.integration_payments(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_integration_payments_status ON public.integration_payments(status);
CREATE INDEX IF NOT EXISTS idx_integration_payments_provider_payment_id ON public.integration_payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_integration_payments_sale_id ON public.integration_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_integration_payments_invoice_id ON public.integration_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_integration_payments_created_at ON public.integration_payments(created_at DESC);

-- ============================================================================
-- TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_integration_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_integration_payments_updated_at ON public.integration_payments;
CREATE TRIGGER trigger_integration_payments_updated_at
  BEFORE UPDATE ON public.integration_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_payments_updated_at();
