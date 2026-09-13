-- CRITICAL SECURITY FIX: two direct, trivial payment-bypass vectors.
--
-- Both were found while re-auditing subscription enforcement end to end
-- (not just the RPC-based finalize/webhook paths already hardened in
-- earlier migrations).
--
-- 1) "tenants_update_member" (0001) lets any tenant admin UPDATE their
--    own tenants row. RLS policies only restrict WHICH ROWS can be
--    touched, never WHICH COLUMNS — so any tenant admin could, with one
--    direct PostgREST call, set their own tenant's plan_id to any paid
--    plan's id:
--        supabase.from('tenants').update({ plan_id: '<entreprise-plan>' })
--    can_on_tenant() (0024) joins tenants.plan_id -> plans to decide
--    which modules are unlocked, so this alone unlocks every paid-plan
--    module with zero payment, zero Stripe/PSP involvement, and nothing
--    for the finalize/webhook hardening done previously to even see.
--
-- 2) "sub_insert_self_or_super" (0010) lets any tenant member INSERT a
--    row into public.subscriptions for their own tenant_id with NO
--    restriction on the values — status, plan_id, trial_ends_at and
--    current_period_end could all be set directly:
--        supabase.from('subscriptions').insert({ tenant_id, status: 'active',
--          plan_id: '<paid-plan>', current_period_end: '2099-01-01' })
--    tenant_access_active() reads exactly these columns. The unique
--    constraint on subscriptions.tenant_id only blocks this once a row
--    already exists — and a full audit of the frontend (grep for
--    `.from('subscriptions').insert`) confirms the app itself never
--    inserts into this table from the client at all: the real trial row
--    is created server-side, atomically, by the SECURITY DEFINER
--    create_tenant_for_user() RPC (0011/0047), which hardcodes
--    status='trialing' and computes trial_ends_at itself regardless of
--    what the caller asks for. This policy has no legitimate caller —
--    it is pure attack surface left over from an earlier design.

-- Fix 2: subscriptions no longer accept client-side inserts at all.
-- The trial row is created by create_tenant_for_user() (SECURITY
-- DEFINER, bypasses RLS); everything else goes through webhooks /
-- finalize-subscription-payment (service role, bypasses RLS too).
drop policy if exists "sub_insert_self_or_super" on public.subscriptions;
create policy "sub_insert_super" on public.subscriptions for insert
  to authenticated with check (public.is_super_admin(auth.uid()));

-- Fix 1: column-level privileges close the gap RLS row-policies can't.
-- Whitelist exactly the columns real app code (SettingsPage.tsx,
-- SuperAdminPage.tsx) actually writes to `tenants` — plan_id and
-- commercial_code_id are deliberately left out, so only the service
-- role (webhooks, finalize-subscription-payment, the onboarding RPC —
-- none of which go through this grant) can ever change what plan a
-- tenant is on.
revoke update on public.tenants from authenticated;
grant update (
  name, business_type, region, city,
  max_x_reports_per_day, discount_mode, manual_discount_requires_approval_above,
  loyalty_points_per_currency, loyalty_point_value, notification_settings,
  status, updated_at
) on public.tenants to authenticated;
