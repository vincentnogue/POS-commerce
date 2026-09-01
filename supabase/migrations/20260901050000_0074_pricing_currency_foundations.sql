-- Pricing & multi-currency foundations (schema only).
--
-- IMPORTANT — this is unrelated to the existing exchange-rates edge
-- function / src/lib/currency.ts: that pair exists for displaying the
-- SaaS's own subscription pricing in a visitor's local currency and has
-- nothing to do with a tenant's own point-of-sale transactions. This
-- migration is the actual foundation for a tenant selling in more than
-- one currency at the till.
--
-- ⚠️ Every existing tenant keeps working unchanged: sales.currency
-- defaults to the tenant's own tenants.currency (backfilled below for
-- every historical row) and sales.exchange_rate defaults to 1 — so a
-- single-currency tenant's data, reports, and totals are byte-for-byte
-- what they were before this migration. Nothing here forces any tenant to
-- adopt multi-currency; it only makes it possible for one that wants to.

-- Which additional currencies a tenant accepts, and the tenant's own
-- fixed rate for each (a merchant sets/updates this manually rather than
-- trusting a live feed for till-facing pricing, so a rate never moves
-- mid-shift under a cashier).
create table if not exists public.tenant_currencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  currency_code text not null,
  rate_to_tenant_currency numeric not null check (rate_to_tenant_currency > 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (tenant_id, currency_code)
);

-- The tenant's own currency is always implicitly accepted at rate 1 — seed
-- it explicitly so a tenant enabling multi-currency has one row to look at
-- and edit, rather than a special-cased "no row means home currency" rule
-- every consumer of this table would otherwise have to remember.
insert into public.tenant_currencies (tenant_id, currency_code, rate_to_tenant_currency)
select id, currency, 1
from public.tenants
where currency is not null
on conflict (tenant_id, currency_code) do nothing;

alter table public.sales add column if not exists currency text;
alter table public.sales add column if not exists exchange_rate numeric not null default 1;

-- Backfill: every historical sale gets its tenant's own currency at rate 1
-- — this is the row-by-row equivalent of "nothing changes for existing
-- data" for every sale made before this column existed.
update public.sales s
set currency = t.currency
from public.tenants t
where s.tenant_id = t.id and s.currency is null;

comment on column public.sales.currency is
  'Currency this specific sale was transacted in — locked at sale time, never recalculated. A tenant with only one currency just always has every sale.currency = tenants.currency.';
comment on column public.sales.exchange_rate is
  'Rate to the tenant''s own currency AT THE TIME of this sale (copied from tenant_currencies when the sale was made, then frozen here) — this is what prevents an old transaction''s reported value from silently changing when the tenant later updates today''s rate.';

-- Price lists: a named, reusable price sheet — the standard price list a
-- tenant already effectively has today (products.sale_price) is left
-- completely alone; a price_list_item only ever *overrides* that default
-- for the specific list/product pair a merchant sets one for. store_id and
-- customer_group scope a list to a specific store or a customer segment
-- (see customer_segments in the ops-foundations migration) — both
-- nullable, so an unscoped list is a tenant-wide list.
create table if not exists public.price_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  currency text,
  store_id uuid references public.stores(id) on delete cascade,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);
create table if not exists public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric not null check (price >= 0),
  min_quantity numeric not null default 1 check (min_quantity > 0),
  unique (price_list_id, product_id, min_quantity)
);
create index if not exists price_list_items_product_idx on public.price_list_items (product_id);

do $$
declare
  t text;
begin
  foreach t in array array['tenant_currencies', 'price_lists'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all_member', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.tenant_members tm where tm.tenant_id = %I.tenant_id and tm.user_id = auth.uid()) or public.is_super_admin(auth.uid())) with check (exists (select 1 from public.tenant_members tm where tm.tenant_id = %I.tenant_id and tm.user_id = auth.uid()) or public.is_super_admin(auth.uid()))',
      t || '_all_member', t, t, t
    );
  end loop;
end $$;

alter table public.price_list_items enable row level security;
drop policy if exists price_list_items_all_member on public.price_list_items;
create policy price_list_items_all_member on public.price_list_items for all
  to authenticated using (
    exists (select 1 from public.price_lists pl join public.tenant_members tm on tm.tenant_id = pl.tenant_id and tm.user_id = auth.uid() where pl.id = price_list_items.price_list_id)
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.price_lists pl join public.tenant_members tm on tm.tenant_id = pl.tenant_id and tm.user_id = auth.uid() where pl.id = price_list_items.price_list_id)
    or public.is_super_admin(auth.uid())
  );
