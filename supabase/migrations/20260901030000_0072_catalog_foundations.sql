-- Catalog foundations (schema only — no UI wired yet, see PR description).
-- All additive: new nullable columns and new tables, nothing existing is
-- renamed, retyped, or dropped, so every current query/page keeps working
-- unmodified.

-- Subcategories: self-reference on the existing categories table rather
-- than a new table, since a subcategory IS a category for every purpose
-- the rest of the app already has (product.category_id, filters, reports).
alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete set null;
create index if not exists categories_parent_idx on public.categories (parent_id);

-- Brands
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  logo_url text,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);
alter table public.products add column if not exists brand_id uuid references public.brands(id) on delete set null;

-- Collections (a product can be in several — e.g. "Summer 2026" and
-- "Bestsellers" at once — hence the join table rather than a single FK).
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);
create table if not exists public.product_collections (
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

-- Multiple barcodes per product. products.barcode (existing single field,
-- used by today's POS scan-to-cart) is left completely untouched and kept
-- as the default/primary code — this table is for the *additional* codes
-- (multipack, supplier barcode, old packaging...) a merchant may need to
-- scan interchangeably. A future POS scan handler can check this table
-- when products.barcode doesn't match, without changing today's fast path.
create table if not exists public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  barcode text not null,
  label text,
  created_at timestamptz not null default now(),
  unique (tenant_id, barcode)
);
create index if not exists product_barcodes_product_idx on public.product_barcodes (product_id);

-- Bundles/kits: a product marked is_bundle sells as one line at the
-- bundle's own sale_price (unchanged checkout math), while this table
-- records what it's made of — for stock/costing reports to build on later,
-- without needing checkout itself to explode a bundle into N stock
-- decrements today.
alter table public.products add column if not exists is_bundle boolean not null default false;
create table if not exists public.product_bundle_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bundle_product_id uuid not null references public.products(id) on delete cascade,
  component_product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric not null default 1 check (quantity > 0),
  unique (bundle_product_id, component_product_id)
);

-- Tax groups: an optional, named, reusable rate ("Standard 18%", "Reduced
-- 5%", "Exempt 0%") layered on top of the existing products.tax_rate
-- column rather than replacing it — a product with no tax_group_id keeps
-- working exactly as it does today (tax_rate is still read directly by
-- checkout). Setting a tax_group_id is how a future admin screen could
-- let a merchant retag many products' rate at once by editing the group.
create table if not exists public.tax_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  rate numeric not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);
alter table public.products add column if not exists tax_group_id uuid references public.tax_groups(id) on delete set null;
alter table public.customers add column if not exists tax_exempt boolean not null default false;

-- RLS: every new table follows the exact same tenant-membership pattern as
-- categories/products (see 0001) — any tenant member can read/write
-- reference/catalog data, super_admin can see everything.
do $$
declare
  t text;
begin
  foreach t in array array['brands', 'collections', 'product_barcodes', 'product_bundle_items', 'tax_groups'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all_member', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.tenant_members tm where tm.tenant_id = %I.tenant_id and tm.user_id = auth.uid()) or public.is_super_admin(auth.uid())) with check (exists (select 1 from public.tenant_members tm where tm.tenant_id = %I.tenant_id and tm.user_id = auth.uid()) or public.is_super_admin(auth.uid()))',
      t || '_all_member', t, t, t
    );
  end loop;
end $$;

alter table public.product_collections enable row level security;
drop policy if exists product_collections_all_member on public.product_collections;
create policy product_collections_all_member on public.product_collections for all
  to authenticated using (
    exists (select 1 from public.products p join public.tenant_members tm on tm.tenant_id = p.tenant_id and tm.user_id = auth.uid() where p.id = product_collections.product_id)
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.products p join public.tenant_members tm on tm.tenant_id = p.tenant_id and tm.user_id = auth.uid() where p.id = product_collections.product_id)
    or public.is_super_admin(auth.uid())
  );
