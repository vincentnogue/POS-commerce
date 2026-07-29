-- The pricing page explicitly advertises exclusive features per plan
-- (Starter has no Invoices/Quotes/Deliveries/Suppliers/Purchases; Premium+
-- exclusively unlocks full Accounting and custom roles) but nothing
-- enforced this — a Starter tenant had full access to every module for
-- free, making the plan tiers a broken promise to paying customers.

alter table public.plans add column if not exists included_modules text[];

update public.plans set included_modules = array[
  'dashboard','pos','products','stock','stores','customers','users','settings'
] where code = 'starter';

update public.plans set included_modules = array[
  'dashboard','pos','products','stock','stores','customers','users','settings',
  'invoices','quotes','deliveries','suppliers','purchases','expenses','reports'
] where code = 'pro';

update public.plans set included_modules = array[
  'dashboard','pos','products','stock','stores','customers','users','settings',
  'invoices','quotes','deliveries','suppliers','purchases','expenses','reports',
  'accounting','administration'
] where code in ('premium', 'entreprise');

-- Fold plan-tier feature gating into the same can_on_tenant() function
-- already used everywhere for role-based checks, so every existing call
-- site gets this for free with no further app changes needed. 'view' is
-- gated (locks a module out entirely if not on the plan); create/update/
-- delete are left to the role checks alone once view access is granted,
-- since a module either exists on your plan or it doesn't.
create or replace function public.can_on_tenant(uid uuid, tid uuid, mod text, act text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m record;
  cr record;
  perms jsonb;
  t record;
  role_allows boolean;
begin
  if uid is null then return false; end if;

  select * into m from public.tenant_members
    where user_id = uid and tenant_id = tid limit 1;
  if not found then return false; end if;

  if m.role = 'super_admin' then return true; end if;

  -- Always-available modules regardless of plan (nobody should ever be
  -- locked out of their own dashboard, POS, or account settings).
  if mod in ('dashboard', 'pos', 'settings') then
    role_allows := true;
  else
    select t2.*, pl.included_modules into t
    from public.tenants t2
    left join public.plans pl on pl.id = t2.plan_id
    where t2.id = tid;

    if not found or t.included_modules is null then
      role_allows := true; -- no plan resolved yet — don't block onboarding edge cases
    elsif not (mod = any(t.included_modules)) then
      return false; -- module simply isn't part of this tenant's plan
    else
      role_allows := true;
    end if;
  end if;

  if not role_allows then return false; end if;

  if m.role = 'admin' then return true; end if;

  if m.custom_role_id is not null then
    select * into cr from public.custom_roles where id = m.custom_role_id and tenant_id = tid;
    if found then
      perms := cr.permissions;
      if perms ? mod then
        return (perms -> mod) ? act and ((perms -> mod) ->> act)::boolean;
      end if;
      return false;
    end if;
  end if;

  return public.can(uid, mod, act);
end;
$$;

grant execute on function public.can_on_tenant to authenticated;
