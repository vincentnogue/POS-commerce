-- CRITICAL SECURITY FIX: payment bypass.
--
-- tenant_access_active() granted access whenever subscriptions.status was
-- 'trialing', with NO check against trial_ends_at in that branch. Nothing
-- ever flips status away from 'trialing' on its own once the trial date
-- passes — only a successful Stripe/Flutterwave webhook moves it to
-- 'active'. Result: any tenant that simply never paid kept full,
-- unrestricted access to the platform forever, exactly as reported.
--
-- Fix: the trial end DATE is now authoritative whenever it's recorded.
-- Only a genuinely active/past_due status keeps access once that date has
-- passed — 'trialing' alone is no longer trusted past its own deadline.

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

    -- No trial_ends_at recorded on this subscription row at all — fall
    -- back to trusting the status label alone.
    return sub.status in ('active', 'trialing', 'past_due');
  end if;

  -- Fallback: no subscription row — use tenant created_at + 7 days
  select created_at into tenant_created from public.tenants where id = tid;
  if not found then
    return false;
  end if;

  return now() < (tenant_created + interval '7 days');
end;
$$;
