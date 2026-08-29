-- Named, multi-product stock transfers (Transfer Out / Transfer In), the way
-- a shop floor actually does it: give the transfer a name, scan several
-- products into it, send it — it shows up at the destination as "pending to
-- receive" while stock stays put in the source system until the destination
-- explicitly receives it. This wraps the existing single-product atomic
-- functions from 0027 in a batch: those functions and the `stock_transfers`
-- rows they create are untouched and keep working exactly as before for any
-- caller that doesn't use a batch (batch_id stays null for them).

create table if not exists public.transfer_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  source_store_id uuid not null references public.stores(id) on delete cascade,
  dest_store_id uuid not null references public.stores(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'received', 'cancelled')),
  notes text,
  -- Who physically initiated it: the logged-in session (initiated_by) and,
  -- when the terminal is shared and the actual staff typed their own Staff
  -- ID instead of using the logged-in account, the tenant_members row that
  -- ID resolved to (initiated_staff_id / initiated_staff_code).
  initiated_by uuid references auth.users(id) on delete set null,
  initiated_staff_id uuid references public.tenant_members(id) on delete set null,
  initiated_staff_code text,
  received_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  received_at timestamptz,
  constraint transfer_batches_stores_differ check (source_store_id <> dest_store_id)
);

create index if not exists tb_tenant_idx on public.transfer_batches (tenant_id, created_at desc);

alter table public.transfer_batches enable row level security;

drop policy if exists "tb_select_member" on public.transfer_batches;
create policy "tb_select_member" on public.transfer_batches for select
  using (exists (select 1 from public.tenant_members tm where tm.tenant_id = transfer_batches.tenant_id and tm.user_id = auth.uid()));

-- All writes go through the security-definer RPCs below (same pattern as
-- 0027's single-item transfers), so no direct insert/update policy is
-- needed for authenticated users beyond select.

-- Link stock_transfers line items to an optional batch. Nullable and
-- backward compatible: existing single-product transfers (and the RPCs
-- that create them) are entirely unaffected.
alter table public.stock_transfers add column if not exists batch_id uuid references public.transfer_batches(id) on delete set null;
create index if not exists st_batch_idx on public.stock_transfers (batch_id);

create or replace function public.initiate_stock_transfer_batch(
  p_tenant_id uuid,
  p_name text,
  p_source_store_id uuid,
  p_dest_store_id uuid,
  p_items jsonb, -- [{"product_id": "...", "quantity": 3}, ...]
  p_notes text,
  p_staff_code text, -- optional: staff physically doing it, if different from the logged-in session
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

  -- Optional: resolve the physical staff ID typed at the terminal, and
  -- require THEY are allowed to transfer from this store too (not just
  -- whoever's session is logged in) — this is the actual point of asking
  -- for a Staff ID on a shared terminal.
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
    (tenant_id, name, source_store_id, dest_store_id, status, notes, initiated_by, initiated_staff_id, initiated_staff_code)
  values
    (p_tenant_id, trim(p_name), p_source_store_id, p_dest_store_id, 'pending', p_notes, p_user_id, v_staff_member_id, nullif(trim(coalesce(p_staff_code, '')), ''))
  returning id into v_batch_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::numeric;

    if v_product_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Ligne de transfert invalide.';
    end if;

    -- Products must already exist in the system — the FK on stock_transfers.
    -- product_id enforces this, but we check explicitly first for a clear
    -- error message instead of a raw FK violation.
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
    values (p_tenant_id, v_product_id, p_source_store_id, 'transfer_out', v_qty, 'Transfert "' || trim(p_name) || '" vers ' || coalesce(v_dest_name, ''), p_user_id);
  end loop;

  return v_batch_id;
end;
$$;

create or replace function public.receive_stock_transfer_batch(p_batch_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_member_id uuid;
  v_can_transfer boolean;
  v_is_admin boolean;
  v_source_name text;
  v_line record;
begin
  select * into v_batch from public.transfer_batches where id = p_batch_id for update;
  if v_batch is null then raise exception 'Transfert introuvable.'; end if;
  if v_batch.status <> 'pending' then raise exception 'Ce transfert a déjà été traité.'; end if;

  select id, role in ('admin', 'super_admin') into v_member_id, v_is_admin
  from public.tenant_members where user_id = p_user_id and tenant_id = v_batch.tenant_id;
  if v_member_id is null then raise exception 'Non autorisé.'; end if;

  if not v_is_admin then
    select coalesce(bool_or(can_transfer), false) into v_can_transfer
    from public.store_assignments
    where member_id = v_member_id and store_id = v_batch.dest_store_id;
    if not v_can_transfer then
      raise exception 'Vous n''êtes pas autorisé à recevoir dans ce magasin.';
    end if;
  end if;

  select name into v_source_name from public.stores where id = v_batch.source_store_id;

  for v_line in
    select * from public.stock_transfers where batch_id = p_batch_id and status = 'pending' for update
  loop
    update public.inventory
    set quantity = quantity + v_line.quantity, updated_at = now()
    where tenant_id = v_line.tenant_id and product_id = v_line.product_id
      and store_id is not distinct from v_line.dest_store_id;

    if not found then
      insert into public.inventory (tenant_id, product_id, store_id, quantity)
      values (v_line.tenant_id, v_line.product_id, v_line.dest_store_id, v_line.quantity);
    end if;

    insert into public.stock_movements (tenant_id, product_id, store_id, movement_type, quantity, reason, user_id)
    values (v_line.tenant_id, v_line.product_id, v_line.dest_store_id, 'transfer_in', v_line.quantity, 'Transfert "' || v_batch.name || '" reçu de ' || coalesce(v_source_name, ''), p_user_id);

    update public.stock_transfers
    set status = 'received', received_by = p_user_id, received_at = now()
    where id = v_line.id;
  end loop;

  update public.transfer_batches
  set status = 'received', received_by = p_user_id, received_at = now()
  where id = p_batch_id;
end;
$$;

create or replace function public.cancel_stock_transfer_batch(p_batch_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_member_id uuid;
  v_is_admin boolean;
  v_can_transfer boolean;
  v_line record;
begin
  select * into v_batch from public.transfer_batches where id = p_batch_id for update;
  if v_batch is null then raise exception 'Transfert introuvable.'; end if;
  if v_batch.status <> 'pending' then raise exception 'Ce transfert a déjà été traité.'; end if;

  select id, role in ('admin', 'super_admin') into v_member_id, v_is_admin
  from public.tenant_members where user_id = p_user_id and tenant_id = v_batch.tenant_id;
  if v_member_id is null then raise exception 'Non autorisé.'; end if;

  if not v_is_admin then
    select coalesce(bool_or(can_transfer), false) into v_can_transfer
    from public.store_assignments
    where member_id = v_member_id and store_id in (v_batch.source_store_id, v_batch.dest_store_id);
    if not v_can_transfer then
      raise exception 'Vous n''êtes pas autorisé à annuler ce transfert.';
    end if;
  end if;

  for v_line in
    select * from public.stock_transfers where batch_id = p_batch_id and status = 'pending' for update
  loop
    update public.inventory
    set quantity = quantity + v_line.quantity, updated_at = now()
    where tenant_id = v_line.tenant_id and product_id = v_line.product_id
      and store_id is not distinct from v_line.source_store_id;

    if not found then
      insert into public.inventory (tenant_id, product_id, store_id, quantity)
      values (v_line.tenant_id, v_line.product_id, v_line.source_store_id, v_line.quantity);
    end if;

    update public.stock_transfers set status = 'cancelled' where id = v_line.id;
  end loop;

  update public.transfer_batches set status = 'cancelled' where id = p_batch_id;
end;
$$;

grant execute on function public.initiate_stock_transfer_batch to authenticated;
grant execute on function public.receive_stock_transfer_batch to authenticated;
grant execute on function public.cancel_stock_transfer_batch to authenticated;

comment on table public.transfer_batches is
  'A named Transfer Out grouping one or more product lines (public.stock_transfers rows via batch_id). Mirrors the "Transfer Out / Transfer In" workflow: pending at initiation (stock already deducted from source), received explicitly by the destination store (credits destination, only then final).';
