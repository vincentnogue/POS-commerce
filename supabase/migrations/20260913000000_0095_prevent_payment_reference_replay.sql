-- CRITICAL SECURITY FIX: payment reference replay.
--
-- finalize-subscription-payment (Paystack/PayUnit/Paddle) re-verifies the
-- payment against each provider's own API and checks the paid amount
-- matches the plan — good — but never recorded that a given
-- (provider, reference) pair had already been consumed. Since it always
-- responds with success as long as the provider still reports the
-- transaction as completed, ANY authenticated member of a tenant could
-- call this function repeatedly with the SAME already-verified reference
-- (their own real, one-time payment) to keep pushing current_period_end
-- forward indefinitely — an unlimited-reuse bypass of the recurring
-- billing model from a single real payment.
--
-- This table gives finalize-subscription-payment an atomic, race-safe way
-- to consume a reference exactly once: it inserts a row before activating
-- anything, and the unique constraint on (provider, reference) makes a
-- second attempt with the same reference fail outright, regardless of how
-- many concurrent requests try it.
--
-- No client ever reads or writes this table directly — only the
-- service-role key used by finalize-subscription-payment does, so RLS is
-- enabled with no policies at all (default-deny for anon/authenticated).

create table if not exists public.consumed_payment_references (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  reference text not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_code text not null,
  created_at timestamptz not null default now(),
  unique (provider, reference)
);

alter table public.consumed_payment_references enable row level security;
-- Intentionally no policies: only the service role (which bypasses RLS)
-- may read or write this table.
