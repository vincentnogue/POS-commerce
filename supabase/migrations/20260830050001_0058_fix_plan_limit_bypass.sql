-- SECURITY/BILLING FIX: plan-limit bypass via tenants.plan_id.
--
-- public.enforce_plan_limit(...) (0017) resolved a tenant's plan limits via
--   select ... from public.tenants t join public.plans pl on pl.id = t.plan_id
-- i.e. it trusted tenants.plan_id. But tenants_update_member (0001) lets
-- ANY admin/manager of a tenant update their own tenants row with no
-- column restriction — including plan_id — and public.plans is publicly
-- readable (plans_select_all), so every plan's id is discoverable.
--
-- Net effect: a tenant on the Starter plan could, with a single direct
-- REST PATCH to their own tenants row (no UI needed), set plan_id to the
-- Enterprise plan's id and immediately get its max_users/max_stores/
-- max_products limits — permanently, without ever paying — because the
-- limit check never looked at what they'd actually subscribed to.
-- public.subscriptions is the real, Stripe-backed source of truth, and
-- its UPDATE policy is already correctly locked to super_admin only
-- (0007/0010) — nobody could self-upgrade THAT table. This fix makes
-- enforce_plan_limit read the plan from there instead, and additionally
-- blocks any client-side write to tenants.plan_id as defense in depth
-- (only service_role — i.e. the checkout/webhook path — may set it; the
-- real onboarding RPC create_tenant_for_user is itself security definer
-- and unaffected).

create or replace function public.enforce_plan_limit(p_tenant_id uuid, p_resource text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_count integer;
  v_max integer;
begin
  select pl.name, pl.max_users, pl.max_stores, pl.max_products
  into v_plan
  from public.subscriptions s
  join public.plans pl on pl.id = s.plan_id
  where s.tenant_id = p_tenant_id;

  if not found then
    return; -- no subscription/plan yet — don't block onboarding edge cases
  end if;

  if p_resource = 'users' then
    select count(*) into v_count from public.tenant_members where tenant_id = p_tenant_id;
    v_max := v_plan.max_users;
  elsif p_resource = 'stores' then
    select count(*) into v_count from public.stores where tenant_id = p_tenant_id;
    v_max := v_plan.max_stores;
  elsif p_resource = 'products' then
    select count(*) into v_count from public.products where tenant_id = p_tenant_id;
    v_max := v_plan.max_products;
  end if;

  if v_max is not null and v_count >= v_max then
    raise exception 'PLAN_LIMIT_REACHED: Limite du forfait % atteinte (% % max). Passez à un forfait supérieur pour en ajouter davantage.',
      v_plan.name, v_max, p_resource;
  end if;
end;
$$;

-- Defense in depth: tenants.plan_id can no longer be set to a different
-- value by an authenticated (non-service-role) request, regardless of
-- role. subscriptions is authoritative now for limit enforcement; this
-- just stops the now-unused column from being a live lever at all.
create or replace function public.protect_tenant_plan_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if TG_OP = 'UPDATE' and new.plan_id is distinct from old.plan_id then
    raise exception 'SECURITY: le forfait ne peut être changé que via un abonnement réel (paiement), pas directement.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_tenant_plan_id on public.tenants;
create trigger trg_protect_tenant_plan_id
before update on public.tenants
for each row execute function public.protect_tenant_plan_id();
