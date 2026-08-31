-- D365-style gift cards, held/parked sales, and staff time clock.
-- Barcode scanning already existed (products.barcode, wired in POS/Products
-- since the initial schema) — this migration only adds what was genuinely
-- missing: stored-value gift cards, the ability to park an in-progress
-- sale and resume it later, and staff clock-in/out for shift traceability
-- (explicitly NOT payroll/attendance/scheduling — see comment in
-- LandingPage.tsx on why this product doesn't claim that).

-- ============================================================================
-- 1. Gift cards
-- ============================================================================

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  initial_balance numeric not null,
  balance numeric not null,
  customer_id uuid references public.customers(id) on delete set null,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

comment on table public.gift_cards is 'D365-style stored-value gift cards: issued for an amount, redeemed as a POS payment tender.';

alter table public.gift_cards enable row level security;

drop policy if exists gift_cards_tenant_access on public.gift_cards;
create policy gift_cards_tenant_access on public.gift_cards
  for all using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create index if not exists gift_cards_tenant_code_idx on public.gift_cards(tenant_id, code);

create table if not exists public.gift_card_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  amount_delta numeric not null,
  type text not null check (type in ('issue', 'redeem', 'reload', 'adjust')),
  created_at timestamptz not null default now()
);

alter table public.gift_card_transactions enable row level security;

drop policy if exists gift_card_transactions_tenant_access on public.gift_card_transactions;
create policy gift_card_transactions_tenant_access on public.gift_card_transactions
  for all using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create index if not exists gift_card_tx_card_idx on public.gift_card_transactions(gift_card_id);

-- Issue a new gift card (sold at checkout or from the dedicated admin
-- screen). Generates a code server-side if none is supplied, so the
-- caller never has to guess at uniqueness.
create or replace function public.issue_gift_card(
  p_tenant_id uuid,
  p_amount numeric,
  p_customer_id uuid default null,
  p_code text default null,
  p_expires_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_card_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant de la carte cadeau doit être positif.';
  end if;

  v_code := upper(coalesce(nullif(trim(p_code), ''), substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));

  insert into public.gift_cards (tenant_id, code, initial_balance, balance, customer_id, expires_at)
  values (p_tenant_id, v_code, p_amount, p_amount, p_customer_id, p_expires_at)
  returning id into v_card_id;

  insert into public.gift_card_transactions (tenant_id, gift_card_id, amount_delta, type)
  values (p_tenant_id, v_card_id, p_amount, 'issue');

  return jsonb_build_object('id', v_card_id, 'code', v_code, 'balance', p_amount);
exception
  when unique_violation then
    raise exception 'Ce code de carte cadeau existe déjà.';
end;
$$;

-- Non-mutating check, called before the sale row is created (same
-- two-phase pattern as check_manual_discount): validates the card is
-- active, not expired, and has enough balance, without spending it yet.
create or replace function public.check_gift_card(
  p_tenant_id uuid,
  p_code text,
  p_amount numeric
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_card record;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant à utiliser doit être positif.';
  end if;

  select * into v_card from public.gift_cards
    where tenant_id = p_tenant_id and code = upper(trim(p_code));

  if v_card is null then
    raise exception 'Carte cadeau introuvable.';
  end if;
  if not v_card.is_active then
    raise exception 'Cette carte cadeau est désactivée.';
  end if;
  if v_card.expires_at is not null and v_card.expires_at < now() then
    raise exception 'Cette carte cadeau a expiré.';
  end if;
  if v_card.balance < p_amount then
    raise exception 'Solde insuffisant sur la carte cadeau (disponible: %).', v_card.balance;
  end if;

  return jsonb_build_object('id', v_card.id, 'balance', v_card.balance);
end;
$$;

-- Actually spends the gift card, called after the sale row exists
-- (mirrors redeem_loyalty_points) — re-validates atomically so a race
-- between two concurrent redemptions can never overdraw the balance.
create or replace function public.redeem_gift_card(
  p_tenant_id uuid,
  p_gift_card_id uuid,
  p_amount numeric,
  p_sale_id uuid default null
) returns numeric
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant à utiliser doit être positif.';
  end if;

  select balance into v_balance from public.gift_cards
    where id = p_gift_card_id and tenant_id = p_tenant_id
    for update;

  if v_balance is null then
    raise exception 'Carte cadeau introuvable.';
  end if;
  if v_balance < p_amount then
    raise exception 'Solde insuffisant sur la carte cadeau (disponible: %).', v_balance;
  end if;

  update public.gift_cards set balance = balance - p_amount where id = p_gift_card_id;

  insert into public.gift_card_transactions (tenant_id, gift_card_id, sale_id, amount_delta, type)
  values (p_tenant_id, p_gift_card_id, p_sale_id, -p_amount, 'redeem');

  return v_balance - p_amount;
end;
$$;

grant execute on function public.issue_gift_card to authenticated;
grant execute on function public.check_gift_card to authenticated;
grant execute on function public.redeem_gift_card to authenticated;

-- ============================================================================
-- 2. Held / parked sales
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
-- 3. Staff time clock (shift traceability — not payroll/scheduling)
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
