-- Security fix: sell_product_serial and consume_product_batches_fefo
-- (migration 0076) are SECURITY DEFINER, so they run with elevated
-- privileges and bypass RLS entirely by design — but unlike every other
-- SECURITY DEFINER function with a real side effect in this codebase
-- (issue_gift_card, redeem_gift_card, check_manual_discount,
-- redeem_loyalty_points, ...), neither one actually checked that the
-- calling user belongs to p_tenant_id before acting on it. Both are
-- GRANTed to the generic `authenticated` role, so as written, any signed-in
-- user of ANY tenant could call either function with a different tenant's
-- p_tenant_id and mark that tenant's serials sold / drain that tenant's
-- batch stock. Adding the same membership + module-permission check every
-- other side-effecting function in this codebase already has.

create or replace function public.sell_product_serial(
  p_tenant_id uuid,
  p_serial_id uuid,
  p_sale_id uuid,
  p_sale_item_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_status text;
begin
  if not public.can_on_tenant(auth.uid(), p_tenant_id, 'pos', 'create') and not public.is_super_admin(auth.uid()) then
    raise exception 'Vous n''avez pas le droit de vendre ce produit.';
  end if;

  select status into v_status from public.product_serials
    where id = p_serial_id and tenant_id = p_tenant_id
    for update;

  if v_status is null then
    raise exception 'Numéro de série introuvable.';
  end if;
  if v_status <> 'in_stock' then
    raise exception 'Ce numéro de série n''est plus disponible (statut: %).', v_status;
  end if;

  update public.product_serials
    set status = 'sold', sale_id = p_sale_id, sale_item_id = p_sale_item_id, store_id = null, updated_at = now()
    where id = p_serial_id;
end;
$$;

create or replace function public.consume_product_batches_fefo(
  p_tenant_id uuid,
  p_product_id uuid,
  p_store_id uuid,
  p_quantity numeric,
  p_sale_item_id uuid
) returns table (batch_id uuid, batch_number text, quantity_taken numeric)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_remaining_needed numeric := p_quantity;
  v_batch record;
  v_take numeric;
begin
  if not public.can_on_tenant(auth.uid(), p_tenant_id, 'pos', 'create') and not public.is_super_admin(auth.uid()) then
    raise exception 'Vous n''avez pas le droit de vendre ce produit.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantité doit être positive.';
  end if;

  for v_batch in
    select * from public.product_batches
      where tenant_id = p_tenant_id and product_id = p_product_id
        and (store_id = p_store_id or (store_id is null and p_store_id is null))
        and remaining_quantity > 0
      order by expiry_date asc nulls last, created_at asc
      for update
  loop
    exit when v_remaining_needed <= 0;

    v_take := least(v_batch.remaining_quantity, v_remaining_needed);

    update public.product_batches
      set remaining_quantity = remaining_quantity - v_take, updated_at = now()
      where id = v_batch.id;

    insert into public.sale_item_batches (sale_item_id, batch_id, quantity)
      values (p_sale_item_id, v_batch.id, v_take);

    batch_id := v_batch.id;
    batch_number := v_batch.batch_number;
    quantity_taken := v_take;
    return next;

    v_remaining_needed := v_remaining_needed - v_take;
  end loop;

  if v_remaining_needed > 0 then
    raise exception 'Stock de lot insuffisant : il manque % unité(s) pour ce produit.', v_remaining_needed;
  end if;
end;
$$;

-- Same fix, same root cause, for two more SECURITY DEFINER functions found
-- during this audit: earn_loyalty_points and redeem_loyalty_points
-- (migration 0067) took no tenant-membership check either. Unlike
-- check_manual_discount/verify_manager_pin in the same file (which are
-- implicitly tenant-scoped because verify_staff_pin requires a valid
-- staff_code+PIN *for that specific tenant*), these two had no such
-- barrier at all: any authenticated user could pass any p_tenant_id and
-- p_customer_id and either credit themselves points on a stranger's
-- tenant or drain a stranger's customer's loyalty balance.

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
  if not public.can_on_tenant(auth.uid(), p_tenant_id, 'pos', 'create') and not public.is_super_admin(auth.uid()) then
    raise exception 'Accès non autorisé.';
  end if;
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
  if not public.can_on_tenant(auth.uid(), p_tenant_id, 'pos', 'create') and not public.is_super_admin(auth.uid()) then
    raise exception 'Accès non autorisé.';
  end if;
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
