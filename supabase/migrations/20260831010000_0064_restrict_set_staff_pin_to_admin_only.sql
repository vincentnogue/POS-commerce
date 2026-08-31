-- Tighten set_staff_pin: only admin/super_admin may set a staff member's
-- PIN, not 'manager'. Requested explicitly: "seul admin peut changer les
-- codes des staff". verify_staff_pin (who can USE a PIN to unlock/attribute
-- an action) is unaffected — this only narrows who can SET/CHANGE one.
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
