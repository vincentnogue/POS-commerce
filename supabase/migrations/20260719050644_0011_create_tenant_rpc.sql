/*
# create_tenant_for_user RPC — atomic tenant onboarding

## Problem
The onboarding flow inserts into tenants, tenant_members, stores, categories,
brand_settings, and subscriptions in separate calls from the client. The
tenants INSERT policy requires an authenticated session, but after signUp()
there's a race condition where getSession() returns a cached session while the
JWT hasn't propagated to the PostgREST request header — causing "new row
violates row-level security policy for table tenants".

## Fix
A single SECURITY DEFINER function that:
1. Validates the caller is authenticated (auth.uid() not null)
2. Inserts the tenant row
3. Inserts the tenant_members row (caller = admin)
4. Creates the default store
5. Seeds default categories
6. Creates the trial subscription (7 days)
7. Returns the new tenant record

Because the function runs as the postgres owner (SECURITY DEFINER), it bypasses
RLS — eliminating the race condition. The caller is still validated via
auth.uid(), so anonymous users cannot create tenants.

## Parameters
p_name, p_business_type, p_country_code, p_country_name, p_region, p_city,
p_currency, p_plan_id, p_commercial_code_id, p_logo_url, p_stamp_url

## Returns
The created tenant row as json.
*/

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

  -- 6. Create trial subscription (7-day free trial)
  v_trial_end := now() + interval '7 days';
  insert into public.subscriptions (tenant_id, plan_id, status, trial_ends_at, billing_cycle)
  values (v_tenant_id, p_plan_id, 'trialing', v_trial_end, 'monthly');

  -- Return the created tenant as json
  return row_to_json(v_tenant);
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.create_tenant_for_user to authenticated;