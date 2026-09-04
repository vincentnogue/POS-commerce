-- Real subscription extension for super admins — audit finding: the
-- Super Admin module had zero action anywhere to extend a tenant's
-- subscription or trial. The only tenant actions were suspend/activate/
-- delete/impersonate. Worse, the "status" badge shown to the super admin
-- (SuperTenants.subStatus in the frontend) recomputed trial status from
-- tenants.created_at + 14 days instead of reading the real source of
-- truth (subscriptions.trial_ends_at, subscriptions.status — see
-- tenant_access_active() in migration 0047) — so even a hand-written SQL
-- UPDATE to extend a trial would never have shown up as "effective" in
-- the dashboard. Fixed together in this commit: this function writes the
-- real fields tenant_access_active() actually reads, and the frontend
-- (SuperTenants) is updated to read the same real fields for its status
-- badge instead of recomputing its own.
--
-- Design, matching how tenant_access_active() actually grants access:
-- - If the subscription is currently trialing (trial_ends_at in the
--   future, or status = 'trialing'), extending pushes trial_ends_at
--   forward — this is what genuinely buys more free access time.
-- - current_period_end is always updated too, purely for record-keeping/
--   reporting (the Subscriptions tab already displays it) — it plays no
--   role in tenant_access_active()'s gating, but a super admin extending
--   someone's subscription reasonably expects this to reflect the new
--   date.
-- - If p_reactivate is true and status is anything other than
--   'active'/'trialing' (e.g. 'past_due', 'canceled'), status is reset to
--   'active' — because an extension that leaves a canceled subscription
--   canceled would not actually restore access, silently failing the
--   "must be effective" requirement.
-- - If the tenant has no subscription row at all yet, one is created
--   with the extension applied — matching tenant_access_active()'s own
--   fallback-then-real-row precedence.
-- - Every call is written to audit_log (actor, tenant, before/after) so
--   this powerful action is traceable from Super Admin > Audit.
create or replace function public.super_admin_extend_subscription(
  p_tenant_id uuid,
  p_new_period_end timestamptz,
  p_reactivate boolean default true
) returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_email text;
  v_sub public.subscriptions;
  v_plan_id uuid;
  v_before jsonb;
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'Only a super admin can extend a subscription';
  end if;

  select email into v_actor_email from auth.users where id = auth.uid();

  select * into v_sub from public.subscriptions where tenant_id = p_tenant_id limit 1;

  if found then
    v_before := to_jsonb(v_sub);
    update public.subscriptions
    set
      current_period_end = p_new_period_end,
      trial_ends_at = case
        when trial_ends_at is not null and trial_ends_at > now() then greatest(trial_ends_at, p_new_period_end)
        when status = 'trialing' then p_new_period_end
        else trial_ends_at
      end,
      status = case
        when p_reactivate and status not in ('active', 'trialing') then 'active'
        else status
      end,
      updated_at = now()
    where tenant_id = p_tenant_id
    returning * into v_sub;
  else
    select plan_id into v_plan_id from public.tenants where id = p_tenant_id;
    v_before := null;
    insert into public.subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_end, billing_cycle)
    values (p_tenant_id, v_plan_id, 'active', null, p_new_period_end, 'monthly')
    returning * into v_sub;
  end if;

  insert into public.audit_log (tenant_id, actor_email, action, entity, details)
  values (
    p_tenant_id, v_actor_email, 'subscription_extended', 'subscriptions',
    jsonb_build_object('before', v_before, 'after', to_jsonb(v_sub), 'new_period_end', p_new_period_end, 'reactivated', p_reactivate)
  );

  return v_sub;
end;
$$;

grant execute on function public.super_admin_extend_subscription to authenticated;
