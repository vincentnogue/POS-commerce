-- ============================================================================
-- SECURITY FIX (critical): privilege escalation via self-editable
-- tenant_members.role / custom_role_id / tenant_id
-- ============================================================================
--
-- The RLS policies "members_insert_admin" and "members_update_admin" both
-- include a "user_id = auth.uid()" clause in their WITH CHECK. RLS operates
-- on whole rows, not individual columns — so that clause doesn't just let
-- someone touch their own membership row, it lets them set ANY column on it
-- to ANY value, including:
--   - role = 'super_admin' (self-promotion — grants is_super_admin() = true,
--     which bypasses RLS across most of the schema, including the `plans`
--     table used for global pricing)
--   - tenant_id = <any other tenant's id> on INSERT (joining a tenant they
--     have no legitimate relationship with)
--
-- RLS alone can't restrict which columns a matched policy allows changing,
-- so this is fixed with a BEFORE INSERT/UPDATE trigger that re-validates the
-- specific privileged fields regardless of which policy let the row through.
-- A first-member bootstrap exception is kept so tenant creation (the admin's
-- own first membership row, created via the SECURITY DEFINER create_tenant
-- RPC) keeps working — but even then, self-assigning 'super_admin' on that
-- first row is blocked.

create or replace function public.protect_tenant_member_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_privileged boolean;
  is_first_member boolean;
begin
  -- Edge functions (invite-member, super-admin-manage, ...) write here using
  -- the service role key after already performing their own authorization
  -- checks in application code. auth.uid() has no meaning for that role
  -- (no user JWT), and BYPASSRLS doesn't skip triggers like it does
  -- policies — so service_role must be explicitly trusted here, or every
  -- legitimate service-role write would be wrongly rejected below.
  if auth.role() = 'service_role' then
    return new;
  end if;

  is_privileged := public.is_tenant_admin_or_manager(auth.uid(), new.tenant_id) or public.is_super_admin(auth.uid());

  if is_privileged then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    is_first_member := not exists (
      select 1 from public.tenant_members where tenant_id = new.tenant_id
    );

    if is_first_member then
      if new.role = 'super_admin' then
        raise exception 'SECURITY: cannot self-assign super_admin when creating a tenant.';
      end if;
      return new; -- legitimate bootstrap: first admin of a brand new tenant
    end if;

    if new.user_id <> auth.uid() then
      raise exception 'SECURITY: only tenant admins/managers can add other members.';
    end if;
    if new.role = 'super_admin' then
      raise exception 'SECURITY: cannot self-assign the super_admin role.';
    end if;
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if new.role is distinct from old.role
       or new.custom_role_id is distinct from old.custom_role_id
       or new.tenant_id is distinct from old.tenant_id
       or new.user_id is distinct from old.user_id
    then
      raise exception 'SECURITY: you cannot change role, custom_role_id, tenant_id, or user_id on your own membership.';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_privileged_fields on public.tenant_members;
create trigger protect_privileged_fields
  before insert or update on public.tenant_members
  for each row execute function public.protect_tenant_member_privileged_fields();
