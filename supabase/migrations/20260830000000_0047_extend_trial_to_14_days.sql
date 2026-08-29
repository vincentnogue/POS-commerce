-- PRODUCT FIX: the real, intended free trial is 14 days, not 7. The 7-day
-- value was hardcoded in three places that all had to agree and didn't:
--   1. public.create_tenant_for_user() — sets trial_ends_at at signup (0011)
--   2. public.tenant_access_active()   — the actual enforcement gate used
--      by every tenant-scoped RLS policy (0009, redefined by 0029/0030)
--   3. Frontend copy/constants (src/lib/plans.ts, src/lib/access.ts, and
--      the marketing/help copy) — fixed in the same change as this
--      migration, see those files.
--
-- This migration is a straight CREATE OR REPLACE of both functions with
-- every '7 days' interval changed to '14 days' — no other logic changes,
-- no schema changes, no policy changes. Existing tenants already past day 7
-- but still within their original trial window are unaffected either way;
-- tenants created going forward get the full, correct 14 days end-to-end
-- (client display and server enforcement both agree).

create or replace function public.create_tenant_for_user(
  p_name text,
  p_business_type text default null,
  p_country_code text default null,
  p_country_name text default null,
  p_region text default null,
  p_city text default null,
  p_currency text default 'USD',
  p_plan_id uuid default null,
  p_commercial_code_id uuid default null,
  p_logo_url text default null,
  p_stamp_url text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant record;
  v_tenant_id uuid;
  v_trial_end timestamptz;
begin
  -- Must be authenticated
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Validate required fields
  if p_name is null or trim(p_name) = '' then
    raise exception 'Business name is required';
  end if;
  if p_country_code is null then
    raise exception 'Country is required';
  end if;

  -- 1. Create tenant
  insert into public.tenants (
    name, business_type, country_code, country_name,
    region, city, currency, currency_locked,
    plan_id, commercial_code_id, status
  ) values (
    trim(p_name), p_business_type, p_country_code, p_country_name,
    nullif(trim(coalesce(p_region, '')), ''), nullif(trim(coalesce(p_city, '')), ''),
    p_currency, true,
    p_plan_id, p_commercial_code_id, 'active'
  )
  returning * into v_tenant;
  v_tenant_id := v_tenant.id;

  -- 2. Make caller an admin member
  insert into public.tenant_members (tenant_id, user_id, role, display_name, avatar_color)
  values (v_tenant_id, v_user_id, 'admin', trim(p_name), 'action');

  -- 3. Create default store
  insert into public.stores (tenant_id, name, city, is_active)
  values (
    v_tenant_id,
    trim(p_name) || ' - ' || coalesce(nullif(trim(coalesce(p_city, '')), ''), p_country_name),
    nullif(trim(coalesce(p_city, '')), ''),
    true
  );

  -- 4. Seed default categories
  insert into public.categories (tenant_id, name)
  select v_tenant_id, cat from (values
    ('Boissons'), ('Alimentation'), ('Hygiène'), ('Accessoires'), ('Autre')
  ) as t(cat);

  -- 5. Save brand settings if logo or stamp provided
  if p_logo_url is not null or p_stamp_url is not null then
    insert into public.brand_settings (tenant_id, logo_url, stamp_url)
    values (v_tenant_id, p_logo_url, p_stamp_url);
  end if;

  -- 6. Create trial subscription (14-day free trial)
  v_trial_end := now() + interval '14 days';
  insert into public.subscriptions (tenant_id, plan_id, status, trial_ends_at, billing_cycle)
  values (v_tenant_id, p_plan_id, 'trialing', v_trial_end, 'monthly');

  -- Return the created tenant as json
  return row_to_json(v_tenant);
end;
$$;

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
    -- 14 days, matching the no-subscription-row behavior. Only an
    -- active/past_due paid status survives beyond that.
    select created_at into tenant_created from public.tenants where id = tid;
    if not found then
      return false;
    end if;
    if now() < (tenant_created + interval '14 days') then
      return true;
    end if;
    return sub.status in ('active', 'past_due');
  end if;

  -- Fallback: no subscription row — use tenant created_at + 14 days
  select created_at into tenant_created from public.tenants where id = tid;
  if not found then
    return false;
  end if;

  return now() < (tenant_created + interval '14 days');
end;
$$;
