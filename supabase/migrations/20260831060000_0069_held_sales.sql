-- Park / Hold Sale.
--
-- Deliberately NOT implemented as a row in public.sales with a new
-- sale_status='held': that table is queried without a status filter by
-- DashboardPage, ReportsPage, AccountingPage, AdministrationPage and
-- SaleHistoryTab (all do `select('*')`/`select(...)` with no
-- `.eq('sale_status', 'completed')`), so any unfinished/unpaid cart parked
-- there would immediately pollute revenue totals, the day report, and sale
-- history across the whole app. A held sale is not a transaction yet — it
-- has no financial reality until it's resumed and actually checked out —
-- so it gets its own table that nothing else reads from. This also means
-- holding a cart triggers zero interaction with sale_items and therefore
-- with the decrement_stock_on_sale trigger (0018): a parked cart never
-- reserves or touches stock, exactly like an item sitting in a browser tab
-- that hasn't been bought yet.
--
-- Resuming a held sale is a pure client-side operation: load this row,
-- rehydrate the POS cart from cart_snapshot, delete the row, then proceed
-- through the existing, completely unmodified checkout() flow, which
-- creates a normal public.sales row exactly as it does today.

create table if not exists public.held_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  day_session_id uuid references public.day_sessions(id) on delete set null,
  reference text not null,
  cart_snapshot jsonb not null,
  context jsonb,
  subtotal numeric not null default 0,
  discount_total numeric not null default 0,
  total numeric not null default 0,
  held_by uuid references public.tenant_members(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.held_sales is
  'Parked/suspended POS carts (Park/Hold Sale). Not a financial record: nothing else in the app reads this table, so a held cart never appears in revenue, reports, or sale history. cart_snapshot holds enough to fully rebuild the cart (product_id, quantity, unit_price per line); context holds the rest of the POS checkout panel state (customer, manual discount already approved, loyalty points being redeemed, delivery choice) so resuming restores the screen exactly as the cashier left it.';

create index if not exists held_sales_tenant_idx on public.held_sales (tenant_id, created_at desc);
create index if not exists held_sales_store_idx on public.held_sales (store_id);
create index if not exists held_sales_reference_idx on public.held_sales (tenant_id, reference);

alter table public.held_sales enable row level security;

drop policy if exists held_sales_select_member on public.held_sales;
create policy held_sales_select_member on public.held_sales for select
  to authenticated using (
    public.can_on_tenant(auth.uid(), tenant_id, 'pos', 'view')
    or public.is_super_admin(auth.uid())
  );

drop policy if exists held_sales_insert_member on public.held_sales;
create policy held_sales_insert_member on public.held_sales for insert
  to authenticated with check (
    (public.can_on_tenant(auth.uid(), tenant_id, 'pos', 'create') or public.is_super_admin(auth.uid()))
    and public.tenant_access_active(tenant_id)
  );

-- No update policy: a held sale is either resumed (read then deleted by the
-- client, which recreates a fresh sale through the normal checkout flow)
-- or cancelled (deleted) — never edited in place.

drop policy if exists held_sales_delete_member on public.held_sales;
create policy held_sales_delete_member on public.held_sales for delete
  to authenticated using (
    public.can_on_tenant(auth.uid(), tenant_id, 'pos', 'create')
    or public.is_super_admin(auth.uid())
  );
