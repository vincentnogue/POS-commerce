-- product_serials/product_batches/sale_item_batches (migration 0073)
-- were only gated by plain tenant-membership, unlike every actual stock
-- table (inventory/stock_movements, since migrations 0012/0023) which
-- requires can_on_tenant(..., 'stock', <action>) — the same gap already
-- found and fixed for promotions in migration 0081. A 'viewer' role
-- member (view-only by design) could insert/update/delete serial
-- numbers and batches directly via the API, bypassing the same
-- restriction that already applies to the stock_movements row recorded
-- alongside them in the exact same receiving flow (StockPage.tsx).
--
-- Consumption at checkout (sell_product_serial, consume_product_batches_
-- fefo) runs via SECURITY DEFINER functions, which execute with the
-- function owner's privileges rather than the caller's — so tightening
-- these policies does not affect that flow; it only closes the direct-
-- table-access gap.

do $$
declare
  t text;
begin
  foreach t in array array['product_serials', 'product_batches'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all_member', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_on_tenant(auth.uid(), %I.tenant_id, ''stock'', ''view'') or public.is_super_admin(auth.uid()))',
      t || '_select_member', t, t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_on_tenant(auth.uid(), %I.tenant_id, ''stock'', ''create'') or public.is_super_admin(auth.uid()))',
      t || '_insert_member', t, t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_on_tenant(auth.uid(), %I.tenant_id, ''stock'', ''update'') or public.is_super_admin(auth.uid()))',
      t || '_update_member', t, t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.can_on_tenant(auth.uid(), %I.tenant_id, ''stock'', ''delete'') or public.is_super_admin(auth.uid()))',
      t || '_delete_member', t, t
    );
  end loop;
end $$;

drop policy if exists sale_item_batches_all_member on public.sale_item_batches;

create policy "sale_item_batches_select_member" on public.sale_item_batches for select
  to authenticated using (
    (exists (select 1 from public.product_batches pb join public.tenant_members tm on tm.tenant_id = pb.tenant_id and tm.user_id = auth.uid() where pb.id = sale_item_batches.batch_id)
     and exists (select 1 from public.product_batches pb where pb.id = sale_item_batches.batch_id and public.can_on_tenant(auth.uid(), pb.tenant_id, 'stock', 'view')))
    or public.is_super_admin(auth.uid())
  );

-- Insert/update/delete on sale_item_batches only ever happens from
-- consume_product_batches_fefo (SECURITY DEFINER, bypasses RLS) — no
-- direct-write policy is granted here, matching that it's a derived
-- record of a sale, not something anyone edits by hand.
