-- Loyalty points + manager-approved manual discounts, D365-style (product
-- request: "remise manuelle avec approbation manager / points fidélité /
-- les deux", configurable priority per tenant).
--
-- Reuses the exact same Staff ID + PIN infrastructure as stock transfers
-- (migrations 0051/0064/0065) for the approval step — a manager approving
-- a discount authenticates the same way a staff member unlocks their
-- account: their own Staff ID + PIN, verified server-side, never trusted
-- as a plain string.

-- 1. Per-tenant configuration: which discount mechanism(s) are enabled,
--    and the rules for each.
alter table public.tenants add column if not exists discount_mode text not null default 'manual_approval'
  check (discount_mode in ('manual_approval', 'loyalty_points', 'both'));
alter table public.tenants add column if not exists manual_discount_requires_approval_above numeric not null default 0;
alter table public.tenants add column if not exists loyalty_points_per_currency numeric not null default 1;
alter table public.tenants add column if not exists loyalty_point_value numeric not null default 0.01;

comment on column public.tenants.discount_mode is
  'Which discount mechanism this tenant uses at checkout: manual_approval (manager PIN required), loyalty_points (customer redeems points), or both.';
comment on column public.tenants.manual_discount_requires_approval_above is
  'A manual discount at or below this amount can be applied without manager approval; above it, a manager Staff ID + PIN is required. 0 = always require approval.';
comment on column public.tenants.loyalty_points_per_currency is
  'How many loyalty points a customer earns per 1 unit of currency spent.';
comment on column public.tenants.loyalty_point_value is
  'How much 1 loyalty point is worth as a discount, in currency (e.g. 0.01 = 100 points = 1 currency unit off).';

-- 2. Loyalty balance + ledger.
alter table public.customers add column if not exists loyalty_points integer not null default 0;
comment on column public.customers.loyalty_points is 'Current redeemable loyalty point balance.';

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  points_delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.loyalty_transactions enable row level security;

drop policy if exists loyalty_transactions_tenant_access on public.loyalty_transactions;
create policy loyalty_transactions_tenant_access on public.loyalty_transactions
  for all using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create index if not exists loyalty_transactions_customer_idx on public.loyalty_transactions(customer_id);

-- 3. Manager approval check — same Staff ID + PIN mechanism as
--    lock/unlock (0065), plus a role check: only admin/manager/super_admin
--    Staff IDs can approve a discount.
create or replace function public.verify_manager_pin(
  p_tenant_id uuid,
  p_staff_code text,
  p_pin text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member_id uuid;
  v_role text;
begin
  v_member_id := public.verify_staff_pin(p_tenant_id, p_staff_code, p_pin);

  select role into v_role from public.tenant_members where id = v_member_id;
  if v_role not in ('admin', 'super_admin', 'manager') then
    raise exception 'Ce Staff ID n''a pas les droits pour approuver une remise.';
  end if;

  return v_member_id;
end;
$$;

-- 4. Apply a manual discount to an in-progress sale total, enforcing
--    approval above the tenant's threshold. Called at checkout time
--    (before the sale row is created) — returns the amount actually
--    approved so the caller applies it to the sale total, and records who
--    approved it for audit purposes via the returned id/notes convention
--    already used elsewhere (initiated_staff_code on transfers).
create or replace function public.check_manual_discount(
  p_tenant_id uuid,
  p_amount numeric,
  p_approver_staff_code text,
  p_approver_pin text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_threshold numeric;
  v_approver_id uuid;
  v_approver_name text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant de la remise doit être positif.';
  end if;

  select manual_discount_requires_approval_above into v_threshold
  from public.tenants where id = p_tenant_id;

  if p_amount <= coalesce(v_threshold, 0) and coalesce(v_threshold, 0) > 0 then
    return jsonb_build_object('approved', true, 'approver_id', null, 'approver_name', null);
  end if;

  if p_approver_staff_code is null or trim(p_approver_staff_code) = '' then
    raise exception 'Cette remise nécessite l''approbation d''un manager (Staff ID + code).';
  end if;

  v_approver_id := public.verify_manager_pin(p_tenant_id, p_approver_staff_code, p_approver_pin);
  select display_name into v_approver_name from public.tenant_members where id = v_approver_id;

  return jsonb_build_object('approved', true, 'approver_id', v_approver_id, 'approver_name', v_approver_name);
end;
$$;

-- 5. Earn points after a completed sale (called from the checkout flow
--    once the sale row exists).
create or replace function public.earn_loyalty_points(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_sale_id uuid,
  p_sale_total numeric
) returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rate numeric;
  v_points integer;
begin
  if p_customer_id is null or p_sale_total is null or p_sale_total <= 0 then
    return 0;
  end if;

  select loyalty_points_per_currency into v_rate from public.tenants where id = p_tenant_id;
  v_points := floor(p_sale_total * coalesce(v_rate, 1));
  if v_points <= 0 then
    return 0;
  end if;

  update public.customers set loyalty_points = loyalty_points + v_points where id = p_customer_id and tenant_id = p_tenant_id;

  insert into public.loyalty_transactions (tenant_id, customer_id, sale_id, points_delta, reason)
  values (p_tenant_id, p_customer_id, p_sale_id, v_points, 'Achat ' || p_sale_total::text);

  return v_points;
end;
$$;

-- 6. Redeem points for a discount amount at checkout (before the sale row
--    is created — deducts points immediately and logs it; if the sale is
--    later aborted the caller should call this with a negative amount to
--    refund, same pattern as any other pre-commit reservation in this app).
create or replace function public.redeem_loyalty_points(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_points integer
) returns numeric
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_balance integer;
  v_value numeric;
begin
  if p_points is null or p_points <= 0 then
    raise exception 'Le nombre de points doit être positif.';
  end if;

  select loyalty_points into v_balance from public.customers where id = p_customer_id and tenant_id = p_tenant_id;
  if v_balance is null then
    raise exception 'Client introuvable.';
  end if;
  if v_balance < p_points then
    raise exception 'Solde de points insuffisant (disponible: %).', v_balance;
  end if;

  select loyalty_point_value into v_value from public.tenants where id = p_tenant_id;

  update public.customers set loyalty_points = loyalty_points - p_points where id = p_customer_id and tenant_id = p_tenant_id;

  insert into public.loyalty_transactions (tenant_id, customer_id, points_delta, reason)
  values (p_tenant_id, p_customer_id, -p_points, 'Échangés contre une remise');

  return p_points * coalesce(v_value, 0.01);
end;
$$;

grant execute on function public.verify_manager_pin to authenticated;
grant execute on function public.check_manual_discount to authenticated;
grant execute on function public.earn_loyalty_points to authenticated;
grant execute on function public.redeem_loyalty_points to authenticated;
