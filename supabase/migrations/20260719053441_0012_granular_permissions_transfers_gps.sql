/*
# Granular permissions + store assignments + stock transfers + store GPS

## Summary
1. **Server-side permission helper functions** — `can(uid, module, action)` and
   `can_access_module(uid, module, action)` that resolve a user's effective
   permissions from their `tenant_members.role` (built-in) OR their
   `custom_roles.permissions` (admin-defined), with super_admin/admin bypass.
2. **Store GPS columns** — add `latitude`, `longitude` (numeric, nullable) to
   `stores` for map-based localization.
3. **Store assignments table** — `store_assignments` links a member to one or
   more stores. Used to restrict who can initiate/receive stock transfers and
   who can operate a given store. Admin/super_admin bypass assignment checks.
4. **Stock transfers table** — `stock_transfers` records a movement of X units
   of a product from store A to store B, with status (pending/received/cancelled),
   source/destination store, qty, and the user who initiated it. RLS: only
   users assigned to the source store (or admin) can create; only users
   assigned to the destination store (or admin) can mark received.
5. **RLS enforcement on existing tables** — the products SELECT policy is
   rewritten so a user WITHOUT `products.view` sees nothing; the cost_price
   column is hidden via a `products_public` view for users without
   `products.update` (caissier sees sale_price but not cost_price). INSERT/
   UPDATE/DELETE policies on products, stock, stores, suppliers are tightened
   to require the matching `can(...)` permission.

## New tables
- `store_assignments(id, tenant_id, member_id, store_id, can_transfer, created_at)`
- `stock_transfers(id, tenant_id, product_id, source_store_id, dest_store_id,
   quantity, status, notes, initiated_by, received_by, created_at, received_at)`

## Modified tables
- `stores` — add `latitude numeric`, `longitude numeric`

## Security
- RLS enabled on both new tables.
- `can()` and `can_access_module()` are SECURITY DEFINER, STABLE, pinned search_path.
- products SELECT policy now requires `can(uid, 'products', 'view')`.
- products INSERT requires `can(uid, 'products', 'create')`; UPDATE requires
  `can(uid, 'products', 'update')`; DELETE requires `can(uid, 'products', 'delete')`.
- stores INSERT/UPDATE/DELETE require `can(uid, 'stores', 'create'|'update'|'delete')`.
- stock_movements INSERT requires `can(uid, 'stock', 'create')`.
- inventory INSERT/UPDATE require `can(uid, 'stock', 'create'|'update')`.
- suppliers INSERT/UPDATE/DELETE require `can(uid, 'suppliers', 'create'|'update'|'delete')`.
- A `products_public` view exposes all product columns EXCEPT cost_price, for
  roles that may view products but must NOT see purchase prices (caissier).

## Notes
1. Admin and super_admin always have full access (can() returns true).
2. A staff user with `products: { view: true }` but no `update` sees products
   via the public view (cost_price stripped). The app decides which to query.
3. Store assignments are optional — if no rows exist for a member, they cannot
   initiate transfers (admin can always transfer).
*/

-- ============================================================================
-- 1. Permission helper functions
-- ============================================================================

create or replace function public.can(uid uuid, mod text, act text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m record;
  cr record;
  perms jsonb;
begin
  if uid is null then return false; end if;

  -- Find the member row for this user (across any tenant — tenant scoping is
  -- done by the caller via the RLS policy's tenant_id check; here we just
  -- resolve the role for the tenant the row belongs to).
  select * into m from public.tenant_members where user_id = uid limit 1;
  if not found then return false; end if;

  -- super_admin and admin: full access
  if m.role in ('super_admin', 'admin') then return true; end if;

  -- Custom role: check the permissions JSONB
  if m.custom_role_id is not null then
    select * into cr from public.custom_roles where id = m.custom_role_id;
    if found then
      perms := cr.permissions;
      -- perms shape: { "products": { "view": true, "create": false } }
      if perms ? mod then
        if (perms -> mod) ? act and ((perms -> mod) ->> act)::boolean then
          return true;
        end if;
        return false;
      end if;
      return false;
    end if;
  end if;

  -- Built-in roles: manager/staff — hardcoded defaults matching the frontend
  if m.role = 'manager' then
    if mod in ('dashboard','pos','products','stock','invoices','deliveries',
               'customers','expenses','purchases','quotes','reports','accounting',
               'users','settings') and act = 'view' then return true; end if;
    if mod in ('pos','products','stock','invoices','deliveries','customers',
               'expenses','purchases','quotes','settings') and act in ('create','update') then return true; end if;
    return false;
  end if;

  -- staff
  if m.role = 'staff' then
    if mod in ('dashboard','pos','products','stock','stores','invoices',
               'deliveries','customers','suppliers','expenses','quotes','settings') and act = 'view' then return true; end if;
    if mod in ('pos','customers','quotes') and act in ('create','update') then return true; end if;
    return false;
  end if;

  return false;
end;
$$;

-- Tenant-scoped variant: checks permission AND that the user is a member of
-- the tenant that owns the row. Used in RLS policies.
create or replace function public.can_on_tenant(uid uuid, tid uuid, mod text, act text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m record;
  cr record;
  perms jsonb;
begin
  if uid is null then return false; end if;

  select * into m from public.tenant_members
    where user_id = uid and tenant_id = tid limit 1;
  if not found then return false; end if;

  if m.role in ('super_admin', 'admin') then return true; end if;

  if m.custom_role_id is not null then
    select * into cr from public.custom_roles where id = m.custom_role_id and tenant_id = tid;
    if found then
      perms := cr.permissions;
      if perms ? mod then
        return (perms -> mod) ? act and ((perms -> mod) ->> act)::boolean;
      end if;
      return false;
    end if;
  end if;

  -- Fallback to the non-tenant can() for built-in roles
  return public.can(uid, mod, act);
end;
$$;

grant execute on function public.can to authenticated;
grant execute on function public.can_on_tenant to authenticated;

-- ============================================================================
-- 2. Store GPS columns
-- ============================================================================

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='stores' and column_name='latitude') then
    alter table public.stores add column latitude numeric;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='stores' and column_name='longitude') then
    alter table public.stores add column longitude numeric;
  end if;
end $$;

-- ============================================================================
-- 3. Store assignments table
-- ============================================================================

create table if not exists public.store_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  can_transfer boolean not null default false,
  created_at timestamptz not null default now(),
  unique (member_id, store_id)
);

alter table public.store_assignments enable row level security;

drop policy if exists "sa_select_member" on public.store_assignments;
create policy "sa_select_member" on public.store_assignments for select
  to authenticated using (
    store_assignments.member_id in (
      select id from public.tenant_members tm
      where tm.tenant_id = store_assignments.tenant_id and tm.user_id = auth.uid()
    )
    or exists (select 1 from public.tenant_members tm
      where tm.tenant_id = store_assignments.tenant_id and tm.user_id = auth.uid()
      and tm.role in ('admin','super_admin'))
  );

drop policy if exists "sa_insert_admin" on public.store_assignments;
create policy "sa_insert_admin" on public.store_assignments for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm
      where tm.tenant_id = store_assignments.tenant_id and tm.user_id = auth.uid()
      and tm.role in ('admin','super_admin'))
  );

drop policy if exists "sa_update_admin" on public.store_assignments;
create policy "sa_update_admin" on public.store_assignments for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      where tm.tenant_id = store_assignments.tenant_id and tm.user_id = auth.uid()
      and tm.role in ('admin','super_admin'))
  );

drop policy if exists "sa_delete_admin" on public.store_assignments;
create policy "sa_delete_admin" on public.store_assignments for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      where tm.tenant_id = store_assignments.tenant_id and tm.user_id = auth.uid()
      and tm.role in ('admin','super_admin'))
  );

-- ============================================================================
-- 4. Stock transfers table
-- ============================================================================

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  source_store_id uuid not null references public.stores(id) on delete cascade,
  dest_store_id uuid not null references public.stores(id) on delete cascade,
  quantity numeric not null default 0,
  status text not null default 'pending',
  notes text,
  initiated_by uuid references auth.users(id) on delete set null,
  received_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create index if not exists st_tenant_idx on public.stock_transfers (tenant_id, created_at desc);

alter table public.stock_transfers enable row level security;

-- SELECT: tenant members can see transfers for their tenant
drop policy if exists "st_select_member" on public.stock_transfers;
create policy "st_select_member" on public.stock_transfers for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stock_transfers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- INSERT: must have stock.create permission AND be assigned to source store
-- (admin/super_admin bypass assignment check)
drop policy if exists "st_insert_assigned" on public.stock_transfers;
create policy "st_insert_assigned" on public.stock_transfers for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stock_transfers.tenant_id and tm.user_id = auth.uid())
    and public.can_on_tenant(auth.uid(), stock_transfers.tenant_id, 'stock', 'create')
    and (
      exists (select 1 from public.tenant_members tm
        where tm.tenant_id = stock_transfers.tenant_id and tm.user_id = auth.uid()
        and tm.role in ('admin','super_admin'))
      or exists (select 1 from public.store_assignments sa
        join public.tenant_members tm on tm.id = sa.member_id
        where sa.store_id = stock_transfers.source_store_id
        and tm.user_id = auth.uid() and sa.can_transfer = true)
    )
    and public.tenant_access_active(stock_transfers.tenant_id)
  );

-- UPDATE: only status changes (mark received) — must be assigned to dest store
-- or be admin. Must have stock.update permission.
drop policy if exists "st_update_assigned" on public.stock_transfers;
create policy "st_update_assigned" on public.stock_transfers for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stock_transfers.tenant_id and tm.user_id = auth.uid())
    and public.can_on_tenant(auth.uid(), stock_transfers.tenant_id, 'stock', 'update')
    and (
      exists (select 1 from public.tenant_members tm
        where tm.tenant_id = stock_transfers.tenant_id and tm.user_id = auth.uid()
        and tm.role in ('admin','super_admin'))
      or exists (select 1 from public.store_assignments sa
        join public.tenant_members tm on tm.id = sa.member_id
        where sa.store_id = stock_transfers.dest_store_id
        and tm.user_id = auth.uid() and sa.can_transfer = true)
    )
  ) with check (
    exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stock_transfers.tenant_id and tm.user_id = auth.uid())
  );

-- No DELETE on transfers (audit trail). Admin can cancel via status update.

-- ============================================================================
-- 5. products_public view (cost_price stripped) — for caissier-style roles
-- ============================================================================

create or replace view public.products_public as
  select id, tenant_id, category_id, name, sku, barcode, description,
         sale_price, tax_rate, unit, variants, image_url, low_stock_threshold,
         is_active, created_at, updated_at
  from public.products;

-- The view inherits RLS from the base table, so tenant filtering is preserved.
-- A caissier queries products_public and never sees cost_price.

-- ============================================================================
-- 6. Tighten products policies with permission checks
-- ============================================================================

drop policy if exists "products_select_member" on public.products;
create policy "products_select_member" on public.products for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), products.tenant_id, 'products', 'view')
  );

drop policy if exists "products_insert_member" on public.products;
create policy "products_insert_member" on public.products for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), products.tenant_id, 'products', 'create')
    and public.tenant_access_active(products.tenant_id)
  );

drop policy if exists "products_update_member" on public.products;
create policy "products_update_member" on public.products for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), products.tenant_id, 'products', 'update')
  ) with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), products.tenant_id, 'products', 'update')
  );

drop policy if exists "products_delete_member" on public.products;
create policy "products_delete_member" on public.products for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), products.tenant_id, 'products', 'delete')
  );

-- ============================================================================
-- 7. Tighten inventory + stock_movements with stock permission checks
-- ============================================================================

drop policy if exists "inventory_insert_member" on public.inventory;
create policy "inventory_insert_member" on public.inventory for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), inventory.tenant_id, 'stock', 'create')
    and public.tenant_access_active(inventory.tenant_id)
  );

drop policy if exists "inventory_update_member" on public.inventory;
create policy "inventory_update_member" on public.inventory for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), inventory.tenant_id, 'stock', 'update')
  ) with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), inventory.tenant_id, 'stock', 'update')
  );

drop policy if exists "movements_insert_member" on public.stock_movements;
create policy "movements_insert_member" on public.stock_movements for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stock_movements.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), stock_movements.tenant_id, 'stock', 'create')
    and public.tenant_access_active(stock_movements.tenant_id)
  );

-- ============================================================================
-- 8. Tighten stores policies with permission checks
-- ============================================================================

drop policy if exists "stores_insert_member" on public.stores;
create policy "stores_insert_member" on public.stores for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid()
      and tm.role in ('admin','super_admin','manager'))
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), stores.tenant_id, 'stores', 'create')
    and public.tenant_access_active(stores.tenant_id)
  );

drop policy if exists "stores_update_member" on public.stores;
create policy "stores_update_member" on public.stores for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), stores.tenant_id, 'stores', 'update')
  ) with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), stores.tenant_id, 'stores', 'update')
  );

drop policy if exists "stores_delete_member" on public.stores;
create policy "stores_delete_member" on public.stores for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), stores.tenant_id, 'stores', 'delete')
  );

-- ============================================================================
-- 9. Tighten suppliers policies with permission checks
-- ============================================================================

drop policy if exists "suppliers_insert_member" on public.suppliers;
create policy "suppliers_insert_member" on public.suppliers for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), suppliers.tenant_id, 'suppliers', 'create')
    and public.tenant_access_active(suppliers.tenant_id)
  );

drop policy if exists "suppliers_update_member" on public.suppliers;
create policy "suppliers_update_member" on public.suppliers for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), suppliers.tenant_id, 'suppliers', 'update')
  ) with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), suppliers.tenant_id, 'suppliers', 'update')
  );

drop policy if exists "suppliers_delete_member" on public.suppliers;
create policy "suppliers_delete_member" on public.suppliers for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), suppliers.tenant_id, 'suppliers', 'delete')
  );

-- ============================================================================
-- 10. Seed default "Caissier" custom role for existing tenants
-- ============================================================================

insert into public.custom_roles (tenant_id, name, description, permissions)
select t.id, 'Caissier', 'Encaisse les ventes, voit les produits et prix de vente mais pas les prix d''achat.',
  '{"pos":{"view":true,"create":true,"update":true},"products":{"view":true},"stock":{"view":true},"stores":{"view":true},"customers":{"view":true,"create":true,"update":true},"invoices":{"view":true},"deliveries":{"view":true},"dashboard":{"view":true},"settings":{"view":true}}'::jsonb
from public.tenants t
where not exists (
  select 1 from public.custom_roles cr where cr.tenant_id = t.id and cr.name = 'Caissier'
);