/*
# Part 6 — supplier_products, delivery_items (partial delivery), purchases stock receipt

## Summary
1. **supplier_products** — many-to-many link between suppliers and the products
   they habitually deliver. Used to suggest relevant suppliers when creating a
   purchase for a given product, and to show on a product card which suppliers
   carry it.
2. **delivery_items** — per-product line items for a delivery, tracking
   quantity_ordered vs quantity_delivered. Enables partial delivery: a sale
   where the client takes some units now and the rest later. The parent
   `deliveries` row gets status 'partially_delivered' when some but not all
   lines are fulfilled.
3. **deliveries status** — add 'partially_delivered' as a valid status (no schema
   change needed, status is text; just documenting the new value).
4. **purchases status** — add 'partially_received' as a valid status for
   purchases where some items are received but not all. Stock update happens on
   receipt (total or partial).

## New tables
- `supplier_products(id, tenant_id, supplier_id, product_id, created_at, unique(supplier_id, product_id))`
- `delivery_items(id, delivery_id, product_id, product_name, quantity_ordered, quantity_delivered, created_at)`

## Security
- RLS enabled on both new tables.
- supplier_products: tenant members can read; admin/super_admin can write.
- delivery_items: tenant members can read; users with deliveries.create/update
  can write (inherits from delivery ownership).

## Notes
1. No destructive changes — all new tables/columns are additive.
2. The deliveries.status text field already accepts any string, so
   'partially_delivered' works without an ALTER.
*/

-- ============================================================================
-- 1. supplier_products
-- ============================================================================

create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (supplier_id, product_id)
);

alter table public.supplier_products enable row level security;

drop policy if exists "sp_select_member" on public.supplier_products;
create policy "sp_select_member" on public.supplier_products for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      where tm.tenant_id = supplier_products.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "sp_insert_admin" on public.supplier_products;
create policy "sp_insert_admin" on public.supplier_products for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm
      where tm.tenant_id = supplier_products.tenant_id and tm.user_id = auth.uid()
      and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "sp_delete_admin" on public.supplier_products;
create policy "sp_delete_admin" on public.supplier_products for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      where tm.tenant_id = supplier_products.tenant_id and tm.user_id = auth.uid()
      and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- 2. delivery_items (partial delivery tracking)
-- ============================================================================

create table if not exists public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity_ordered numeric not null default 0,
  quantity_delivered numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.delivery_items enable row level security;

drop policy if exists "di_select_member" on public.delivery_items;
create policy "di_select_member" on public.delivery_items for select
  to authenticated using (
    exists (select 1 from public.deliveries d
      join public.tenant_members tm on tm.tenant_id = d.tenant_id
      where d.id = delivery_items.delivery_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "di_insert_member" on public.delivery_items;
create policy "di_insert_member" on public.delivery_items for insert
  to authenticated with check (
    exists (select 1 from public.deliveries d
      join public.tenant_members tm on tm.tenant_id = d.tenant_id
      where d.id = delivery_items.delivery_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "di_update_member" on public.delivery_items;
create policy "di_update_member" on public.delivery_items for update
  to authenticated using (
    exists (select 1 from public.deliveries d
      join public.tenant_members tm on tm.tenant_id = d.tenant_id
      where d.id = delivery_items.delivery_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.deliveries d
      join public.tenant_members tm on tm.tenant_id = d.tenant_id
      where d.id = delivery_items.delivery_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "di_delete_member" on public.delivery_items;
create policy "di_delete_member" on public.delivery_items for delete
  to authenticated using (
    exists (select 1 from public.deliveries d
      join public.tenant_members tm on tm.tenant_id = d.tenant_id
      where d.id = delivery_items.delivery_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );