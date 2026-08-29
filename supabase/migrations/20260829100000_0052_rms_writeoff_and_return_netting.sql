-- Two fixes layered on the current state (0051's PIN-verified transfer
-- function; 0049's real sale_returns/process_sale_return):
--
-- 1. RMS was still unusable for single-store tenants after 0051 replaced
--    the function body (0051 was written against 0047's version and
--    doesn't know about the nullable-destination write-off case). This
--    reapplies that fix on top of 0051's staff-PIN-verified version
--    instead of reverting it.
--
-- 2. close_day_session (0045) computes expected cash from cash SALES only.
--    Since then, a real returns/refunds module shipped (0049,
--    public.sale_returns) that can refund in cash — those cash refunds
--    were never subtracted, so a day with any cash return would always
--    show a cash "shortfall" that isn't actually one. Netting them out
--    now, the same way a cash sale already adds to the expected total.

alter table public.transfer_batches alter column dest_store_id drop not null;
alter table public.stock_transfers alter column dest_store_id drop not null;

create or replace function public.initiate_stock_transfer_batch(
  p_tenant_id uuid,
  p_name text,
  p_source_store_id uuid,
  p_dest_store_id uuid,
  p_items jsonb,
  p_notes text,
  p_staff_code text,
  p_user_id uuid,
  p_type text default 'transfer',
  p_reason text default null,
  p_staff_pin text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_can_transfer boolean;
  v_is_admin boolean;
  v_batch_id uuid;
  v_dest_name text;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_current_qty numeric;
  v_item_count int;
  v_staff_member_id uuid;
  v_is_write_off boolean;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Le transfert doit avoir un nom.';
  end if;
  if p_type not in ('transfer', 'rms') then
    raise exception 'Type de transfert invalide.';
  end if;

  v_is_write_off := (p_type = 'rms' and p_dest_store_id is null);

  if p_type = 'transfer' and p_dest_store_id is null then
    raise exception 'Choisissez un magasin de destination.';
  end if;
  if p_dest_store_id is not null and p_source_store_id = p_dest_store_id then
    raise exception 'Le magasin source et destination doivent être différents.';
  end if;

  select jsonb_array_length(p_items) into v_item_count;
  if v_item_count is null or v_item_count = 0 then
    raise exception 'Scannez au moins un produit avant d''initier le transfert.';
  end if;

  select id, role in ('admin', 'super_admin') into v_member_id, v_is_admin
  from public.tenant_members where user_id = p_user_id and tenant_id = p_tenant_id;
  if v_member_id is null then
    raise exception 'Non autorisé.';
  end if;

  if not v_is_admin then
    select coalesce(bool_or(can_transfer), false) into v_can_transfer
    from public.store_assignments
    where member_id = v_member_id and store_id = p_source_store_id;
    if not v_can_transfer then
      raise exception 'Vous n''êtes pas autorisé à transférer depuis ce magasin.';
    end if;
  end if;

  -- A typed Staff ID must come with its matching PIN (0051) — proving who
  -- is physically doing the action on a shared terminal, not just trusting
  -- a typed code.
  if p_staff_code is not null and trim(p_staff_code) <> '' then
    v_staff_member_id := public.verify_staff_pin(p_tenant_id, p_staff_code, p_staff_pin);

    if not exists (
      select 1 from public.tenant_members where id = v_staff_member_id and role in ('admin', 'super_admin')
    ) then
      if not exists (
        select 1 from public.store_assignments
        where member_id = v_staff_member_id and store_id = p_source_store_id and can_transfer = true
      ) then
        raise exception 'Ce Staff ID n''est pas autorisé à transférer depuis ce magasin.';
      end if;
    end if;
  end if;

  if p_dest_store_id is not null then
    select name into v_dest_name from public.stores where id = p_dest_store_id;
  end if;

  insert into public.transfer_batches
    (tenant_id, name, source_store_id, dest_store_id, status, notes, initiated_by, initiated_staff_id, initiated_staff_code, type, reason,
     received_by, received_at)
  values
    (p_tenant_id, trim(p_name), p_source_store_id, p_dest_store_id,
     case when v_is_write_off then 'received' else 'pending' end,
     p_notes, p_user_id, v_staff_member_id, nullif(trim(coalesce(p_staff_code, '')), ''), p_type, p_reason,
     case when v_is_write_off then p_user_id else null end,
     case when v_is_write_off then now() else null end)
  returning id into v_batch_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::numeric;

    if v_product_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Ligne de transfert invalide.';
    end if;

    if not exists (select 1 from public.products where id = v_product_id and tenant_id = p_tenant_id) then
      raise exception 'Produit introuvable dans le système: %', v_product_id;
    end if;

    select quantity into v_current_qty
    from public.inventory
    where tenant_id = p_tenant_id and product_id = v_product_id and store_id is not distinct from p_source_store_id
    for update;

    if v_current_qty is null or v_current_qty < v_qty then
      raise exception 'Stock insuffisant pour le produit % (disponible: %).', v_product_id, coalesce(v_current_qty, 0);
    end if;

    update public.inventory
    set quantity = quantity - v_qty, updated_at = now()
    where tenant_id = p_tenant_id and product_id = v_product_id and store_id is not distinct from p_source_store_id;

    insert into public.stock_transfers
      (tenant_id, product_id, source_store_id, dest_store_id, quantity, status, notes, initiated_by, batch_id,
       received_by, received_at)
    values
      (p_tenant_id, v_product_id, p_source_store_id, p_dest_store_id, v_qty,
       case when v_is_write_off then 'received' else 'pending' end,
       p_notes, p_user_id, v_batch_id,
       case when v_is_write_off then p_user_id else null end,
       case when v_is_write_off then now() else null end);

    insert into public.stock_movements (tenant_id, product_id, store_id, movement_type, quantity, reason, user_id)
    values (
      p_tenant_id, v_product_id, p_source_store_id,
      case when p_type = 'rms' then 'rms_out' else 'transfer_out' end,
      v_qty,
      case
        when v_is_write_off then 'RMS (' || coalesce(p_reason, 'autre') || ') "' || trim(p_name) || '" — écriture de perte interne'
        when p_type = 'rms' then 'RMS (' || coalesce(p_reason, 'autre') || ') "' || trim(p_name) || '" vers ' || coalesce(v_dest_name, '')
        else 'Transfert "' || trim(p_name) || '" vers ' || coalesce(v_dest_name, '')
      end,
      p_user_id
    );
  end loop;

  return v_batch_id;
end;
$$;

grant execute on function public.initiate_stock_transfer_batch to authenticated;

-- Net cash refunds (public.sale_returns, refund_method = 'cash') against
-- expected cash at close, same signature as 0045/0050 so every existing
-- caller (day-open/close UI, X-report) keeps working unchanged.
create or replace function public.close_day_session(
  p_session_id uuid,
  p_closing_cash numeric,
  p_notes text,
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_member_id uuid;
  v_cash_sales numeric;
  v_cash_returns numeric;
begin
  select * into v_session from public.day_sessions where id = p_session_id for update;
  if v_session is null then raise exception 'Journée introuvable.'; end if;
  if v_session.status <> 'open' then raise exception 'Cette journée est déjà clôturée.'; end if;

  select id into v_member_id from public.tenant_members where user_id = p_user_id and tenant_id = v_session.tenant_id;
  if v_member_id is null then raise exception 'Non autorisé.'; end if;

  select coalesce(sum(total), 0) into v_cash_sales
  from public.sales
  where day_session_id = p_session_id and payment_method = 'cash' and sale_status <> 'cancelled';

  select coalesce(sum(refund_amount), 0) into v_cash_returns
  from public.sale_returns
  where day_session_id = p_session_id and refund_method = 'cash';

  update public.day_sessions
  set status = 'closed',
      closing_cash = p_closing_cash,
      expected_cash = v_session.opening_cash + v_cash_sales - v_cash_returns,
      cash_variance = p_closing_cash - (v_session.opening_cash + v_cash_sales - v_cash_returns),
      notes = coalesce(p_notes, v_session.notes),
      closed_by = p_user_id,
      closed_at = now()
  where id = p_session_id;
end;
$$;

grant execute on function public.close_day_session to authenticated;
