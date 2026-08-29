-- SECURITY FIX (critical, tenant isolation): a tenant's own admin/manager
-- could grant the 'super_admin' role to any tenant_members row within
-- THEIR OWN tenant, because protect_tenant_member_privileged_fields()
-- (0019) let any "is_privileged" caller (is_tenant_admin_or_manager for
-- that tenant, OR an existing super_admin) write role/custom_role_id/
-- tenant_id/user_id completely unrestricted once privileged.
--
-- The consequence is platform-wide, not tenant-scoped: public.is_super_admin
-- checks tenant_members.role = 'super_admin' with NO tenant filter (by
-- design — see the comment in src/lib/auth.tsx about mirroring that check
-- "independent of the active tenant"), and is used across ~16 RLS policies
-- as a cross-tenant bypass. Worse, supabase/functions/super-admin-auth
-- grants full access to the platform's Super Admin panel itself to anyone
-- with such a row, with no tenant scoping either.
--
-- 0019 already recognised and blocked ONE path to this (self-assigning
-- super_admin while bootstrapping a brand-new tenant), but left the door
-- open for an *established* tenant admin/manager to promote any member
-- (including themselves via a second admin, or a colluding staff account)
-- to super_admin from inside their own tenant — a fully legitimate,
-- paying customer of the product silently becoming a platform-wide
-- super-admin. That is the actual, real, currently-exploitable gap.
--
-- Fix: assigning role = 'super_admin' now requires service_role (i.e. an
-- edge function/migration acting with the service key after its own
-- authorization — the same trust boundary platform_admins/platform_staff
-- already rely on), full stop, regardless of who else is "privileged" for
-- that tenant. Every other role transition (admin/manager/staff/viewer,
-- including for existing super_admin rows changing to something else) is
-- completely unaffected — this closes one specific escalation path, it
-- does not change tenant-admin permissions otherwise.

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
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- No authenticated (non-service-role) request may ever grant super_admin,
  -- regardless of how privileged the caller otherwise is for this tenant.
  -- This is the actual fix: previously "is_privileged" callers hit the
  -- unrestricted `return new` below before this could ever be checked.
  if new.role = 'super_admin' and (TG_OP = 'INSERT' or new.role is distinct from old.role) then
    raise exception 'SECURITY: the super_admin role can only be granted by the platform, not from within a tenant.';
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
      return new; -- legitimate bootstrap: first admin of a brand new tenant
    end if;

    if new.user_id <> auth.uid() then
      raise exception 'SECURITY: only tenant admins/managers can add other members.';
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
