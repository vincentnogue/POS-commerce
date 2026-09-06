-- BUG FIX: marketplace_plan_limits.plan_id was seeded with codes
-- ('starter', 'professional', 'enterprise', 'custom') that don't match
-- this app's real plan codes (public.plans.code = 'starter', 'pro',
-- 'premium', 'entreprise' — see migration 0005). Combined with
-- marketplace-access-check querying this table directly by
-- tenants.plan_id (a uuid, not a code — also fixed in that function
-- alongside this migration), the 'connect' action's integration-limit
-- check could never find a matching row for ANY real tenant, on ANY
-- plan — 'Plan limits not found' every time.
--
-- Renames the two that map 1:1 to a real code, and adds the 'premium'
-- tier that had no row at all (limits chosen consistent with the
-- existing ladder: pro=10 -> premium sits between pro and entreprise).
-- 'custom' is left as-is — not a real plan code in this app today, but
-- harmless to keep for a future custom/enterprise-negotiated tier.
update public.marketplace_plan_limits set plan_id = 'pro' where plan_id = 'professional';
update public.marketplace_plan_limits set plan_id = 'entreprise' where plan_id = 'enterprise';

insert into public.marketplace_plan_limits (plan_id, plan_name, max_integrations, allowed_categories, allows_custom_integration, allows_api_access, allows_webhook_test, allows_production_mode, rate_limit_per_minute)
values ('premium', 'Premium', 20, ARRAY['payments', 'shipping', 'accounting', 'ecommerce', 'notifications'], true, true, true, true, 750)
on conflict (plan_id) do nothing;
