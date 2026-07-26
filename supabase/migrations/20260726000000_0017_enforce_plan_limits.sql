-- Plan limits (max_users, max_stores, max_products) were advertised on the
-- pricing page and stored in the `plans` table, but nothing ever checked
-- them: a Starter tenant (2 users / 1 store / 100 products) could invite
-- unlimited staff or add unlimited products. This adds real, server-side
-- enforcement via triggers — the only place it can't be bypassed from the
-- client.
--
-- Behavior: if a tenant has no plan_id yet (shouldn't normally happen,
-- but defensively) the check is skipped rather than blocking everything.
-- Existing data that already exceeds a limit is left untouched — only
-- NEW inserts beyond the limit are rejected, so nothing existing breaks.

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
  from public.tenants t
  join public.plans pl on pl.id = t.plan_id
  where t.id = p_tenant_id;

  if not found then
    return; -- no plan assigned yet — don't block onboarding edge cases
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

create or replace function public.trg_check_max_users()
returns trigger language plpgsql as $$
begin
  perform public.enforce_plan_limit(new.tenant_id, 'users');
  return new;
end;
$$;

create or replace function public.trg_check_max_stores()
returns trigger language plpgsql as $$
begin
  perform public.enforce_plan_limit(new.tenant_id, 'stores');
  return new;
end;
$$;

create or replace function public.trg_check_max_products()
returns trigger language plpgsql as $$
begin
  perform public.enforce_plan_limit(new.tenant_id, 'products');
  return new;
end;
$$;

drop trigger if exists check_max_users on public.tenant_members;
create trigger check_max_users
  before insert on public.tenant_members
  for each row execute function public.trg_check_max_users();

drop trigger if exists check_max_stores on public.stores;
create trigger check_max_stores
  before insert on public.stores
  for each row execute function public.trg_check_max_stores();

drop trigger if exists check_max_products on public.products;
create trigger check_max_products
  before insert on public.products
  for each row execute function public.trg_check_max_products();
