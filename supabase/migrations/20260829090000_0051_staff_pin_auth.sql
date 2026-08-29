-- Staff PIN authentication (D365-style "Staff ID + code").
--
-- Today, on a shared terminal, a Staff ID typed into the transfer/RMS form
-- (initiated_staff_code) is trusted purely by string match: anyone can type
-- ANY colleague's Staff ID and it gets recorded as if that person did it.
-- This adds a short PIN ("code"), set by an admin/manager when the staff's
-- account/role is created (or later), and requires it to match before a
-- typed Staff ID is accepted anywhere.
--
-- Purely additive: new nullable column + two new functions, and
-- initiate_stock_transfer_batch (last redefined in 0047) gets exactly one
-- new optional trailing parameter with a default, so any other existing
-- caller keeps working unchanged. The RMS/transfer logic itself (inventory
-- deduction, stock_movements, reason handling) is untouched byte-for-byte.

create extension if not exists pgcrypto;

alter table public.tenant_members add column if not exists pin_hash text;

comment on column public.tenant_members.pin_hash is
  'Hashed short PIN (4-8 digits) set by an admin/manager for this staff member. Required, alongside staff_code, to attribute an action to them on a shared terminal without their own logged-in session.';

create or replace function public.set_staff_pin(
  p_tenant_id uuid,
  p_member_id uuid,
  p_pin text,
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
begin
  select role into v_caller_role
  from public.tenant_members
  where tenant_id = p_tenant_id and user_id = p_user_id;

  if v_caller_role is null or v_caller_role not in ('admin', 'super_admin', 'manager') then
    raise exception 'Non autorisé.';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'Le code doit contenir entre 4 et 8 chiffres.';
  end if;

  if not exists (select 1 from public.tenant_members where id = p_member_id and tenant_id = p_tenant_id) then
    raise exception 'Membre introuvable.';
  end if;

  update public.tenant_members
  set pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = p_member_id and tenant_id = p_tenant_id;
end;
$$;

create or replace function public.verify_staff_pin(
  p_tenant_id uuid,
  p_staff_code text,
  p_pin text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_pin_hash text;
begin
  select id, pin_hash into v_member_id, v_pin_hash
  from public.tenant_members
  where tenant_id = p_tenant_id and staff_code = trim(p_staff_code);

  if v_member_id is null then
    raise exception 'Staff ID introuvable: %', p_staff_code;
  end if;

  if v_pin_hash is null then
    raise exception 'Aucun code n''a été défini pour ce Staff ID. Demandez à un administrateur d''en créer un.';
  end if;

  if p_pin is null or crypt(p_pin, v_pin_hash) <> v_pin_hash then
    raise exception 'Code incorrect pour ce Staff ID.';
  end if;

  return v_member_id;
end;
$$;

grant execute on function public.set_staff_pin to authenticated;
grant execute on function public.verify_staff_pin to authenticated;

drop function if exists public.initiate_stock_transfer_batch(uuid, text, uuid, uuid, jsonb, text, text, uuid, text, text);

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

  -- A typed Staff ID now MUST come with its matching PIN — no more trusting
  -- the string alone. This is the actual point of asking for a Staff ID on
  -- a shared terminal: proving who is physically doing the action.
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
