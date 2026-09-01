-- Held/parked sales, and staff time clock (D365-style).
--
-- Barcode scanning already existed (products.barcode, wired in POS/Products
-- since the initial schema) — no work needed there. Gift cards were built
-- concurrently in a separate PR (migration 0068_gift_cards.sql, merged as
-- #53) — that is the system in use; this migration only adds what that PR
-- did not: parking an in-progress sale to resume later, and staff
-- clock-in/out for shift traceability (explicitly NOT payroll/attendance/
-- scheduling — see the comment in LandingPage.tsx on why this product's
-- marketing must never claim that).

-- ============================================================================
-- 1. Held / parked sales
-- ============================================================================

create table if not exists public.held_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  label text,
  cart jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.held_sales is 'A cart put on hold at the register (park sale) to be resumed later, e.g. while serving another customer.';

alter table public.held_sales enable row level security;

drop policy if exists held_sales_tenant_access on public.held_sales;
create policy held_sales_tenant_access on public.held_sales
  for all using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create index if not exists held_sales_tenant_idx on public.held_sales(tenant_id, store_id, created_at desc);

-- ============================================================================
-- 2. Staff time clock (shift traceability — not payroll/scheduling)
-- ============================================================================

create table if not exists public.time_clock_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.time_clock_entries is 'Staff clock-in/out for shift traceability (who was on the floor and when) — not a payroll or scheduling system.';

alter table public.time_clock_entries enable row level security;

drop policy if exists time_clock_select on public.time_clock_entries;
create policy time_clock_select on public.time_clock_entries
  for select using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

drop policy if exists time_clock_insert on public.time_clock_entries;
create policy time_clock_insert on public.time_clock_entries
  for insert with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
    and (
      user_id = auth.uid()
      or exists (select 1 from public.tenant_members tm where tm.tenant_id = time_clock_entries.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin', 'super_admin', 'manager'))
    )
  );

drop policy if exists time_clock_update on public.time_clock_entries;
create policy time_clock_update on public.time_clock_entries
  for update using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
    and (
      user_id = auth.uid()
      or exists (select 1 from public.tenant_members tm where tm.tenant_id = time_clock_entries.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin', 'super_admin', 'manager'))
    )
  );

drop policy if exists time_clock_delete on public.time_clock_entries;
create policy time_clock_delete on public.time_clock_entries
  for delete using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = time_clock_entries.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin', 'super_admin', 'manager'))
  );

create index if not exists time_clock_tenant_idx on public.time_clock_entries(tenant_id, user_id, clock_in desc);

-- One open (not-yet-clocked-out) entry per user at a time.
create unique index if not exists time_clock_one_open_per_user on public.time_clock_entries(user_id) where (clock_out is null);
