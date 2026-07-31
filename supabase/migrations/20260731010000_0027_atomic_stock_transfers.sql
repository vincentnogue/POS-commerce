-- Store-to-store stock transfers were computed client-side: read the
-- current quantity, subtract/add in JavaScript, write it back in a
-- separate request. Two staff acting on the same product/store around the
-- same time can lose one of the updates (classic read-then-write race),
-- silently corrupting the stock count — exactly the kind of "coherence"
-- issue to avoid for something as consequential as inventory. These three
-- functions replace that with single atomic database transactions.

create or replace function public.initiate_stock_transfer(
  p_tenant_id uuid,
  p_product_id uuid,
  p_source_store_id uuid,
  p_dest_store_id uuid,
  p_quantity numeric,
  p_notes text,
  p_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_can_transfer boolean;
  v_is_admin boolean;
  v_current_qty numeric;
  v_transfer_id uuid;
  v_dest_name text;
begin
  if p_quantity <= 0 then
    raise exception 'La quantité doit être positive.';
  end if;
  if p_source_store_id = p_dest_store_id then
    raise exception 'Le magasin source et destination doivent être différents.';
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

  -- Lock the source row for the duration of this transaction so a second
  -- concurrent transfer of the same product/store must wait its turn
  -- instead of racing against a stale read.
  select quantity into v_current_qty
  from public.inventory
  where tenant_id = p_tenant_id and product_id = p_product_id and store_id is not distinct from p_source_store_id
  for update;

  if v_current_qty is null or v_current_qty < p_quantity then
    raise exception 'Stock insuffisant dans le magasin source (disponible: %).', coalesce(v_current_qty, 0);
  end if;

  update public.inventory
  set quantity = quantity - p_quantity, updated_at = now()
  where tenant_id = p_tenant_id and product_id = p_product_id and store_id is not distinct from p_source_store_id;

  select name into v_dest_name from public.stores where id = p_dest_store_id;

  insert into public.stock_transfers (tenant_id, product_id, source_store_id, dest_store_id, quantity, status, notes, initiated_by)
  values (p_tenant_id, p_product_id, p_source_store_id, p_dest_store_id, p_quantity, 'pending', p_notes, p_user_id)
  returning id into v_transfer_id;

  insert into public.stock_movements (tenant_id, product_id, store_id, movement_type, quantity, reason, user_id)
  values (p_tenant_id, p_product_id, p_source_store_id, 'transfer_out', p_quantity, 'Transfert vers ' || coalesce(v_dest_name, ''), p_user_id);

  return v_transfer_id;
end;
$$;

create or replace function public.receive_stock_transfer(p_transfer_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer record;
  v_member_id uuid;
  v_can_transfer boolean;
  v_is_admin boolean;
  v_source_name text;
begin
  select * into v_transfer from public.stock_transfers where id = p_transfer_id for update;
  if v_transfer is null then raise exception 'Transfert introuvable.'; end if;
  if v_transfer.status <> 'pending' then raise exception 'Ce transfert a déjà été traité.'; end if;

  select id, role in ('admin', 'super_admin') into v_member_id, v_is_admin
  from public.tenant_members where user_id = p_user_id and tenant_id = v_transfer.tenant_id;
  if v_member_id is null then raise exception 'Non autorisé.'; end if;

  if not v_is_admin then
    select coalesce(bool_or(can_transfer), false) into v_can_transfer
    from public.store_assignments
    where member_id = v_member_id and store_id = v_transfer.dest_store_id;
    if not v_can_transfer then
      raise exception 'Vous n''êtes pas autorisé à recevoir dans ce magasin.';
    end if;
  end if;

  -- Upsert destination inventory atomically (lock if the row already
  -- exists, insert fresh otherwise).
  update public.inventory
  set quantity = quantity + v_transfer.quantity, updated_at = now()
  where tenant_id = v_transfer.tenant_id and product_id = v_transfer.product_id
    and store_id is not distinct from v_transfer.dest_store_id;

  if not found then
    insert into public.inventory (tenant_id, product_id, store_id, quantity)
    values (v_transfer.tenant_id, v_transfer.product_id, v_transfer.dest_store_id, v_transfer.quantity);
  end if;

  select name into v_source_name from public.stores where id = v_transfer.source_store_id;

  insert into public.stock_movements (tenant_id, product_id, store_id, movement_type, quantity, reason, user_id)
  values (v_transfer.tenant_id, v_transfer.product_id, v_transfer.dest_store_id, 'transfer_in', v_transfer.quantity, 'Transfert reçu de ' || coalesce(v_source_name, ''), p_user_id);

  update public.stock_transfers
  set status = 'received', received_by = p_user_id, received_at = now()
  where id = p_transfer_id;
end;
$$;

create or replace function public.cancel_stock_transfer(p_transfer_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer record;
  v_member_id uuid;
  v_is_admin boolean;
  v_can_transfer boolean;
begin
  select * into v_transfer from public.stock_transfers where id = p_transfer_id for update;
  if v_transfer is null then raise exception 'Transfert introuvable.'; end if;
  if v_transfer.status <> 'pending' then raise exception 'Ce transfert a déjà été traité.'; end if;

  select id, role in ('admin', 'super_admin') into v_member_id, v_is_admin
  from public.tenant_members where user_id = p_user_id and tenant_id = v_transfer.tenant_id;
  if v_member_id is null then raise exception 'Non autorisé.'; end if;

  if not v_is_admin then
    select coalesce(bool_or(can_transfer), false) into v_can_transfer
    from public.store_assignments
    where member_id = v_member_id and store_id in (v_transfer.source_store_id, v_transfer.dest_store_id);
    if not v_can_transfer then
      raise exception 'Vous n''êtes pas autorisé à annuler ce transfert.';
    end if;
  end if;

  -- Restore the source stock that was decremented at initiation time.
  update public.inventory
  set quantity = quantity + v_transfer.quantity, updated_at = now()
  where tenant_id = v_transfer.tenant_id and product_id = v_transfer.product_id
    and store_id is not distinct from v_transfer.source_store_id;

  if not found then
    insert into public.inventory (tenant_id, product_id, store_id, quantity)
    values (v_transfer.tenant_id, v_transfer.product_id, v_transfer.source_store_id, v_transfer.quantity);
  end if;

  update public.stock_transfers set status = 'cancelled' where id = p_transfer_id;
end;
$$;

grant execute on function public.initiate_stock_transfer to authenticated;
grant execute on function public.receive_stock_transfer to authenticated;
grant execute on function public.cancel_stock_transfer to authenticated;
