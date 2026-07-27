-- CRITICAL functional gap: selling a product through the POS never
-- decremented inventory anywhere in the system — no trigger, no app-side
-- logic. A shop could "sell" 1000 units of a product with 5 in stock and
-- the stock count would never move. This adds the missing link.

create or replace function public.trg_decrement_stock_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_store_id uuid;
  v_sale_status text;
  v_updated integer;
begin
  select tenant_id, store_id, sale_status
  into v_tenant_id, v_store_id, v_sale_status
  from public.sales
  where id = new.sale_id;

  -- Only completed sales affect stock; and only line items tied to a real product.
  if v_sale_status is distinct from 'completed' or new.product_id is null then
    return new;
  end if;

  update public.inventory
  set quantity = quantity - new.quantity, updated_at = now()
  where tenant_id = v_tenant_id
    and product_id = new.product_id
    and store_id is not distinct from v_store_id;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    -- No inventory row existed yet for this product/store — create one.
    -- Allowed to go negative: an oversell is a real business event that
    -- should stay visible (as "stock bas"/negative) rather than being
    -- silently dropped.
    insert into public.inventory (tenant_id, product_id, store_id, quantity)
    values (v_tenant_id, new.product_id, v_store_id, -new.quantity);
  end if;

  insert into public.stock_movements (tenant_id, product_id, store_id, movement_type, quantity, reason)
  select v_tenant_id, new.product_id, v_store_id, 'out', new.quantity,
         'Vente ' || (select reference from public.sales where id = new.sale_id);

  return new;
end;
$$;

drop trigger if exists decrement_stock_on_sale on public.sale_items;
create trigger decrement_stock_on_sale
  after insert on public.sale_items
  for each row execute function public.trg_decrement_stock_on_sale();
