-- Extends the granular permission enforcement introduced in migration 0012
-- (which only covered products, store_assignments, stock_transfers, and
-- write-only on inventory/stock_movements/stores/suppliers) to every
-- remaining business table. Before this migration, a custom role that
-- explicitly excluded a module (e.g. "no access to Dépenses") had that
-- respected only by the UI — the database itself allowed any tenant
-- member to read AND write that data directly via the API regardless of
-- their role's permissions. This closes that gap using the same
-- can_on_tenant(uid, tenant_id, module, action) helper already in place.

-- ============================================================================
-- customers (module: customers)
-- ============================================================================
drop policy if exists "customers_select_member" on public.customers;
create policy "customers_select_member" on public.customers for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), customers.tenant_id, 'customers', 'view')
  );

drop policy if exists "customers_insert_member" on public.customers;
create policy "customers_insert_member" on public.customers for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), customers.tenant_id, 'customers', 'create')
  );

drop policy if exists "customers_update_member" on public.customers;
create policy "customers_update_member" on public.customers for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), customers.tenant_id, 'customers', 'update')
  );

drop policy if exists "customers_delete_member" on public.customers;
create policy "customers_delete_member" on public.customers for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), customers.tenant_id, 'customers', 'delete')
  );

-- ============================================================================
-- suppliers select (write policies already gated since migration 0012)
-- ============================================================================
drop policy if exists "suppliers_select_member" on public.suppliers;
create policy "suppliers_select_member" on public.suppliers for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), suppliers.tenant_id, 'suppliers', 'view')
  );

-- ============================================================================
-- sales + sale_items (module: pos)
-- ============================================================================
drop policy if exists "sales_select_member" on public.sales;
create policy "sales_select_member" on public.sales for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = sales.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), sales.tenant_id, 'pos', 'view')
  );

drop policy if exists "sales_insert_member" on public.sales;
create policy "sales_insert_member" on public.sales for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = sales.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), sales.tenant_id, 'pos', 'create')
  );

drop policy if exists "sale_items_select_member" on public.sale_items;
create policy "sale_items_select_member" on public.sale_items for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_items.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), s.tenant_id, 'pos', 'view'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "sale_items_insert_member" on public.sale_items;
create policy "sale_items_insert_member" on public.sale_items for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_items.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), s.tenant_id, 'pos', 'create'))
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- invoices + invoice_items (module: invoices)
-- ============================================================================
drop policy if exists "invoices_select_member" on public.invoices;
create policy "invoices_select_member" on public.invoices for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), invoices.tenant_id, 'invoices', 'view')
  );

drop policy if exists "invoices_insert_member" on public.invoices;
create policy "invoices_insert_member" on public.invoices for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), invoices.tenant_id, 'invoices', 'create')
  );

drop policy if exists "invoices_update_member" on public.invoices;
create policy "invoices_update_member" on public.invoices for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), invoices.tenant_id, 'invoices', 'update')
  );

drop policy if exists "invoices_delete_member" on public.invoices;
create policy "invoices_delete_member" on public.invoices for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), invoices.tenant_id, 'invoices', 'delete')
  );

drop policy if exists "invoice_items_select_member" on public.invoice_items;
create policy "invoice_items_select_member" on public.invoice_items for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.invoices i on i.id = invoice_items.invoice_id
      where tm.tenant_id = i.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), i.tenant_id, 'invoices', 'view'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "invoice_items_insert_member" on public.invoice_items;
create policy "invoice_items_insert_member" on public.invoice_items for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm
      join public.invoices i on i.id = invoice_items.invoice_id
      where tm.tenant_id = i.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), i.tenant_id, 'invoices', 'create'))
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- expenses (module: expenses)
-- ============================================================================
drop policy if exists "expenses_select_member" on public.expenses;
create policy "expenses_select_member" on public.expenses for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), expenses.tenant_id, 'expenses', 'view')
  );

drop policy if exists "expenses_insert_member" on public.expenses;
create policy "expenses_insert_member" on public.expenses for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), expenses.tenant_id, 'expenses', 'create')
  );

drop policy if exists "expenses_update_member" on public.expenses;
create policy "expenses_update_member" on public.expenses for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), expenses.tenant_id, 'expenses', 'update')
  );

drop policy if exists "expenses_delete_member" on public.expenses;
create policy "expenses_delete_member" on public.expenses for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), expenses.tenant_id, 'expenses', 'delete')
  );

-- ============================================================================
-- purchases + purchase_items (module: purchases)
-- ============================================================================
drop policy if exists "purchases_select_member" on public.purchases;
create policy "purchases_select_member" on public.purchases for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), purchases.tenant_id, 'purchases', 'view')
  );

drop policy if exists "purchases_insert_member" on public.purchases;
create policy "purchases_insert_member" on public.purchases for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), purchases.tenant_id, 'purchases', 'create')
  );

drop policy if exists "purchases_update_member" on public.purchases;
create policy "purchases_update_member" on public.purchases for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), purchases.tenant_id, 'purchases', 'update')
  );

drop policy if exists "purchases_delete_member" on public.purchases;
create policy "purchases_delete_member" on public.purchases for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), purchases.tenant_id, 'purchases', 'delete')
  );

drop policy if exists "purchase_items_select_member" on public.purchase_items;
create policy "purchase_items_select_member" on public.purchase_items for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.purchases p on p.id = purchase_items.purchase_id
      where tm.tenant_id = p.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), p.tenant_id, 'purchases', 'view'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "purchase_items_insert_member" on public.purchase_items;
create policy "purchase_items_insert_member" on public.purchase_items for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm
      join public.purchases p on p.id = purchase_items.purchase_id
      where tm.tenant_id = p.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), p.tenant_id, 'purchases', 'create'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "purchase_items_update_member" on public.purchase_items;
create policy "purchase_items_update_member" on public.purchase_items for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.purchases p on p.id = purchase_items.purchase_id
      where tm.tenant_id = p.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), p.tenant_id, 'purchases', 'update'))
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- quotes + quote_items (module: quotes)
-- ============================================================================
drop policy if exists "quotes_select_member" on public.quotes;
create policy "quotes_select_member" on public.quotes for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), quotes.tenant_id, 'quotes', 'view')
  );

drop policy if exists "quotes_insert_member" on public.quotes;
create policy "quotes_insert_member" on public.quotes for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), quotes.tenant_id, 'quotes', 'create')
  );

drop policy if exists "quotes_update_member" on public.quotes;
create policy "quotes_update_member" on public.quotes for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), quotes.tenant_id, 'quotes', 'update')
  );

drop policy if exists "quotes_delete_member" on public.quotes;
create policy "quotes_delete_member" on public.quotes for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), quotes.tenant_id, 'quotes', 'delete')
  );

drop policy if exists "quote_items_select_member" on public.quote_items;
create policy "quote_items_select_member" on public.quote_items for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm
      join public.quotes q on q.id = quote_items.quote_id
      where tm.tenant_id = q.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), q.tenant_id, 'quotes', 'view'))
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "quote_items_insert_member" on public.quote_items;
create policy "quote_items_insert_member" on public.quote_items for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm
      join public.quotes q on q.id = quote_items.quote_id
      where tm.tenant_id = q.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), q.tenant_id, 'quotes', 'create'))
    or public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- deliveries (module: deliveries)
-- ============================================================================
drop policy if exists "deliveries_select_member" on public.deliveries;
create policy "deliveries_select_member" on public.deliveries for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), deliveries.tenant_id, 'deliveries', 'view')
  );

drop policy if exists "deliveries_insert_member" on public.deliveries;
create policy "deliveries_insert_member" on public.deliveries for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), deliveries.tenant_id, 'deliveries', 'create')
  );

drop policy if exists "deliveries_update_member" on public.deliveries;
create policy "deliveries_update_member" on public.deliveries for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), deliveries.tenant_id, 'deliveries', 'update')
  );

-- ============================================================================
-- categories (module: products — categories are part of product management)
-- ============================================================================
drop policy if exists "categories_select_member" on public.categories;
create policy "categories_select_member" on public.categories for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = categories.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), categories.tenant_id, 'products', 'view')
  );

drop policy if exists "categories_insert_member" on public.categories;
create policy "categories_insert_member" on public.categories for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = categories.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), categories.tenant_id, 'products', 'create')
  );

-- ============================================================================
-- inventory + stock_movements + stores select (write already gated in 0012)
-- ============================================================================
drop policy if exists "inventory_select_member" on public.inventory;
create policy "inventory_select_member" on public.inventory for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), inventory.tenant_id, 'stock', 'view')
  );

drop policy if exists "movements_select_member" on public.stock_movements;
create policy "movements_select_member" on public.stock_movements for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = stock_movements.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), stock_movements.tenant_id, 'stock', 'view')
  );

drop policy if exists "stores_select_member" on public.stores;
create policy "stores_select_member" on public.stores for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), stores.tenant_id, 'stores', 'view')
  );

-- ============================================================================
-- custom_roles (module: users — role management lives under Users & Rôles)
-- ============================================================================
drop policy if exists "roles_select_member" on public.custom_roles;
create policy "roles_select_member" on public.custom_roles for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = custom_roles.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), custom_roles.tenant_id, 'users', 'view')
  );

-- ============================================================================
-- Fix pre-existing inconsistency in the built-in "manager" defaults: staff
-- had view access to suppliers, manager didn't (clearly an oversight — a
-- manager should never have LESS access than staff). Only surfaces as a
-- real bug now that suppliers_select_member is actually enforced above;
-- previously any tenant member could read suppliers regardless of role.
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

  select * into m from public.tenant_members where user_id = uid limit 1;
  if not found then return false; end if;

  if m.role in ('super_admin', 'admin') then return true; end if;

  if m.custom_role_id is not null then
    select * into cr from public.custom_roles where id = m.custom_role_id;
    if found then
      perms := cr.permissions;
      if perms ? mod then
        if (perms -> mod) ? act and ((perms -> mod) ->> act)::boolean then
          return true;
        end if;
        return false;
      end if;
      return false;
    end if;
  end if;

  if m.role = 'manager' then
    if mod in ('dashboard','pos','products','stock','stores','invoices','deliveries',
               'customers','suppliers','expenses','purchases','quotes','reports','accounting',
               'users','settings') and act = 'view' then return true; end if;
    if mod in ('pos','products','stock','invoices','deliveries','customers','suppliers',
               'expenses','purchases','quotes','settings') and act in ('create','update') then return true; end if;
    return false;
  end if;

  if m.role = 'staff' then
    if mod in ('dashboard','pos','products','stock','stores','invoices',
               'deliveries','customers','suppliers','expenses','quotes','settings') and act = 'view' then return true; end if;
    if mod in ('pos','customers','quotes') and act in ('create','update') then return true; end if;
    return false;
  end if;

  return false;
end;
$$;

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
