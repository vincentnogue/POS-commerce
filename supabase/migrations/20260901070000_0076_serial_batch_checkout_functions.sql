-- Serial/batch consumption at checkout — the missing PL/pgSQL half of
-- migration 0073 (which was deliberately schema-only). Mirrors the same
-- reasoning as gift cards and manual discounts: marking a serial sold or
-- decrementing a batch's remaining_quantity is a real side effect that
-- must not overdraw under concurrent sales, so it needs row locks rather
-- than plain client-side writes.

-- Marks ONE serial-tracked unit as sold and links it to the sale line
-- that sold it. Called once per unit for a serial-tracked product — a
-- cart line for quantity 3 of a serial-tracked product means picking 3
-- distinct serials and calling this 3 times, one per serial.
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

-- Consumes p_quantity for a batch-tracked product, FEFO (first-expiring-
-- first-out), splitting across as many batches as needed — this is what
-- migration 0073's sale_item_batches table was built for. Returns one
-- row per batch actually drawn from, so the caller can show/print which
-- batch(es) fulfilled the line; also writes the sale_item_batches rows
-- itself so the split is recorded atomically with the consumption.
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

grant execute on function public.sell_product_serial to authenticated;
grant execute on function public.consume_product_batches_fefo to authenticated;
