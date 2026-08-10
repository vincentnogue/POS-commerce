-- Defense-in-depth hardening for trial/payment bypass.
--
-- tenant_access_active() already trusts trial_ends_at when present (0029).
-- But when trial_ends_at is NULL on the subscription row, it still trusts
-- status='trialing' alone — which could grant indefinite access if a row
-- were ever inserted without a trial end date (manual insert, older data,
-- or a future bug). The create_tenant_for_user RPC always sets
-- trial_ends_at, so this branch is rarely hit in practice, but we close
-- it anyway: NULL trial_ends_at now falls back to the tenant's
-- created_at + 7 days, exactly like the no-subscription-row branch.
--
-- This is a CREATE OR REPLACE of an existing function — no schema change,
-- no policy change, no breaking impact on existing behavior for any
-- tenant that has a valid trial_ends_at (the normal case).

create or replace function public.tenant_access_active(tid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sub record;
  tenant_created timestamptz;
begin
  -- Super admin always has access (platform management)
  if public.is_super_admin(auth.uid()) then
    return true;
  end if;

  select * into sub from public.subscriptions where tenant_id = tid limit 1;

  if found then
    if sub.trial_ends_at is not null then
      if now() < sub.trial_ends_at then
        return true; -- genuinely still within the trial window
      end if;
      -- Trial window has passed: only a real payment-confirmed status
      -- keeps access. 'trialing' past its own deadline no longer counts.
      return sub.status in ('active', 'past_due');
    end if;

    -- No trial_ends_at recorded on this subscription row — do NOT trust
    -- status='trialing' alone. Fall back to the tenant's created_at +
    -- 7 days, matching the no-subscription-row behavior. Only an
    -- active/past_due paid status survives beyond that.
    select created_at into tenant_created from public.tenants where id = tid;
    if not found then
      return false;
    end if;
    if now() < (tenant_created + interval '7 days') then
      return true;
    end if;
    return sub.status in ('active', 'past_due');
  end if;

  -- Fallback: no subscription row — use tenant created_at + 7 days
  select created_at into tenant_created from public.tenants where id = tid;
  if not found then
    return false;
  end if;

  return now() < (tenant_created + interval '7 days');
end;
$$;
