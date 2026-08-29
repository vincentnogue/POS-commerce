-- Return / Exchange module ("Retour ou échange").
--
-- Real requirement: a customer can return or exchange a purchased item,
-- and depending on what the manager has configured for the tenant, the
-- refund can be cash, card/mobile money, or a store-credit note — and
-- whichever it is, it must correctly restock inventory and show up in
-- reporting. This was entirely missing: sales could be recorded but never
-- reversed.
--
-- Purely additive: two new tables (an immutable ledger, like sales), one
-- jsonb settings column on tenants (which refund methods staff may use —
-- set by the manager/admin, not hardcoded), a dedicated store-credit
-- balance on customers (kept separate from customers.balance, which
-- already has its own accounts-receivable meaning and must not change),
-- and one atomic RPC. Nothing existing is altered or removed.

alter table public.tenants
  add column if not exists return_settings jsonb not null default '{"allow_cash":true,"allow_card":true,"allow_store_credit":true,"allow_exchange":true}'::jsonb;

alter table public.customers
  add column if not exists store_credit_balance numeric not null default 0;

create table public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  original_sale_id uuid not null references public.sales(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  day_session_id uuid references public.day_sessions(id) on delete set null,
  reference text not null,
  kind text not null default 'return' check (kind in ('return', 'exchange')),
  reason text,
  refund_method text not null check (refund_method in ('cash', 'card', 'mobile_money', 'store_credit', 'none')),
  refund_amount numeric not null default 0,
  staff_code text,
  processed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index sale_returns_tenant_idx on public.sale_returns (tenant_id, created_at desc);
create index sale_returns_original_sale_idx on public.sale_returns (original_sale_id);

create table public.sale_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sale_returns(id) on delete cascade,
  sale_item_id uuid references public.sale_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null default 0,
  total numeric not null default 0
);

create index sale_return_items_return_idx on public.sale_return_items (return_id);
create index sale_return_items_sale_item_idx on public.sale_return_items (sale_item_id);

alter table public.sale_returns enable row level security;
alter table public.sale_return_items enable row level security;

drop policy if exists "sale_returns_select_member" on public.sale_returns;
create policy "sale_returns_select_member" on public.sale_returns for select
  using (exists (select 1 from public.tenant_members tm where tm.tenant_id = sale_returns.tenant_id and tm.user_id = auth.uid()));

drop policy if exists "sale_return_items_select_member" on public.sale_return_items;
create policy "sale_return_items_select_member" on public.sale_return_items for select
  using (exists (
    select 1 from public.sale_returns sr
    join public.tenant_members tm on tm.tenant_id = sr.tenant_id
    where sr.id = sale_return_items.return_id and tm.user_id = auth.uid()
  ));

-- No insert/update/delete policies for regular clients: all writes go
-- through the security-definer RPC below, same pattern as stock transfers,
-- so quantities, restocking and the refund are always applied together.

create or replace function public.process_sale_return(
  p_tenant_id uuid,
  p_sale_id uuid,
  p_items jsonb, -- [{ "sale_item_id": uuid, "product_id": uuid, "name": text, "quantity": numeric, "unit_price": numeric }]
  p_refund_method text,
  p_kind text,
  p_reason text,
  p_customer_id uuid,
  p_user_id uuid,
  p_staff_code text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_sale record;
  v_settings jsonb;
  v_return_id uuid;
  v_item jsonb;
  v_qty numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_already_returned numeric;
  v_original_qty numeric;
  v_refund_total numeric := 0;
  v_session_id uuid;
  v_ref text;
begin
  select id into v_member_id from public.tenant_members where user_id = p_user_id and tenant_id = p_tenant_id;
  if v_member_id is null then
    raise exception 'Non autorisé.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id and tenant_id = p_tenant_id;
  if v_sale is null then
    raise exception 'Vente introuvable.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Aucun article sélectionné pour le retour.';
  end if;

  if p_kind not in ('return', 'exchange') then
    raise exception 'Type de retour invalide.';
  end if;

  select return_settings into v_settings from public.tenants where id = p_tenant_id;
  v_settings := coalesce(v_settings, '{"allow_cash":true,"allow_card":true,"allow_store_credit":true,"allow_exchange":true}'::jsonb);

  if p_refund_method = 'store_credit' and coalesce((v_settings->>'allow_store_credit')::boolean, true) is not true then
    raise exception 'Le remboursement en avoir client n''est pas autorisé pour ce compte.';
  end if;
  if p_refund_method in ('cash') and coalesce((v_settings->>'allow_cash')::boolean, true) is not true then
    raise exception 'Le remboursement en espèces n''est pas autorisé pour ce compte.';
  end if;
  if p_refund_method in ('card', 'mobile_money') and coalesce((v_settings->>'allow_card')::boolean, true) is not true then
    raise exception 'Le remboursement par carte / mobile money n''est pas autorisé pour ce compte.';
  end if;
  if p_kind = 'exchange' and coalesce((v_settings->>'allow_exchange')::boolean, true) is not true then
    raise exception 'Les échanges ne sont pas autorisés pour ce compte.';
  end if;
  if p_refund_method = 'store_credit' and p_customer_id is null then
    raise exception 'Un client doit être sélectionné pour émettre un avoir.';
  end if;

  -- Validate quantities against what was actually sold, minus whatever
  -- has already been returned/exchanged on those same sale lines.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantité invalide.';
    end if;

    if v_item->>'sale_item_id' is not null then
      select quantity into v_original_qty from public.sale_items where id = (v_item->>'sale_item_id')::uuid and sale_id = p_sale_id;
      if v_original_qty is null then
        raise exception 'Article de vente introuvable sur cette facture.';
      end if;
      select coalesce(sum(sri.quantity), 0) into v_already_returned
      from public.sale_return_items sri
      join public.sale_returns sr on sr.id = sri.return_id
      where sri.sale_item_id = (v_item->>'sale_item_id')::uuid and sr.original_sale_id = p_sale_id;

      if v_already_returned + v_qty > v_original_qty then
        raise exception 'Quantité à retourner supérieure à la quantité restante (%: déjà retourné %, vendu %).', v_item->>'name', v_already_returned, v_original_qty;
      end if;
    end if;

    v_line_total := v_qty * v_unit_price;
    v_refund_total := v_refund_total + v_line_total;
  end loop;

  select id into v_session_id from public.day_sessions
  where tenant_id = p_tenant_id
    and coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_sale.store_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and status = 'open';

  v_ref := 'RET-' || to_char(now(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.sale_returns (
    tenant_id, store_id, original_sale_id, customer_id, day_session_id, reference, kind, reason,
    refund_method, refund_amount, staff_code, processed_by
  ) values (
    p_tenant_id, v_sale.store_id, p_sale_id, p_customer_id, v_session_id, v_ref, p_kind, p_reason,
    p_refund_method, v_refund_total, nullif(trim(p_staff_code), ''), p_user_id
  ) returning id into v_return_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);

    insert into public.sale_return_items (return_id, sale_item_id, product_id, name, quantity, unit_price, total)
    values (
      v_return_id,
      nullif(v_item->>'sale_item_id', '')::uuid,
      nullif(v_item->>'product_id', '')::uuid,
      v_item->>'name',
      v_qty,
      v_unit_price,
      v_qty * v_unit_price
    );

    -- Restock: put the returned quantity back into the store's inventory.
    if v_item->>'product_id' is not null then
      update public.inventory
      set quantity = quantity + v_qty, updated_at = now()
      where tenant_id = p_tenant_id
        and product_id = (v_item->>'product_id')::uuid
        and coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_sale.store_id, '00000000-0000-0000-0000-000000000000'::uuid);

      if not found then
        insert into public.inventory (tenant_id, product_id, store_id, quantity)
        values (p_tenant_id, (v_item->>'product_id')::uuid, v_sale.store_id, v_qty);
      end if;

      insert into public.stock_movements (tenant_id, product_id, store_id, movement_type, quantity, reason, user_id)
      values (p_tenant_id, (v_item->>'product_id')::uuid, v_sale.store_id, 'in', v_qty, concat('Retour vente ', v_sale.reference, coalesce(' — ' || p_reason, '')), p_user_id);
    end if;
  end loop;

  if p_refund_method = 'store_credit' then
    update public.customers set store_credit_balance = store_credit_balance + v_refund_total where id = p_customer_id;
  end if;

  return v_return_id;
end;
$$;

grant execute on function public.process_sale_return to authenticated;

comment on table public.sale_returns is
  'Immutable ledger of processed returns/exchanges. Refund method is constrained by tenants.return_settings (set by the manager). Restocking, the customer store-credit balance and the refund are all applied atomically by process_sale_return().';
