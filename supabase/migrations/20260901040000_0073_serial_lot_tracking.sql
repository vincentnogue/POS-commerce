-- Serial number & lot/batch tracking foundations (schema only).
--
-- Deliberately does NOT touch the existing stock_movements/inventory
-- flow for ordinary (untracked) products — a product with
-- tracking_mode = 'none' (the default, so every existing product is
-- unaffected) behaves exactly as today: quantity-only stock in
-- public.inventory. These new tables are an additional, opt-in layer that
-- a future stock-in/sale/return screen can populate for the specific
-- products a merchant marks as serialized or lot-tracked.

alter table public.products add column if not exists tracking_mode text not null default 'none'
  check (tracking_mode in ('none', 'serial', 'batch'));

-- One row per physical serialized unit. status mirrors the unit's real
-- lifecycle; store_id is null once sold/transferred out (sale_id or
-- transfer records tell you where it went — see stock_transfers/sales,
-- both already tenant-scoped tables this can reference).
create table if not exists public.product_serials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  serial_number text not null,
  store_id uuid references public.stores(id) on delete set null,
  status text not null default 'in_stock' check (status in ('in_stock', 'sold', 'returned', 'transferred', 'damaged', 'lost')),
  sale_id uuid references public.sales(id) on delete set null,
  sale_item_id uuid references public.sale_items(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id, serial_number)
);
create index if not exists product_serials_lookup_idx on public.product_serials (tenant_id, serial_number);
create index if not exists product_serials_product_idx on public.product_serials (product_id, status);

-- One row per batch/lot received (a batch has a quantity, unlike a serial
-- which is always exactly one unit). remaining_quantity is decremented as
-- units from the batch are sold; a future stock-in screen creates these,
-- a future checkout screen (for batch-tracked products) decrements one.
create table if not exists public.product_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  batch_number text not null,
  expiry_date date,
  received_quantity numeric not null default 0 check (received_quantity >= 0),
  remaining_quantity numeric not null default 0 check (remaining_quantity >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id, store_id, batch_number)
);
create index if not exists product_batches_lookup_idx on public.product_batches (tenant_id, batch_number);
create index if not exists product_batches_expiry_idx on public.product_batches (expiry_date) where expiry_date is not null;

-- Which batch(es) a given sale_items line was actually fulfilled from —
-- kept separate from product_batches itself (rather than a single
-- batch_id on sale_items) because one sold line can legitimately draw from
-- more than one batch (e.g. selling 10 units when the newest batch only
-- has 6 left, FIFO-style) once that logic is built.
create table if not exists public.sale_item_batches (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items(id) on delete cascade,
  batch_id uuid not null references public.product_batches(id) on delete restrict,
  quantity numeric not null check (quantity > 0)
);

do $$
declare
  t text;
begin
  foreach t in array array['product_serials', 'product_batches'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all_member', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.tenant_members tm where tm.tenant_id = %I.tenant_id and tm.user_id = auth.uid()) or public.is_super_admin(auth.uid())) with check (exists (select 1 from public.tenant_members tm where tm.tenant_id = %I.tenant_id and tm.user_id = auth.uid()) or public.is_super_admin(auth.uid()))',
      t || '_all_member', t, t, t
    );
  end loop;
end $$;

alter table public.sale_item_batches enable row level security;
drop policy if exists sale_item_batches_all_member on public.sale_item_batches;
create policy sale_item_batches_all_member on public.sale_item_batches for all
  to authenticated using (
    exists (select 1 from public.product_batches pb join public.tenant_members tm on tm.tenant_id = pb.tenant_id and tm.user_id = auth.uid() where pb.id = sale_item_batches.batch_id)
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.product_batches pb join public.tenant_members tm on tm.tenant_id = pb.tenant_id and tm.user_id = auth.uid() where pb.id = sale_item_batches.batch_id)
    or public.is_super_admin(auth.uid())
  );
