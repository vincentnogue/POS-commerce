-- Promotions (migration 0070) was shipped without plan-tier gating or
-- granular-permission enforcement — unlike every other substantial
-- module (invoices, deliveries, accounting...), any tenant member could
-- read AND write promotions via the API regardless of plan or role, and
-- Starter tenants got this Pro+ growth feature for free. This closes
-- that gap the same way migrations 0023/0024 did for every other module.
--
-- held_sales and time_clock_entries are deliberately NOT touched here —
-- they're basic, always-available staff actions (parking a cart,
-- clocking in/out), not a paywalled business feature, same bucket as
-- dashboard/pos/settings. Gating time_clock_entries by role permission
-- would risk locking regular staff out of clocking themselves in, since
-- the 'staff' role has no default permission entry for a brand-new
-- module code — a real regression, not a fix. Left as-is on purpose.

update public.plans set included_modules = array_append(included_modules, 'promotions')
  where code in ('pro', 'premium', 'entreprise') and not ('promotions' = any(included_modules));

drop policy if exists promotions_tenant_access on public.promotions;

-- BUG FIX: applied once via the Supabase SQL Editor (during the CI outage
-- caused by the migration-timestamp collision fixed alongside this), so
-- `supabase db push` failed on "policy already exists" the next time it
-- tried to run this file — CI never marks a migration as applied unless
-- the whole file succeeds, so that one failure would have kept blocking
-- every migration after it, forever. Adding `drop policy if exists`
-- before each CREATE POLICY (the same pattern already used correctly by
-- e.g. migration 0085) makes this file safe to run again with no effect
-- the second time.
drop policy if exists "promotions_select_member" on public.promotions;
create policy "promotions_select_member" on public.promotions for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = promotions.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), promotions.tenant_id, 'promotions', 'view')
  );

drop policy if exists "promotions_insert_member" on public.promotions;
create policy "promotions_insert_member" on public.promotions for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = promotions.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), promotions.tenant_id, 'promotions', 'create')
  );

drop policy if exists "promotions_update_member" on public.promotions;
create policy "promotions_update_member" on public.promotions for update
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = promotions.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), promotions.tenant_id, 'promotions', 'update')
  );

drop policy if exists "promotions_delete_member" on public.promotions;
create policy "promotions_delete_member" on public.promotions for delete
  to authenticated using (
    (exists (select 1 from public.tenant_members tm where tm.tenant_id = promotions.tenant_id and tm.user_id = auth.uid())
     or public.is_super_admin(auth.uid()))
    and public.can_on_tenant(auth.uid(), promotions.tenant_id, 'promotions', 'delete')
  );
