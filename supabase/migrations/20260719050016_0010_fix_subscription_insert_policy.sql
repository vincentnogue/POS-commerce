/*
# Fix subscription insert policy for self-service trial creation

## Problem
The subscriptions INSERT policy was restricted to super_admin only. But during
onboarding, the tenant admin needs to create their own trial subscription row
so the trial period is tracked. Without this, the fallback (tenant.created_at + 7 days)
works, but an explicit subscription row is better for Stripe integration.

## Fix
- INSERT policy now allows authenticated users who are members of the tenant
  to create a subscription row for their own tenant (self-service trial).
- super_admin retains insert access.
- UPDATE remains super_admin-only (Stripe webhook updates the subscription
  after payment — the webhook uses the service role key which bypasses RLS).
*/

drop policy if exists "sub_insert_self_or_super" on public.subscriptions;
create policy "sub_insert_self_or_super" on public.subscriptions for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = subscriptions.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "sub_insert_super" on public.subscriptions;
-- old policy removed, replaced by sub_insert_self_or_super above