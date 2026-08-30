-- Security audit finding (multi-tenant isolation review):
--
-- audit_log's INSERT policy ("audit_insert_member", migration 0001) was
-- `to authenticated with check (true)` — any authenticated user of ANY
-- tenant could insert an audit_log row for ANY OTHER tenant_id, with any
-- actor_id/actor_email/action/details they wanted. Nothing in the app
-- actually does this directly (audit rows are written by trusted
-- server-side code paths, which use the service role and bypass RLS
-- entirely) — but the policy was still reachable by any authenticated
-- client hitting the REST API directly, and a forged audit trail entry
-- attributed to a different tenant, or a fabricated action under someone
-- else's actor_id, is exactly the kind of gap that matters once this is
-- serving many independent tenants: audit_log is the record relied on
-- for incident investigation, so it must not be writable across tenant
-- boundaries or under a spoofed identity.
--
-- Tightened to require: the actor_id is the caller's own auth.uid(), and
-- either tenant_id is null (platform-level events) or the caller is
-- actually a member of that tenant (or is a super admin, who can act on
-- any tenant by design). SELECT policy is unchanged (already correctly
-- scoped to tenant admins/super_admin).

drop policy if exists "audit_insert_member" on public.audit_log;
create policy "audit_insert_member" on public.audit_log for insert
  to authenticated with check (
    (actor_id is null or actor_id = auth.uid())
    and (
      tenant_id is null
      or exists (select 1 from public.tenant_members tm where tm.tenant_id = audit_log.tenant_id and tm.user_id = auth.uid())
      or public.is_super_admin(auth.uid())
    )
  );
