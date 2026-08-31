-- Gift Cards (D365-style stored-value cards usable as a tender at checkout).
--
-- Reuses existing infrastructure rather than inventing new plumbing:
--   * tenant scoping + RLS follow the same pattern as sale_payments (0046)
--     and loyalty_transactions (0067);
--   * balance-changing operations go through security-definer functions
--     (same posture as check_manual_discount / redeem_loyalty_points) so a
--     client can never write an arbitrary balance directly — only the
--     server-side function's arithmetic can move it;
--   * redemption at POS is recorded as a normal public.sale_payments row
--     with method = 'gift_card', so existing payment-total reconciliation,
--     receipts and day-reports keep working unmodified for a gift-card
--     tender the same way they already do for cash/card/mobile-money;
--   * permission checks reuse the existing 'pos' module (always-available,
--     for issuing/redeeming at the till) and 'administration' module (for
--     voiding/cancelling a card) instead of introducing a brand-new
--     ModuleCode — no changes needed to MODULES, DEFAULT_PERMISSIONS, plan
--     gating, or the custom-roles UI.
--
-- Nothing here touches an existing table's columns or existing rows: a
-- tenant that never issues a gift card is unaffected.

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  currency text,
  initial_balance numeric not null check (initial_balance > 0),
  balance numeric not null check (balance >= 0),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'depleted', 'expired', 'cancelled')),
  customer_id uuid references public.customers(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  issued_by uuid references public.tenant_members(id) on delete set null,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

comment on table public.gift_cards is
  'Stored-value gift cards. balance is authoritative and only ever changed via issue_gift_card / recharge_gift_card / redeem_gift_card / cancel_gift_card so it can never go negative or be set directly by a client.';
comment on column public.gift_cards.currency is
  'Currency the card was issued in (tenant.currency at issue time). Kept per-card so a later multi-currency change cannot retroactively alter an existing card''s denomination.';

create index if not exists gift_cards_tenant_idx on public.gift_cards (tenant_id, created_at desc);
create index if not exists gift_cards_code_idx on public.gift_cards (tenant_id, code);
create index if not exists gift_cards_customer_idx on public.gift_cards (customer_id);

create table if not exists public.gift_card_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  type text not null check (type in ('issue', 'recharge', 'redeem', 'refund', 'cancel', 'expire')),
  amount numeric not null, -- signed: positive = credit to the card, negative = debit
  balance_after numeric not null,
  sale_id uuid references public.sales(id) on delete set null,
  performed_by uuid references public.tenant_members(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.gift_card_transactions is
  'Full audit trail of every balance change on a gift card (issue, recharge, redeem at a sale, refund back onto the card, cancellation, expiry).';

create index if not exists gift_card_tx_card_idx on public.gift_card_transactions (gift_card_id, created_at desc);
create index if not exists gift_card_tx_sale_idx on public.gift_card_transactions (sale_id);
create index if not exists gift_card_tx_tenant_idx on public.gift_card_transactions (tenant_id, created_at desc);

alter table public.gift_cards enable row level security;
alter table public.gift_card_transactions enable row level security;

drop policy if exists gift_cards_select_member on public.gift_cards;
create policy gift_cards_select_member on public.gift_cards for select
  to authenticated using (
    public.can_on_tenant(auth.uid(), tenant_id, 'pos', 'view')
    or public.is_super_admin(auth.uid())
  );

-- No direct insert/update/delete policy for clients: every write goes
-- through the security-definer functions below (grant execute only), the
-- same posture sale_payments already uses for settled tender lines and
-- loyalty_transactions uses for point balances.

drop policy if exists gift_card_tx_select_member on public.gift_card_transactions;
create policy gift_card_tx_select_member on public.gift_card_transactions for select
  to authenticated using (
    public.can_on_tenant(auth.uid(), tenant_id, 'pos', 'view')
    or public.is_super_admin(auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------

create or replace function public.generate_gift_card_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_exists boolean;
begin
  loop
    v_code := 'GC-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' ||
              upper(substr(md5(gen_random_uuid()::text), 1, 4));
    select exists(select 1 from public.gift_cards where tenant_id = p_tenant_id and code = v_code)
      into v_exists;
    exit when not v_exists;
  end loop;
  return v_code;
end;
$$;

-- ----------------------------------------------------------------------------
-- Issue a new card. Called at POS or from customer administration.
-- ----------------------------------------------------------------------------

create or replace function public.issue_gift_card(
  p_tenant_id uuid,
  p_amount numeric,
  p_customer_id uuid default null,
  p_store_id uuid default null,
  p_expires_at timestamptz default null,
  p_code text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member_id uuid;
  v_currency text;
  v_code text;
  v_card_id uuid;
begin
  if not public.can_on_tenant(auth.uid(), p_tenant_id, 'pos', 'create') and not public.is_super_admin(auth.uid()) then
    raise exception 'Vous n''avez pas le droit de créer une carte cadeau.';
  end if;
  if not public.tenant_access_active(p_tenant_id) then
    raise exception 'Abonnement inactif.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant initial de la carte cadeau doit être positif.';
  end if;

  select id into v_member_id from public.tenant_members
    where tenant_id = p_tenant_id and user_id = auth.uid() limit 1;

  select currency into v_currency from public.tenants where id = p_tenant_id;

  if p_code is not null and trim(p_code) <> '' then
    v_code := upper(trim(p_code));
    if exists(select 1 from public.gift_cards where tenant_id = p_tenant_id and code = v_code) then
      raise exception 'Ce code de carte cadeau existe déjà.';
    end if;
  else
    v_code := public.generate_gift_card_code(p_tenant_id);
  end if;

  insert into public.gift_cards (
    tenant_id, code, currency, initial_balance, balance, status,
    customer_id, store_id, issued_by, expires_at
  ) values (
    p_tenant_id, v_code, v_currency, p_amount, p_amount, 'active',
    p_customer_id, p_store_id, v_member_id, p_expires_at
  ) returning id into v_card_id;

  insert into public.gift_card_transactions (
    tenant_id, gift_card_id, type, amount, balance_after, performed_by, notes
  ) values (
    p_tenant_id, v_card_id, 'issue', p_amount, p_amount, v_member_id, 'Émission de la carte'
  );

  return jsonb_build_object('id', v_card_id, 'code', v_code, 'balance', p_amount, 'currency', v_currency);
end;
$$;

-- ----------------------------------------------------------------------------
-- Recharge an existing card.
-- ----------------------------------------------------------------------------

create or replace function public.recharge_gift_card(
  p_tenant_id uuid,
  p_code text,
  p_amount numeric
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member_id uuid;
  v_card record;
  v_new_balance numeric;
begin
  if not public.can_on_tenant(auth.uid(), p_tenant_id, 'pos', 'create') and not public.is_super_admin(auth.uid()) then
    raise exception 'Vous n''avez pas le droit de recharger une carte cadeau.';
  end if;
  if not public.tenant_access_active(p_tenant_id) then
    raise exception 'Abonnement inactif.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant de la recharge doit être positif.';
  end if;

  select * into v_card from public.gift_cards
    where tenant_id = p_tenant_id and code = upper(trim(p_code))
    for update;

  if not found then
    raise exception 'Carte cadeau introuvable: %', p_code;
  end if;
  if v_card.status = 'cancelled' then
    raise exception 'Cette carte cadeau a été annulée et ne peut pas être rechargée.';
  end if;
  if v_card.status = 'expired' or (v_card.expires_at is not null and v_card.expires_at < now()) then
    raise exception 'Cette carte cadeau est expirée.';
  end if;

  select id into v_member_id from public.tenant_members
    where tenant_id = p_tenant_id and user_id = auth.uid() limit 1;

  v_new_balance := v_card.balance + p_amount;

  update public.gift_cards
    set balance = v_new_balance, status = 'active', updated_at = now()
    where id = v_card.id;

  insert into public.gift_card_transactions (
    tenant_id, gift_card_id, type, amount, balance_after, performed_by, notes
  ) values (
    p_tenant_id, v_card.id, 'recharge', p_amount, v_new_balance, v_member_id, 'Recharge'
  );

  return jsonb_build_object('id', v_card.id, 'code', v_card.code, 'balance', v_new_balance, 'currency', v_card.currency);
end;
$$;

-- ----------------------------------------------------------------------------
-- Redeem (use as payment at checkout). Enforces balance/expiry/status, and
-- can never take the balance below zero regardless of what the client asks
-- for — it silently caps at p_amount vs remaining balance being the
-- caller's job to check via get_gift_card_status first, but the function
-- itself is the hard backstop: it raises rather than allowing overdraw.
-- ----------------------------------------------------------------------------

create or replace function public.redeem_gift_card(
  p_tenant_id uuid,
  p_code text,
  p_amount numeric,
  p_sale_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member_id uuid;
  v_card record;
  v_new_balance numeric;
begin
  if not public.can_on_tenant(auth.uid(), p_tenant_id, 'pos', 'create') and not public.is_super_admin(auth.uid()) then
    raise exception 'Vous n''avez pas le droit d''utiliser une carte cadeau en paiement.';
  end if;
  if not public.tenant_access_active(p_tenant_id) then
    raise exception 'Abonnement inactif.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant à utiliser doit être positif.';
  end if;

  select * into v_card from public.gift_cards
    where tenant_id = p_tenant_id and code = upper(trim(p_code))
    for update;

  if not found then
    raise exception 'Carte cadeau introuvable: %', p_code;
  end if;
  if v_card.status = 'cancelled' then
    raise exception 'Cette carte cadeau a été annulée.';
  end if;
  if v_card.status = 'expired' or (v_card.expires_at is not null and v_card.expires_at < now()) then
    update public.gift_cards set status = 'expired', updated_at = now() where id = v_card.id;
    raise exception 'Cette carte cadeau est expirée.';
  end if;
  if v_card.status = 'depleted' or v_card.balance <= 0 then
    raise exception 'Cette carte cadeau n''a plus de solde disponible.';
  end if;
  if p_amount > v_card.balance then
    raise exception 'Solde insuffisant sur la carte cadeau (disponible: % %).', v_card.balance, v_card.currency;
  end if;

  select id into v_member_id from public.tenant_members
    where tenant_id = p_tenant_id and user_id = auth.uid() limit 1;

  v_new_balance := v_card.balance - p_amount;

  update public.gift_cards
    set balance = v_new_balance,
        status = case when v_new_balance = 0 then 'depleted' else v_card.status end,
        updated_at = now()
    where id = v_card.id;

  insert into public.gift_card_transactions (
    tenant_id, gift_card_id, type, amount, balance_after, sale_id, performed_by, notes
  ) values (
    p_tenant_id, v_card.id, 'redeem', -p_amount, v_new_balance, p_sale_id, v_member_id, 'Utilisation en caisse'
  );

  -- Mirror the same pattern sale_payments already uses for every other
  -- tender, so day reports / receipts / total reconciliation treat a gift
  -- card exactly like cash or card without any extra-case logic.
  if p_sale_id is not null then
    insert into public.sale_payments (tenant_id, sale_id, method, amount, reference)
    values (p_tenant_id, p_sale_id, 'gift_card', p_amount, v_card.code);
  end if;

  return jsonb_build_object('id', v_card.id, 'code', v_card.code, 'balance', v_new_balance, 'currency', v_card.currency);
end;
$$;

-- ----------------------------------------------------------------------------
-- Refund an amount back onto a card (e.g. a return settled as store credit
-- on an existing or newly issued gift card).
-- ----------------------------------------------------------------------------

create or replace function public.refund_to_gift_card(
  p_tenant_id uuid,
  p_code text,
  p_amount numeric,
  p_sale_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member_id uuid;
  v_card record;
  v_new_balance numeric;
begin
  if not public.can_on_tenant(auth.uid(), p_tenant_id, 'pos', 'create') and not public.is_super_admin(auth.uid()) then
    raise exception 'Vous n''avez pas le droit de créditer une carte cadeau.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant à créditer doit être positif.';
  end if;

  select * into v_card from public.gift_cards
    where tenant_id = p_tenant_id and code = upper(trim(p_code))
    for update;

  if not found then
    raise exception 'Carte cadeau introuvable: %', p_code;
  end if;
  if v_card.status = 'cancelled' then
    raise exception 'Cette carte cadeau a été annulée et ne peut pas recevoir de remboursement.';
  end if;

  select id into v_member_id from public.tenant_members
    where tenant_id = p_tenant_id and user_id = auth.uid() limit 1;

  v_new_balance := v_card.balance + p_amount;

  update public.gift_cards
    set balance = v_new_balance, status = 'active', updated_at = now()
    where id = v_card.id;

  insert into public.gift_card_transactions (
    tenant_id, gift_card_id, type, amount, balance_after, sale_id, performed_by, notes
  ) values (
    p_tenant_id, v_card.id, 'refund', p_amount, v_new_balance, p_sale_id, v_member_id, 'Remboursement sur carte'
  );

  return jsonb_build_object('id', v_card.id, 'code', v_card.code, 'balance', v_new_balance, 'currency', v_card.currency);
end;
$$;

-- ----------------------------------------------------------------------------
-- Cancel/void a card (admin only — same posture as other destructive admin
-- actions elsewhere in this app, gated on the 'administration' module).
-- ----------------------------------------------------------------------------

create or replace function public.cancel_gift_card(
  p_tenant_id uuid,
  p_code text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member_id uuid;
  v_card record;
begin
  if not public.can_on_tenant(auth.uid(), p_tenant_id, 'administration', 'update') and not public.is_super_admin(auth.uid()) then
    raise exception 'Seul un administrateur peut annuler une carte cadeau.';
  end if;

  select * into v_card from public.gift_cards
    where tenant_id = p_tenant_id and code = upper(trim(p_code))
    for update;

  if not found then
    raise exception 'Carte cadeau introuvable: %', p_code;
  end if;

  select id into v_member_id from public.tenant_members
    where tenant_id = p_tenant_id and user_id = auth.uid() limit 1;

  update public.gift_cards set status = 'cancelled', updated_at = now() where id = v_card.id;

  insert into public.gift_card_transactions (
    tenant_id, gift_card_id, type, amount, balance_after, performed_by, notes
  ) values (
    p_tenant_id, v_card.id, 'cancel', 0, v_card.balance, v_member_id, coalesce(p_reason, 'Carte annulée')
  );

  return jsonb_build_object('id', v_card.id, 'code', v_card.code, 'status', 'cancelled');
end;
$$;

-- ----------------------------------------------------------------------------
-- Read-only lookup used by the POS scan/entry field — returns just enough
-- to validate before redeeming, without requiring a broad table select.
-- ----------------------------------------------------------------------------

create or replace function public.get_gift_card_status(
  p_tenant_id uuid,
  p_code text
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_card record;
begin
  if not public.can_on_tenant(auth.uid(), p_tenant_id, 'pos', 'view') and not public.is_super_admin(auth.uid()) then
    raise exception 'Accès non autorisé.';
  end if;

  select * into v_card from public.gift_cards
    where tenant_id = p_tenant_id and code = upper(trim(p_code));

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'id', v_card.id,
    'code', v_card.code,
    'balance', v_card.balance,
    'currency', v_card.currency,
    'status', case
      when v_card.status = 'active' and v_card.expires_at is not null and v_card.expires_at < now() then 'expired'
      else v_card.status
    end,
    'expires_at', v_card.expires_at
  );
end;
$$;

grant execute on function public.generate_gift_card_code to authenticated;
grant execute on function public.issue_gift_card to authenticated;
grant execute on function public.recharge_gift_card to authenticated;
grant execute on function public.redeem_gift_card to authenticated;
grant execute on function public.refund_to_gift_card to authenticated;
grant execute on function public.cancel_gift_card to authenticated;
grant execute on function public.get_gift_card_status to authenticated;
