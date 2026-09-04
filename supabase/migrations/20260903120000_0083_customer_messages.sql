-- Real customer messaging feature (the "Messages" module in the app —
-- see src/pages/modules/MessagesPage.tsx): merchants can send a bulk
-- SMS/WhatsApp message to their customers (all, or filtered by loyalty
-- tier / segment) via a connected Twilio account (reuses the existing
-- notifications-twilio edge function, which already supports bulk sends
-- to a list of recipients — no new sending function needed).
--
-- This table is a lightweight campaign log for the UI's "Sent messages"
-- history: one row per send action, aggregate counts + the raw
-- per-recipient results for on-demand detail. It intentionally does NOT
-- store a row per recipient (that would need its own table with its own
-- RLS) — the aggregate + JSONB detail blob is enough for a merchant to
-- see what went out and troubleshoot failures, without the overhead of a
-- second table for what is, so far, a simple broadcast feature.

CREATE TABLE IF NOT EXISTS public.customer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  audience TEXT NOT NULL,          -- human-readable, e.g. "All customers", "Tier: Gold"
  message TEXT NOT NULL,
  recipient_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  results JSONB,                   -- raw per-recipient results from notifications-twilio, for detail-on-demand
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_messages_tenant ON public.customer_messages(tenant_id, created_at DESC);

ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view their message history" ON public.customer_messages;
CREATE POLICY "Tenant members can view their message history"
  ON public.customer_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = customer_messages.tenant_id
      AND tenant_members.user_id = auth.uid()
    )
  );

-- Only roles with messages.create permission should log a send — enforced
-- client-side the same way every other module's create/update actions
-- already are in this codebase (no module has DB-level permission-action
-- checks beyond tenant membership; see e.g. products/customers policies),
-- so this mirrors that existing pattern rather than introducing a new one.
DROP POLICY IF EXISTS "Tenant members can log sent messages" ON public.customer_messages;
CREATE POLICY "Tenant members can log sent messages"
  ON public.customer_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = customer_messages.tenant_id
      AND tenant_members.user_id = auth.uid()
    )
  );
