-- RMS (Report Management System): when something breaks/is damaged/expires
-- in a store, it's deducted from that store's stock by initiating what is,
-- mechanically, a Transfer Out to Direction/HO — exactly like a normal
-- store-to-store transfer (stock leaves the source immediately, sits
-- "pending" until received), except the destination is the company's
-- configured Direction/HO store and the batch carries a reason (broken,
-- expired, damaged, lost, other) instead of being a restock.
--
-- Purely additive on top of 0043's transfer_batches / initiate_stock_
-- transfer_batch: two new columns (type, reason) with a safe default, one
-- new nullable tenant setting (rms_destination_store_id, set by the admin
-- exactly like any other tenants field, via the existing tenants UPDATE
-- policy — no new RPC needed for that part), and the existing transfer
-- function gets two new optional trailing parameters with defaults, so
-- every existing call site (and the parallel StockPage.tsx transfer UI)
-- keeps working completely unchanged.

alter table public.transfer_batches
  add column if not exists type text not null default 'transfer' check (type in ('transfer', 'rms'));
alter table public.transfer_batches
  add column if not exists reason text check (reason is null or reason in ('broken', 'expired', 'damaged', 'lost', 'other'));

alter table public.tenants
  add column if not exists rms_destination_store_id uuid references public.stores(id) on delete set null;

comment on column public.tenants.rms_destination_store_id is
  'Où sont envoyés les rapports RMS (casse/perte) par défaut — "la direction ou le HO", configuré par l''admin du tenant. Un rapport RMS individuel peut toujours choisir un autre magasin de destination.';

-- Replace (not overload) the 0043 function: same name, more optional
-- trailing params. Overloading by parameter count here would make the
-- function ambiguous for both direct SQL calls and PostgREST's RPC
-- resolution — there must be exactly one initiate_stock_transfer_batch.
drop function if exists public.initiate_stock_transfer_batch(uuid, text, uuid, uuid, jsonb, text, text, uuid);

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
  p_reason text default null
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
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Le transfert doit avoir un nom.';
  end if;
  if p_source_store_id = p_dest_store_id then
    raise exception 'Le magasin source et destination doivent être différents.';
  end if;
  if p_type not in ('transfer', 'rms') then
    raise exception 'Type de transfert invalide.';
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

  if p_staff_code is not null and trim(p_staff_code) <> '' then
    select id into v_staff_member_id
    from public.tenant_members
    where tenant_id = p_tenant_id and staff_code = trim(p_staff_code);
    if v_staff_member_id is null then
      raise exception 'Staff ID introuvable: %', p_staff_code;
    end if;
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

  select name into v_dest_name from public.stores where id = p_dest_store_id;

  insert into public.transfer_batches
    (tenant_id, name, source_store_id, dest_store_id, status, notes, initiated_by, initiated_staff_id, initiated_staff_code, type, reason)
  values
    (p_tenant_id, trim(p_name), p_source_store_id, p_dest_store_id, 'pending', p_notes, p_user_id, v_staff_member_id, nullif(trim(coalesce(p_staff_code, '')), ''), p_type, p_reason)
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
      (tenant_id, product_id, source_store_id, dest_store_id, quantity, status, notes, initiated_by, batch_id)
    values
      (p_tenant_id, v_product_id, p_source_store_id, p_dest_store_id, v_qty, 'pending', p_notes, p_user_id, v_batch_id);

    insert into public.stock_movements (tenant_id, product_id, store_id, movement_type, quantity, reason, user_id)
    values (
      p_tenant_id, v_product_id, p_source_store_id,
      case when p_type = 'rms' then 'rms_out' else 'transfer_out' end,
      v_qty,
      case when p_type = 'rms'
        then 'RMS (' || coalesce(p_reason, 'autre') || ') "' || trim(p_name) || '" vers ' || coalesce(v_dest_name, '')
        else 'Transfert "' || trim(p_name) || '" vers ' || coalesce(v_dest_name, '')
      end,
      p_user_id
    );
  end loop;

  return v_batch_id;
end;
$$;

grant execute on function public.initiate_stock_transfer_batch to authenticated;
