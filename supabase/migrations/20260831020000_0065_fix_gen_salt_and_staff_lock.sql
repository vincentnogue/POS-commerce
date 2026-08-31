-- Fix "function gen_salt(unknown) does not exist" and add staff self
-- lock/unlock (D365-style: a staff member can lock their own account with
-- their PIN, and unlock it the same way; while locked, that PIN cannot be
-- used to authorize anything. Only admin/super_admin can SET or CHANGE a
-- PIN (unchanged from 0064) -- locking/unlocking is not "changing" it).
--
-- Root cause of the gen_salt bug: on this Supabase project, pgcrypto's
-- functions live in the `extensions` schema, not `public`. The functions in
-- 0051/0064 declared `set search_path = public`, so at call time Postgres
-- could not find gen_salt()/crypt() at all -- CREATE EXTENSION succeeding
-- doesn't move already-installed functions, and a plpgsql function's
-- search_path is fixed at definition time. Every function below adds
-- `extensions` to search_path; nothing else about their logic changes.

alter table public.tenant_members add column if not exists is_locked boolean not null default false;

comment on column public.tenant_members.is_locked is
  'Self-service lock: the staff member locked their own account with their PIN (separate from role/active-status, which only admins control). While true, verify_staff_pin refuses this staff_code for any action.';

-- Internal: does this Staff ID + PIN actually match? No lock check here on
-- purpose -- both lock_staff_account and unlock_staff_account need to
-- authenticate the PIN regardless of current lock state (otherwise a locked
-- account could never be unlocked).
create or replace function public.check_staff_pin(
  p_tenant_id uuid,
  p_staff_code text,
  p_pin text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
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

-- Public: same signature/behavior as before (matching + lock check), used
-- by every action that requires an unlocked, authenticated staff member
-- (stock transfers, RMS, and future PIN-gated actions).
create or replace function public.verify_staff_pin(
  p_tenant_id uuid,
  p_staff_code text,
  p_pin text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member_id uuid;
  v_is_locked boolean;
begin
  v_member_id := public.check_staff_pin(p_tenant_id, p_staff_code, p_pin);

  select is_locked into v_is_locked from public.tenant_members where id = v_member_id;
  if v_is_locked then
    raise exception 'Ce compte est verrouillé. Déverrouillez-le avec votre code avant de continuer.';
  end if;

  return v_member_id;
end;
$$;

-- A staff member locks their own account with their own Staff ID + PIN.
create or replace function public.lock_staff_account(
  p_tenant_id uuid,
  p_staff_code text,
  p_pin text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member_id uuid;
begin
  v_member_id := public.check_staff_pin(p_tenant_id, p_staff_code, p_pin);
  update public.tenant_members set is_locked = true where id = v_member_id;
end;
$$;

-- A staff member unlocks their own account with their own Staff ID + PIN.
create or replace function public.unlock_staff_account(
  p_tenant_id uuid,
  p_staff_code text,
  p_pin text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member_id uuid;
begin
  v_member_id := public.check_staff_pin(p_tenant_id, p_staff_code, p_pin);
  update public.tenant_members set is_locked = false where id = v_member_id;
end;
$$;

-- Re-fix set_staff_pin (0064's version) for the same search_path bug —
-- admin/super_admin-only, unchanged otherwise.
create or replace function public.set_staff_pin(
  p_tenant_id uuid,
  p_member_id uuid,
  p_pin text,
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller_role text;
begin
  select role into v_caller_role
  from public.tenant_members
  where tenant_id = p_tenant_id and user_id = p_user_id;

  if v_caller_role is null or v_caller_role not in ('admin', 'super_admin') then
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

grant execute on function public.check_staff_pin to authenticated;
grant execute on function public.verify_staff_pin to authenticated;
grant execute on function public.lock_staff_account to authenticated;
grant execute on function public.unlock_staff_account to authenticated;
grant execute on function public.set_staff_pin to authenticated;
