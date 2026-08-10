-- CRITICAL: block UPDATE/DELETE on business tables after trial expiry.
--
-- The INSERT policies were hardened in 0009 to require
-- tenant_access_active(), but the UPDATE and DELETE policies were never
-- updated. A tenant whose trial expired could not CREATE new records
-- (sales, invoices, stock movements) but could still MODIFY and DELETE
-- existing ones — editing product prices, voiding invoices, deleting
-- sales, etc. That is a partial payment bypass: the platform stays
-- usable for record alteration even though new commercial activity is
-- blocked.
--
-- This migration adds `AND public.tenant_access_active(<table>.tenant_id)`
-- to every UPDATE (USING + WITH CHECK) and DELETE (USING) policy on all
-- business-data tables, mirroring the INSERT hardening. After expiry,
-- the tenant's data becomes read-only until payment resumes — consistent
-- with the trial/expiry contract and the frontend RequireActiveSubscription
-- route guard.
--
-- Safe because:
--  - During trial or active/past_due subscription, tenant_access_active()
--    returns true, so behavior is unchanged.
--  - RLS is bypassed by the service role, so edge functions (super-admin
--    management, webhooks) are unaffected.
--  - tenant_access_active() returns true for super_admin, preserving
--    cross-tenant administrative writes.

-- ============================================================================
-- UPDATE policies (USING + WITH CHECK)
-- ============================================================================

-- products
drop policy if exists "products_update_member" on public.products;
create policy "products_update_member" on public.products for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), products.tenant_id, 'products', 'update')
    and public.tenant_access_active(products.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), products.tenant_id, 'products', 'update')
    and public.tenant_access_active(products.tenant_id)
  );

-- categories
drop policy if exists "categories_update_member" on public.categories;
create policy "categories_update_member" on public.categories for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = categories.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(categories.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = categories.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(categories.tenant_id)
  );

-- stores
drop policy if exists "stores_update_member" on public.stores;
create policy "stores_update_member" on public.stores for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), stores.tenant_id, 'stores', 'update')
    and public.tenant_access_active(stores.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), stores.tenant_id, 'stores', 'update')
    and public.tenant_access_active(stores.tenant_id)
  );

-- customers
drop policy if exists "customers_update_member" on public.customers;
create policy "customers_update_member" on public.customers for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), customers.tenant_id, 'customers', 'update')
    and public.tenant_access_active(customers.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), customers.tenant_id, 'customers', 'update')
    and public.tenant_access_active(customers.tenant_id)
  );

-- suppliers
drop policy if exists "suppliers_update_member" on public.suppliers;
create policy "suppliers_update_member" on public.suppliers for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), suppliers.tenant_id, 'suppliers', 'update')
    and public.tenant_access_active(suppliers.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), suppliers.tenant_id, 'suppliers', 'update')
    and public.tenant_access_active(suppliers.tenant_id)
  );

-- sales
drop policy if exists "sales_update_member" on public.sales;
create policy "sales_update_member" on public.sales for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = sales.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(sales.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = sales.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(sales.tenant_id)
  );

-- invoices
drop policy if exists "invoices_update_member" on public.invoices;
create policy "invoices_update_member" on public.invoices for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), invoices.tenant_id, 'invoices', 'update')
    and public.tenant_access_active(invoices.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), invoices.tenant_id, 'invoices', 'update')
    and public.tenant_access_active(invoices.tenant_id)
  );

-- deliveries
drop policy if exists "deliveries_update_member" on public.deliveries;
create policy "deliveries_update_member" on public.deliveries for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), deliveries.tenant_id, 'deliveries', 'update')
    and public.tenant_access_active(deliveries.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), deliveries.tenant_id, 'deliveries', 'update')
    and public.tenant_access_active(deliveries.tenant_id)
  );

-- expenses
drop policy if exists "expenses_update_member" on public.expenses;
create policy "expenses_update_member" on public.expenses for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), expenses.tenant_id, 'expenses', 'update')
    and public.tenant_access_active(expenses.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), expenses.tenant_id, 'expenses', 'update')
    and public.tenant_access_active(expenses.tenant_id)
  );

-- purchases
drop policy if exists "purchases_update_member" on public.purchases;
create policy "purchases_update_member" on public.purchases for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), purchases.tenant_id, 'purchases', 'update')
    and public.tenant_access_active(purchases.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), purchases.tenant_id, 'purchases', 'update')
    and public.tenant_access_active(purchases.tenant_id)
  );

-- quotes
drop policy if exists "quotes_update_member" on public.quotes;
create policy "quotes_update_member" on public.quotes for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), quotes.tenant_id, 'quotes', 'update')
    and public.tenant_access_active(quotes.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), quotes.tenant_id, 'quotes', 'update')
    and public.tenant_access_active(quotes.tenant_id)
  );

-- inventory
drop policy if exists "inventory_update_member" on public.inventory;
create policy "inventory_update_member" on public.inventory for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), inventory.tenant_id, 'stock', 'update')
    and public.tenant_access_active(inventory.tenant_id)
  ) with check (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), inventory.tenant_id, 'stock', 'update')
    and public.tenant_access_active(inventory.tenant_id)
  );

-- stock_transfers (status update — mark received)
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
    and public.tenant_access_active(stock_transfers.tenant_id)
  ) with check (
    exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stock_transfers.tenant_id and tm.user_id = auth.uid())
    and public.tenant_access_active(stock_transfers.tenant_id)
  );

-- ============================================================================
-- DELETE policies (USING only — DELETE has no WITH CHECK)
-- ============================================================================

-- products
drop policy if exists "products_delete_member" on public.products;
create policy "products_delete_member" on public.products for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), products.tenant_id, 'products', 'delete')
    and public.tenant_access_active(products.tenant_id)
  );

-- categories
drop policy if exists "categories_delete_member" on public.categories;
create policy "categories_delete_member" on public.categories for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = categories.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(categories.tenant_id)
  );

-- stores
drop policy if exists "stores_delete_member" on public.stores;
create policy "stores_delete_member" on public.stores for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), stores.tenant_id, 'stores', 'delete')
    and public.tenant_access_active(stores.tenant_id)
  );

-- customers
drop policy if exists "customers_delete_member" on public.customers;
create policy "customers_delete_member" on public.customers for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), customers.tenant_id, 'customers', 'delete')
    and public.tenant_access_active(customers.tenant_id)
  );

-- suppliers
drop policy if exists "suppliers_delete_member" on public.suppliers;
create policy "suppliers_delete_member" on public.suppliers for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), suppliers.tenant_id, 'suppliers', 'delete')
    and public.tenant_access_active(suppliers.tenant_id)
  );

-- sales (admin/super_admin only)
drop policy if exists "sales_delete_member" on public.sales;
create policy "sales_delete_member" on public.sales for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = sales.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(sales.tenant_id)
  );

-- invoices
drop policy if exists "invoices_delete_member" on public.invoices;
create policy "invoices_delete_member" on public.invoices for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), invoices.tenant_id, 'invoices', 'delete')
    and public.tenant_access_active(invoices.tenant_id)
  );

-- deliveries
drop policy if exists "deliveries_delete_member" on public.deliveries;
create policy "deliveries_delete_member" on public.deliveries for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), deliveries.tenant_id, 'deliveries', 'delete')
    and public.tenant_access_active(deliveries.tenant_id)
  );

-- expenses
drop policy if exists "expenses_delete_member" on public.expenses;
create policy "expenses_delete_member" on public.expenses for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), expenses.tenant_id, 'expenses', 'delete')
    and public.tenant_access_active(expenses.tenant_id)
  );

-- purchases
drop policy if exists "purchases_delete_member" on public.purchases;
create policy "purchases_delete_member" on public.purchases for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), purchases.tenant_id, 'purchases', 'delete')
    and public.tenant_access_active(purchases.tenant_id)
  );

-- quotes
drop policy if exists "quotes_delete_member" on public.quotes;
create policy "quotes_delete_member" on public.quotes for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), quotes.tenant_id, 'quotes', 'delete')
    and public.tenant_access_active(quotes.tenant_id)
  );

-- inventory
drop policy if exists "inventory_delete_member" on public.inventory;
create policy "inventory_delete_member" on public.inventory for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(inventory.tenant_id)
  );

-- stock_movements (admin/super_admin only — audit trail management)
drop policy if exists "movements_delete_member" on public.stock_movements;
create policy "movements_delete_member" on public.stock_movements for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = stock_movements.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(stock_movements.tenant_id)
  );

-- ============================================================================
-- Child tables (sale_items, invoice_items, purchase_items, quote_items)
-- These join to a parent for tenant ownership and have no tenant_id column,
-- so tenant_access_active is evaluated against the parent's tenant_id via a
-- correlated subquery. Without this, a tenant past trial expiry could still
-- add/remove/alter line items on existing sales, invoices, purchases, quotes.
-- ============================================================================

-- sale_items
drop policy if exists "sale_items_insert_member" on public.sale_items;
create policy "sale_items_insert_member" on public.sale_items for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_items.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), s.tenant_id, 'pos', 'create'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select s.tenant_id from public.sales s where s.id = sale_items.sale_id))
  );

drop policy if exists "sale_items_update_member" on public.sale_items;
create policy "sale_items_update_member" on public.sale_items for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_items.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select s.tenant_id from public.sales s where s.id = sale_items.sale_id))
  ) with check (
    (exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_items.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select s.tenant_id from public.sales s where s.id = sale_items.sale_id))
  );

drop policy if exists "sale_items_delete_member" on public.sale_items;
create policy "sale_items_delete_member" on public.sale_items for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_items.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select s.tenant_id from public.sales s where s.id = sale_items.sale_id))
  );

-- invoice_items
drop policy if exists "invoice_items_insert_member" on public.invoice_items;
create policy "invoice_items_insert_member" on public.invoice_items for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm
      join public.invoices i on i.id = invoice_items.invoice_id
      where tm.tenant_id = i.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), i.tenant_id, 'invoices', 'create'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select i.tenant_id from public.invoices i where i.id = invoice_items.invoice_id))
  );

drop policy if exists "invoice_items_update_member" on public.invoice_items;
create policy "invoice_items_update_member" on public.invoice_items for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      join public.invoices i on i.id = invoice_items.invoice_id
      where tm.tenant_id = i.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select i.tenant_id from public.invoices i where i.id = invoice_items.invoice_id))
  ) with check (
    (exists (select 1 from public.tenant_members tm
      join public.invoices i on i.id = invoice_items.invoice_id
      where tm.tenant_id = i.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select i.tenant_id from public.invoices i where i.id = invoice_items.invoice_id))
  );

drop policy if exists "invoice_items_delete_member" on public.invoice_items;
create policy "invoice_items_delete_member" on public.invoice_items for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      join public.invoices i on i.id = invoice_items.invoice_id
      where tm.tenant_id = i.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select i.tenant_id from public.invoices i where i.id = invoice_items.invoice_id))
  );

-- purchase_items
drop policy if exists "purchase_items_insert_member" on public.purchase_items;
create policy "purchase_items_insert_member" on public.purchase_items for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm
      join public.purchases p on p.id = purchase_items.purchase_id
      where tm.tenant_id = p.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), p.tenant_id, 'purchases', 'create'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select p.tenant_id from public.purchases p where p.id = purchase_items.purchase_id))
  );

drop policy if exists "purchase_items_update_member" on public.purchase_items;
create policy "purchase_items_update_member" on public.purchase_items for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      join public.purchases p on p.id = purchase_items.purchase_id
      where tm.tenant_id = p.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), p.tenant_id, 'purchases', 'update'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select p.tenant_id from public.purchases p where p.id = purchase_items.purchase_id))
  ) with check (
    (exists (select 1 from public.tenant_members tm
      join public.purchases p on p.id = purchase_items.purchase_id
      where tm.tenant_id = p.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), p.tenant_id, 'purchases', 'update'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select p.tenant_id from public.purchases p where p.id = purchase_items.purchase_id))
  );

drop policy if exists "purchase_items_delete_member" on public.purchase_items;
create policy "purchase_items_delete_member" on public.purchase_items for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      join public.purchases p on p.id = purchase_items.purchase_id
      where tm.tenant_id = p.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select p.tenant_id from public.purchases p where p.id = purchase_items.purchase_id))
  );

-- quote_items
drop policy if exists "quote_items_insert_member" on public.quote_items;
create policy "quote_items_insert_member" on public.quote_items for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm
      join public.quotes q on q.id = quote_items.quote_id
      where tm.tenant_id = q.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), q.tenant_id, 'quotes', 'create'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select q.tenant_id from public.quotes q where q.id = quote_items.quote_id))
  );

drop policy if exists "quote_items_update_member" on public.quote_items;
create policy "quote_items_update_member" on public.quote_items for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      join public.quotes q on q.id = quote_items.quote_id
      where tm.tenant_id = q.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), q.tenant_id, 'quotes', 'update'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select q.tenant_id from public.quotes q where q.id = quote_items.quote_id))
  ) with check (
    (exists (select 1 from public.tenant_members tm
      join public.quotes q on q.id = quote_items.quote_id
      where tm.tenant_id = q.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), q.tenant_id, 'quotes', 'update'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select q.tenant_id from public.quotes q where q.id = quote_items.quote_id))
  );

drop policy if exists "quote_items_delete_member" on public.quote_items;
create policy "quote_items_delete_member" on public.quote_items for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      join public.quotes q on q.id = quote_items.quote_id
      where tm.tenant_id = q.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select q.tenant_id from public.quotes q where q.id = quote_items.quote_id))
  );
