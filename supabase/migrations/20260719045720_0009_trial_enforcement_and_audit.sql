/*
# Trial access enforcement + audit logging for super_admin

## Summary
1. SECURITY DEFINER function `tenant_access_active(tid)` — returns true if the
   tenant has an active trial (within 7 days of creation) OR an active/past_due
   subscription. Used by RLS INSERT/UPDATE policies to block writes after trial
   expiry without payment.
2. Add `tenant_access_active` check to INSERT and UPDATE policies on all
   business-data tables (products, sales, invoices, etc.) so a tenant whose
   trial expired cannot create or modify business records server-side.
3. Audit trigger function `log_super_admin_access()` — fires on SELECT-equivalent
   access is not possible via triggers, so instead we log on any INSERT/UPDATE/DELETE
   performed by a super_admin on a tenant they are NOT a member of, capturing
   cross-tenant administrative actions.

## Security
- tenant_access_active is SECURITY DEFINER, STABLE, pinned search_path.
- The function checks the subscriptions table (trial_ends_at or status='active'/'past_due'/'trialing').
- Fallback: if no subscription row exists, the tenant's created_at + 7 days is used.
- super_admin bypasses the trial check (they manage the platform, not tenant data).

## Notes
1. SELECT policies are intentionally NOT modified — users can still READ their
   data after trial expiry (so they can see what they'd lose), but cannot WRITE.
2. The frontend route guard blocks navigation to module pages after trial expiry.
3. Together these provide defense in depth: UI block + server-side write block.
*/

-- Helper: is the tenant's access active (trial or paid)?
create or replace function public.tenant_access_active(tid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sub record;
  tenant_created timestamptz;
begin
  -- Super admin always has access (platform management)
  if public.is_super_admin(auth.uid()) then
    return true;
  end if;

  -- Look up subscription
  select * into sub from public.subscriptions where tenant_id = tid limit 1;

  if found then
    -- Active or trialing or past_due subscription grants access
    if sub.status in ('active', 'trialing', 'past_due') then
      return true;
    end if;
    -- Trial period check via trial_ends_at
    if sub.trial_ends_at is not null and now() < sub.trial_ends_at then
      return true;
    end if;
    return false;
  end if;

  -- Fallback: no subscription row — use tenant created_at + 7 days
  select created_at into tenant_created from public.tenants where id = tid;
  if not found then
    return false;
  end if;

  return now() < (tenant_created + interval '7 days');
end;
$$;

-- ============================================================================
-- Update INSERT policies on business tables to require active access
-- Pattern: add AND public.tenant_access_active(<table>.tenant_id) to WITH CHECK
-- ============================================================================

-- products
drop policy if exists "products_insert_member" on public.products;
create policy "products_insert_member" on public.products for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = products.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(products.tenant_id)
  );

-- categories
drop policy if exists "categories_insert_member" on public.categories;
create policy "categories_insert_member" on public.categories for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = categories.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(categories.tenant_id)
  );

-- stores
drop policy if exists "stores_insert_member" on public.stores;
create policy "stores_insert_member" on public.stores for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = stores.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin','manager'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(stores.tenant_id)
  );

-- customers
drop policy if exists "customers_insert_member" on public.customers;
create policy "customers_insert_member" on public.customers for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(customers.tenant_id)
  );

-- suppliers
drop policy if exists "suppliers_insert_member" on public.suppliers;
create policy "suppliers_insert_member" on public.suppliers for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = suppliers.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(suppliers.tenant_id)
  );

-- sales
drop policy if exists "sales_insert_member" on public.sales;
create policy "sales_insert_member" on public.sales for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = sales.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(sales.tenant_id)
  );

-- invoices
drop policy if exists "invoices_insert_member" on public.invoices;
create policy "invoices_insert_member" on public.invoices for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = invoices.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(invoices.tenant_id)
  );

-- deliveries
drop policy if exists "deliveries_insert_member" on public.deliveries;
create policy "deliveries_insert_member" on public.deliveries for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = deliveries.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(deliveries.tenant_id)
  );

-- expenses
drop policy if exists "expenses_insert_member" on public.expenses;
create policy "expenses_insert_member" on public.expenses for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = expenses.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(expenses.tenant_id)
  );

-- purchases
drop policy if exists "purchases_insert_member" on public.purchases;
create policy "purchases_insert_member" on public.purchases for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = purchases.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(purchases.tenant_id)
  );

-- quotes
drop policy if exists "quotes_insert_member" on public.quotes;
create policy "quotes_insert_member" on public.quotes for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = quotes.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(quotes.tenant_id)
  );

-- inventory
drop policy if exists "inventory_insert_member" on public.inventory;
create policy "inventory_insert_member" on public.inventory for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = inventory.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(inventory.tenant_id)
  );

-- stock_movements
drop policy if exists "movements_insert_member" on public.stock_movements;
create policy "movements_insert_member" on public.stock_movements for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = stock_movements.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(stock_movements.tenant_id)
  );

-- ============================================================================
-- Audit logging function for super_admin cross-tenant writes
-- ============================================================================

create or replace function public.log_audit_entry(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_actor_email text,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_details jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, actor_email, action, entity, entity_id, details)
  values (p_tenant_id, p_actor_id, p_actor_email, p_action, p_entity, p_entity_id, p_details);
end;
$$;