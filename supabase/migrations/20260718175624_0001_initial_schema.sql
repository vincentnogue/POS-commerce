/*
# LiAfrik Flow — Initial multi-tenant schema

## Summary
Creates the full foundation for a multi-tenant SaaS for African commerce management.

## Tables
1. `tenants` — organizations (one per client company). Country, currency, plan, onboarding state.
2. `stores` — physical points of sale belonging to a tenant (multi-store).
3. `tenant_members` — membership linking auth.users to a tenant with a role.
4. `custom_roles` — admin-defined roles with a JSONB permissions matrix per module.
5. `commercial_codes` — codes created by super_admin to track LIYHA GROUP sales reps.
6. `categories` — product categories per tenant.
7. `products` — catalog with variants, price, cost, stock thresholds.
8. `inventory` — stock levels per product per store.
9. `stock_movements` — entries/exits/adjustments audit trail.
10. `customers` — client directory per tenant.
11. `suppliers` — supplier directory per tenant.
12. `sales` — POS sales header.
13. `sale_items` — line items per sale.
14. `invoices` — formal invoices.
15. `invoice_items` — invoice line items.
16. `deliveries` — delivery tracking.
17. `expenses` — operational expenses.
18. `purchases` — supplier purchase orders.
19. `purchase_items` — purchase order lines.
20. `quotes` — quotes/proformas.
21. `quote_items` — quote lines.
22. `audit_log` — sensitive action audit trail.
23. `notifications` — in-app notifications per user.
24. `plans` — SaaS subscription plans (global).

## Security
- RLS enabled on every table.
- All tenant-scoped tables enforce `tenant_id` ownership via `auth.uid()` membership in `tenant_members`.
- `super_admin` role bypasses tenant scoping via helper `is_super_admin(uid)`.
- `audit_log`, `commercial_codes`, `plans` are super-admin-managed.

## Notes
1. Currency is locked at tenant creation and never changes.
2. Helper functions are defined AFTER all tables exist (plpgsql defers body parsing).
3. Policies are dropped (bare DROP POLICY, no FOR clause) then re-created for idempotency.
*/

-- ============================================================================
-- tenants
-- ============================================================================

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text,
  country_code text not null,
  country_name text not null,
  region text,
  city text,
  currency text not null,
  currency_locked boolean not null default true,
  plan_id uuid,
  commercial_code_id uuid,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- stores
-- ============================================================================

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  city text,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- custom_roles
-- ============================================================================

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- tenant_members
-- ============================================================================

create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff',
  custom_role_id uuid references public.custom_roles(id) on delete set null,
  display_name text,
  avatar_color text default 'action',
  invited_at timestamptz,
  accepted_at timestamptz default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- ============================================================================
-- commercial_codes
-- ============================================================================

create table if not exists public.commercial_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  rep_name text not null,
  rep_email text,
  region text,
  is_active boolean not null default true,
  total_sales integer not null default 0,
  total_revenue numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- categories
-- ============================================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  color text default 'brand',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- products
-- ============================================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  sku text,
  barcode text,
  description text,
  cost_price numeric not null default 0,
  sale_price numeric not null default 0,
  tax_rate numeric not null default 0,
  unit text default 'unité',
  variants jsonb default '[]'::jsonb,
  image_url text,
  low_stock_threshold integer not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- inventory
-- ============================================================================

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  quantity numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id, store_id)
);

-- ============================================================================
-- stock_movements
-- ============================================================================

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  movement_type text not null,
  quantity numeric not null,
  reason text,
  reference text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- customers
-- ============================================================================

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  city text,
  tax_id text,
  balance numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- suppliers
-- ============================================================================

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  city text,
  tax_id text,
  balance numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- sales
-- ============================================================================

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  commercial_code_id uuid references public.commercial_codes(id) on delete set null,
  reference text not null,
  subtotal numeric not null default 0,
  tax_total numeric not null default 0,
  discount_total numeric not null default 0,
  total numeric not null default 0,
  paid_amount numeric not null default 0,
  payment_method text,
  payment_status text not null default 'paid',
  sale_status text not null default 'completed',
  notes text,
  user_id uuid references auth.users(id) on delete set null,
  sale_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount numeric not null default 0,
  tax_rate numeric not null default 0,
  total numeric not null default 0,
  variant text
);

create index if not exists sales_tenant_date_idx on public.sales (tenant_id, sale_date desc);
create index if not exists sales_store_idx on public.sales (store_id);

-- ============================================================================
-- invoices
-- ============================================================================

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  number text not null,
  status text not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric not null default 0,
  tax_total numeric not null default 0,
  discount_total numeric not null default 0,
  total numeric not null default 0,
  paid_amount numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount numeric not null default 0,
  tax_rate numeric not null default 0,
  total numeric not null default 0
);

create index if not exists invoices_tenant_idx on public.invoices (tenant_id, created_at desc);

-- ============================================================================
-- deliveries
-- ============================================================================

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  customer_name text not null,
  address text,
  city text,
  phone text,
  status text not null default 'pending',
  carrier text,
  tracking_number text,
  scheduled_date date,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- expenses
-- ============================================================================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  category text,
  description text not null,
  amount numeric not null default 0,
  payment_method text,
  expense_date date not null default current_date,
  supplier_id uuid references public.suppliers(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- purchases
-- ============================================================================

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  reference text not null,
  status text not null default 'draft',
  subtotal numeric not null default 0,
  tax_total numeric not null default 0,
  total numeric not null default 0,
  paid_amount numeric not null default 0,
  purchase_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity numeric not null default 1,
  unit_cost numeric not null default 0,
  total numeric not null default 0
);

-- ============================================================================
-- quotes
-- ============================================================================

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  number text not null,
  status text not null default 'draft',
  issue_date date not null default current_date,
  expiry_date date,
  subtotal numeric not null default 0,
  tax_total numeric not null default 0,
  discount_total numeric not null default 0,
  total numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount numeric not null default 0,
  tax_rate numeric not null default 0,
  total numeric not null default 0
);

-- ============================================================================
-- plans
-- ============================================================================

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  price_usd numeric not null default 0,
  max_users integer not null default 1,
  max_stores integer not null default 1,
  max_products integer not null default 50,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- notifications
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  type text default 'info',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- audit_log
-- ============================================================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity text,
  entity_id uuid,
  details jsonb,
  ip text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Helper functions (plpgsql defers body parsing)
-- ============================================================================

create or replace function public.is_super_admin(uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.tenant_members
    where user_id = uid and role = 'super_admin'
  );
end;
$$;

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================

alter table public.tenants enable row level security;
alter table public.stores enable row level security;
alter table public.custom_roles enable row level security;
alter table public.tenant_members enable row level security;
alter table public.commercial_codes enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.stock_movements enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.deliveries enable row level security;
alter table public.expenses enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.plans enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- ============================================================================
-- Policies: tenants
-- ============================================================================

drop policy if exists "tenants_select_member" on public.tenants;
create policy "tenants_select_member" on public.tenants for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = tenants.id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "tenants_insert_self" on public.tenants;
create policy "tenants_insert_self" on public.tenants for insert
  to authenticated with check (true);

drop policy if exists "tenants_update_member" on public.tenants;
create policy "tenants_update_member" on public.tenants for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = tenants.id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = tenants.id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "tenants_delete_super_admin" on public.tenants;
create policy "tenants_delete_super_admin" on public.tenants for delete
  to authenticated using (public.is_super_admin(auth.uid()));

-- ============================================================================
-- Policies: stores
-- ============================================================================

drop policy if exists "stores_select_member" on public.stores;
create policy "stores_select_member" on public.stores for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "stores_insert_member" on public.stores;
create policy "stores_insert_member" on public.stores for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin','manager'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "stores_update_member" on public.stores;
create policy "stores_update_member" on public.stores for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin','manager'))
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin','manager'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "stores_delete_member" on public.stores;
create policy "stores_delete_member" on public.stores for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: custom_roles
-- ============================================================================

drop policy if exists "roles_select_member" on public.custom_roles;
create policy "roles_select_member" on public.custom_roles for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = custom_roles.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "roles_insert_admin" on public.custom_roles;
create policy "roles_insert_admin" on public.custom_roles for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = custom_roles.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "roles_update_admin" on public.custom_roles;
create policy "roles_update_admin" on public.custom_roles for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = custom_roles.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = custom_roles.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "roles_delete_admin" on public.custom_roles;
create policy "roles_delete_admin" on public.custom_roles for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = custom_roles.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: tenant_members
-- ============================================================================

drop policy if exists "members_select_self_or_admin" on public.tenant_members;
create policy "members_select_self_or_admin" on public.tenant_members for select
  to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.tenant_members tm where tm.tenant_id = tenant_members.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin','manager'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "members_insert_admin" on public.tenant_members;
create policy "members_insert_admin" on public.tenant_members for insert
  to authenticated with check (
    (user_id = auth.uid())
    or exists (select 1 from public.tenant_members tm where tm.tenant_id = tenant_members.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "members_update_admin" on public.tenant_members;
create policy "members_update_admin" on public.tenant_members for update
  to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.tenant_members tm where tm.tenant_id = tenant_members.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = tenant_members.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists "members_delete_admin" on public.tenant_members;
create policy "members_delete_admin" on public.tenant_members for delete
  to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.tenant_members tm where tm.tenant_id = tenant_members.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: commercial_codes (super_admin only)
-- ============================================================================

drop policy if exists "commercial_codes_select_auth" on public.commercial_codes;
create policy "commercial_codes_select_auth" on public.commercial_codes for select
  to authenticated using (public.is_super_admin(auth.uid()));

drop policy if exists "commercial_codes_insert_super" on public.commercial_codes;
create policy "commercial_codes_insert_super" on public.commercial_codes for insert
  to authenticated with check (public.is_super_admin(auth.uid()));

drop policy if exists "commercial_codes_update_super" on public.commercial_codes;
create policy "commercial_codes_update_super" on public.commercial_codes for update
  to authenticated using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));

drop policy if exists "commercial_codes_delete_super" on public.commercial_codes;
create policy "commercial_codes_delete_super" on public.commercial_codes for delete
  to authenticated using (public.is_super_admin(auth.uid()));

-- ============================================================================
-- Policies: categories
-- ============================================================================

drop policy if exists "categories_select_member" on public.categories;
create policy "categories_select_member" on public.categories for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = categories.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "categories_insert_member" on public.categories;
create policy "categories_insert_member" on public.categories for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = categories.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "categories_update_member" on public.categories;
create policy "categories_update_member" on public.categories for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = categories.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = categories.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "categories_delete_member" on public.categories;
create policy "categories_delete_member" on public.categories for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = categories.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: products
-- ============================================================================

drop policy if exists "products_select_member" on public.products;
create policy "products_select_member" on public.products for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "products_insert_member" on public.products;
create policy "products_insert_member" on public.products for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "products_update_member" on public.products;
create policy "products_update_member" on public.products for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "products_delete_member" on public.products;
create policy "products_delete_member" on public.products for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: inventory
-- ============================================================================

drop policy if exists "inventory_select_member" on public.inventory;
create policy "inventory_select_member" on public.inventory for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "inventory_insert_member" on public.inventory;
create policy "inventory_insert_member" on public.inventory for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "inventory_update_member" on public.inventory;
create policy "inventory_update_member" on public.inventory for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "inventory_delete_member" on public.inventory;
create policy "inventory_delete_member" on public.inventory for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: stock_movements
-- ============================================================================

drop policy if exists "movements_select_member" on public.stock_movements;
create policy "movements_select_member" on public.stock_movements for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = stock_movements.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "movements_insert_member" on public.stock_movements;
create policy "movements_insert_member" on public.stock_movements for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = stock_movements.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "movements_delete_member" on public.stock_movements;
create policy "movements_delete_member" on public.stock_movements for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = stock_movements.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: customers
-- ============================================================================

drop policy if exists "customers_select_member" on public.customers;
create policy "customers_select_member" on public.customers for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "customers_insert_member" on public.customers;
create policy "customers_insert_member" on public.customers for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "customers_update_member" on public.customers;
create policy "customers_update_member" on public.customers for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "customers_delete_member" on public.customers;
create policy "customers_delete_member" on public.customers for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: suppliers
-- ============================================================================

drop policy if exists "suppliers_select_member" on public.suppliers;
create policy "suppliers_select_member" on public.suppliers for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "suppliers_insert_member" on public.suppliers;
create policy "suppliers_insert_member" on public.suppliers for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "suppliers_update_member" on public.suppliers;
create policy "suppliers_update_member" on public.suppliers for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "suppliers_delete_member" on public.suppliers;
create policy "suppliers_delete_member" on public.suppliers for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: sales
-- ============================================================================

drop policy if exists "sales_select_member" on public.sales;
create policy "sales_select_member" on public.sales for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = sales.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "sales_insert_member" on public.sales;
create policy "sales_insert_member" on public.sales for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = sales.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "sales_update_member" on public.sales;
create policy "sales_update_member" on public.sales for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = sales.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = sales.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "sales_delete_member" on public.sales;
create policy "sales_delete_member" on public.sales for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = sales.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: sale_items
-- ============================================================================

drop policy if exists "sale_items_select_member" on public.sale_items;
create policy "sale_items_select_member" on public.sale_items for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_items.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "sale_items_insert_member" on public.sale_items;
create policy "sale_items_insert_member" on public.sale_items for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_items.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "sale_items_update_member" on public.sale_items;
create policy "sale_items_update_member" on public.sale_items for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_items.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_items.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "sale_items_delete_member" on public.sale_items;
create policy "sale_items_delete_member" on public.sale_items for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_items.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: invoices
-- ============================================================================

drop policy if exists "invoices_select_member" on public.invoices;
create policy "invoices_select_member" on public.invoices for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "invoices_insert_member" on public.invoices;
create policy "invoices_insert_member" on public.invoices for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "invoices_update_member" on public.invoices;
create policy "invoices_update_member" on public.invoices for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "invoices_delete_member" on public.invoices;
create policy "invoices_delete_member" on public.invoices for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: invoice_items
-- ============================================================================

drop policy if exists "invoice_items_select_member" on public.invoice_items;
create policy "invoice_items_select_member" on public.invoice_items for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.invoices i on i.id = invoice_items.invoice_id
      where tm.tenant_id = i.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "invoice_items_insert_member" on public.invoice_items;
create policy "invoice_items_insert_member" on public.invoice_items for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm
      join public.invoices i on i.id = invoice_items.invoice_id
      where tm.tenant_id = i.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "invoice_items_update_member" on public.invoice_items;
create policy "invoice_items_update_member" on public.invoice_items for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.invoices i on i.id = invoice_items.invoice_id
      where tm.tenant_id = i.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm
      join public.invoices i on i.id = invoice_items.invoice_id
      where tm.tenant_id = i.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "invoice_items_delete_member" on public.invoice_items;
create policy "invoice_items_delete_member" on public.invoice_items for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.invoices i on i.id = invoice_items.invoice_id
      where tm.tenant_id = i.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: deliveries
-- ============================================================================

drop policy if exists "deliveries_select_member" on public.deliveries;
create policy "deliveries_select_member" on public.deliveries for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "deliveries_insert_member" on public.deliveries;
create policy "deliveries_insert_member" on public.deliveries for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "deliveries_update_member" on public.deliveries;
create policy "deliveries_update_member" on public.deliveries for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "deliveries_delete_member" on public.deliveries;
create policy "deliveries_delete_member" on public.deliveries for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: expenses
-- ============================================================================

drop policy if exists "expenses_select_member" on public.expenses;
create policy "expenses_select_member" on public.expenses for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "expenses_insert_member" on public.expenses;
create policy "expenses_insert_member" on public.expenses for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "expenses_update_member" on public.expenses;
create policy "expenses_update_member" on public.expenses for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "expenses_delete_member" on public.expenses;
create policy "expenses_delete_member" on public.expenses for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: purchases
-- ============================================================================

drop policy if exists "purchases_select_member" on public.purchases;
create policy "purchases_select_member" on public.purchases for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "purchases_insert_member" on public.purchases;
create policy "purchases_insert_member" on public.purchases for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "purchases_update_member" on public.purchases;
create policy "purchases_update_member" on public.purchases for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "purchases_delete_member" on public.purchases;
create policy "purchases_delete_member" on public.purchases for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "purchase_items_select_member" on public.purchase_items;
create policy "purchase_items_select_member" on public.purchase_items for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.purchases p on p.id = purchase_items.purchase_id
      where tm.tenant_id = p.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "purchase_items_insert_member" on public.purchase_items;
create policy "purchase_items_insert_member" on public.purchase_items for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm
      join public.purchases p on p.id = purchase_items.purchase_id
      where tm.tenant_id = p.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "purchase_items_delete_member" on public.purchase_items;
create policy "purchase_items_delete_member" on public.purchase_items for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.purchases p on p.id = purchase_items.purchase_id
      where tm.tenant_id = p.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: quotes
-- ============================================================================

drop policy if exists "quotes_select_member" on public.quotes;
create policy "quotes_select_member" on public.quotes for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "quotes_insert_member" on public.quotes;
create policy "quotes_insert_member" on public.quotes for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "quotes_update_member" on public.quotes;
create policy "quotes_update_member" on public.quotes for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "quotes_delete_member" on public.quotes;
create policy "quotes_delete_member" on public.quotes for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "quote_items_select_member" on public.quote_items;
create policy "quote_items_select_member" on public.quote_items for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.quotes q on q.id = quote_items.quote_id
      where tm.tenant_id = q.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "quote_items_insert_member" on public.quote_items;
create policy "quote_items_insert_member" on public.quote_items for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm
      join public.quotes q on q.id = quote_items.quote_id
      where tm.tenant_id = q.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "quote_items_delete_member" on public.quote_items;
create policy "quote_items_delete_member" on public.quote_items for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.quotes q on q.id = quote_items.quote_id
      where tm.tenant_id = q.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Policies: plans (readable by all authenticated; managed by super_admin)
-- ============================================================================

drop policy if exists "plans_select_all" on public.plans;
create policy "plans_select_all" on public.plans for select
  to authenticated using (true);

drop policy if exists "plans_insert_super" on public.plans;
create policy "plans_insert_super" on public.plans for insert
  to authenticated with check (public.is_super_admin(auth.uid()));

drop policy if exists "plans_update_super" on public.plans;
create policy "plans_update_super" on public.plans for update
  to authenticated using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));

drop policy if exists "plans_delete_super" on public.plans;
create policy "plans_delete_super" on public.plans for delete
  to authenticated using (public.is_super_admin(auth.uid()));

-- ============================================================================
-- Policies: notifications (owner-scoped)
-- ============================================================================

drop policy if exists "notifications_select_self" on public.notifications;
create policy "notifications_select_self" on public.notifications for select
  to authenticated using (user_id = auth.uid());

drop policy if exists "notifications_insert_self" on public.notifications;
create policy "notifications_insert_self" on public.notifications for insert
  to authenticated with check (user_id = auth.uid());

drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self" on public.notifications for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_delete_self" on public.notifications;
create policy "notifications_delete_self" on public.notifications for delete
  to authenticated using (user_id = auth.uid());

-- ============================================================================
-- Policies: audit_log
-- ============================================================================

drop policy if exists "audit_select_admin" on public.audit_log;
create policy "audit_select_admin" on public.audit_log for select
  to authenticated using (
    public.is_super_admin(auth.uid())
    or (tenant_id is not null and exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = audit_log.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin')
    ))
  );

drop policy if exists "audit_insert_member" on public.audit_log;
create policy "audit_insert_member" on public.audit_log for insert
  to authenticated with check (true);

-- ============================================================================
-- Seed default plans
-- ============================================================================

insert into public.plans (name, code, price_usd, max_users, max_stores, max_products, features, sort_order)
values
  ('Starter', 'starter', 0, 2, 1, 50, '["POS","Produits","Stock","Clients","1 magasin"]'::jsonb, 0),
  ('Business', 'business', 29, 10, 3, 1000, '["POS","Produits","Stock","Factures","Livraisons","Clients","Fournisseurs","Dépenses","Rapports","3 magasins"]'::jsonb, 1),
  ('Enterprise', 'enterprise', 99, 50, 20, 100000, '["Tous les modules","Magasins illimités","Comptabilité","Multi-rôles","Support prioritaire"]'::jsonb, 2)
on conflict (code) do nothing;
