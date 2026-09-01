-- Operational foundations (schema only): warehouse locations, wishlists,
-- task management, commission, loyalty tiers, customer segments,
-- omnichannel channel tagging, login history, and offline-sync
-- idempotency keys. All additive — see the note at the top of each of the
-- three sibling migrations (0072-0074) for the general safety approach;
-- the same rules apply here (new nullable columns / new tables only).

-- Warehouses: reuses the existing stores/inventory/stock_transfers
-- machinery entirely (a warehouse's stock IS an inventory row keyed by
-- store_id like any store's) rather than a parallel entity that would
-- need its own copy of every stock query — a location_type flag is all
-- that's missing to distinguish "customer-facing store" from
-- "storage-only warehouse" in a future store picker.
alter table public.stores add column if not exists location_type text not null default 'store'
  check (location_type in ('store', 'warehouse'));

-- Wishlist: a customer's saved-for-later products. Deliberately no
-- store_id/tenant-wide scoping question to settle here since a wishlist
-- naturally belongs to the customer record itself, wherever they shop.
create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

-- Task management (store task lists, e.g. "restock endcap", "count
-- register 2"). assigned_to is a tenant_member, not a raw auth user id, to
-- match how the rest of the app (day_session_staff, held_sales.held_by,
-- gift_cards.issued_by...) already attributes actions to staff.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  title text not null,
  description text,
  assigned_to uuid references public.tenant_members(id) on delete set null,
  created_by uuid references public.tenant_members(id) on delete set null,
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_tenant_status_idx on public.tasks (tenant_id, status);
create index if not exists tasks_assigned_idx on public.tasks (assigned_to);

-- Commission: a rule (percentage, optionally scoped to one category) plus
-- the actual per-sale ledger it produces. Deliberately NOT auto-computed
-- by a trigger here — attribution logic (which staff member gets credit:
-- whoever rang up the sale? whoever's customer it was?) is a real product
-- decision this migration shouldn't quietly bake in. The tables exist so
-- that decision can be made in the UI layer that populates
-- sale_commissions, without needing another migration first.
create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  rate_percent numeric not null check (rate_percent >= 0 and rate_percent <= 100),
  category_id uuid references public.categories(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.sale_commissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  commission_rule_id uuid references public.commission_rules(id) on delete set null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists sale_commissions_member_idx on public.sale_commissions (member_id, created_at desc);

-- Loyalty tiers (VIP levels). customers.loyalty_tier_id is an explicit
-- assignment rather than something recomputed live from
-- customers.loyalty_points on every read — a future job/RPC can
-- promote/demote a customer when their points cross a threshold, same
-- posture as everything else in this file: the table exists, the
-- automation is a deliberate separate step.
create table if not exists public.loyalty_tiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  min_points integer not null default 0,
  benefits jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);
alter table public.customers add column if not exists loyalty_tier_id uuid references public.loyalty_tiers(id) on delete set null;

-- Customer segments (a named, manually-curated group today — criteria
-- jsonb is reserved for a future "auto-segment by rule" feature, not
-- evaluated by anything yet).
create table if not exists public.customer_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  criteria jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);
alter table public.customers add column if not exists segment_id uuid references public.customer_segments(id) on delete set null;

-- Omnichannel: which channel a sale originated from. Defaults to 'pos' so
-- every existing and future till sale needs zero code changes; 'online'
-- and 'call_center' are reserved for when those channels exist to write
-- into the same sales table instead of a parallel one — the schema-level
-- half of "one architecture, not several independent systems" from the
-- original roadmap.
alter table public.sales add column if not exists channel text not null default 'pos'
  check (channel in ('pos', 'online', 'call_center'));

-- Offline-sync idempotency: a client-generated id a POS terminal can set
-- BEFORE it knows whether it's online, so retrying a queued sale after a
-- reconnect can safely upsert instead of risking a duplicate sale if the
-- first attempt actually succeeded but the confirmation was lost. This is
-- the one piece of "offline mode" that has to live in the database ahead
-- of time; the queue, local storage, and retry logic themselves are a
-- client-side project, not a migration.
alter table public.sales add column if not exists client_generated_id uuid;
create unique index if not exists sales_client_generated_id_idx on public.sales (tenant_id, client_generated_id) where client_generated_id is not null;

-- Login history (for a future "login history" admin view — see
-- profile/security roadmap item). Populating this table requires a small
-- client-side hook on sign-in, which is application wiring, not schema;
-- left for that follow-up.
create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_in_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);
create index if not exists login_history_user_idx on public.login_history (user_id, logged_in_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['wishlists', 'tasks', 'commission_rules', 'sale_commissions', 'loyalty_tiers', 'customer_segments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all_member', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.tenant_members tm where tm.tenant_id = %I.tenant_id and tm.user_id = auth.uid()) or public.is_super_admin(auth.uid())) with check (exists (select 1 from public.tenant_members tm where tm.tenant_id = %I.tenant_id and tm.user_id = auth.uid()) or public.is_super_admin(auth.uid()))',
      t || '_all_member', t, t, t
    );
  end loop;
end $$;

alter table public.login_history enable row level security;
drop policy if exists login_history_own_or_admin on public.login_history;
create policy login_history_own_or_admin on public.login_history for select
  to authenticated using (
    user_id = auth.uid()
    or (tenant_id is not null and exists (select 1 from public.tenant_members tm where tm.tenant_id = login_history.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin', 'super_admin', 'manager')))
    or public.is_super_admin(auth.uid())
  );
drop policy if exists login_history_insert_self on public.login_history;
create policy login_history_insert_self on public.login_history for insert
  to authenticated with check (user_id = auth.uid());
