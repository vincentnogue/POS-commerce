/*
# Fix infinite recursion in tenant_members RLS policies

## Problem
The tenant_members SELECT/INSERT/UPDATE/DELETE policies each contained a
self-referential EXISTS subquery on tenant_members itself, causing infinite
RLS recursion (PostgreSQL error 42P17: "infinite recursion detected in policy
for relation tenant_members"). This blocked auth profile loading entirely —
no signed-in user could read their memberships, so the app was non-functional
after login.

## Fix
1. New helper function `is_tenant_admin_or_manager(uid, tid)` — SECURITY DEFINER
   (bypasses RLS when querying tenant_members) to check if a user holds an
   admin/super_admin/manager role for a given tenant. This replaces the
   self-referential EXISTS that caused recursion.
2. All four tenant_members policies rewritten to use this function instead of
   self-referencing the tenant_members table.

## Security
- No change to access semantics: same role checks (self, admin/manager, super_admin),
  just evaluated via a SECURITY DEFINER function that does not recurse.
- is_super_admin() already used SECURITY DEFINER (unchanged).
- The function is STABLE and SECURITY DEFINER with a pinned search_path.
*/

create or replace function public.is_tenant_admin_or_manager(uid uuid, tid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.tenant_members
    where tenant_id = tid and user_id = uid
    and role in ('admin','super_admin','manager')
  );
end;
$$;

-- ============================================================================
-- Recreate tenant_members policies without self-reference
-- ============================================================================

drop policy if exists "members_select_self_or_admin" on public.tenant_members;
create policy "members_select_self_or_admin" on public.tenant_members for select
  to authenticated using (
    user_id = auth.uid()
    or public.is_tenant_admin_or_manager(auth.uid(), tenant_members.tenant_id)
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "members_insert_admin" on public.tenant_members;
create policy "members_insert_admin" on public.tenant_members for insert
  to authenticated with check (
    user_id = auth.uid()
    or public.is_tenant_admin_or_manager(auth.uid(), tenant_members.tenant_id)
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "members_update_admin" on public.tenant_members;
create policy "members_update_admin" on public.tenant_members for update
  to authenticated using (
    user_id = auth.uid()
    or public.is_tenant_admin_or_manager(auth.uid(), tenant_members.tenant_id)
    or public.is_super_admin(auth.uid())
  ) with check (
    user_id = auth.uid()
    or public.is_tenant_admin_or_manager(auth.uid(), tenant_members.tenant_id)
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "members_delete_admin" on public.tenant_members;
create policy "members_delete_admin" on public.tenant_members for delete
  to authenticated using (
    user_id = auth.uid()
    or public.is_tenant_admin_or_manager(auth.uid(), tenant_members.tenant_id)
    or public.is_super_admin(auth.uid())
  );