-- Two real problems with the integration marketplace catalog:
--
-- 1. PayUnit's logo_url ('https://payunit.net/logo.png', migration 0035)
--    points at the wrong domain entirely — PayUnit's real site is
--    web.payunit.net, not payunit.net — so it has always 404'd. Every
--    other provider was already fixed to a self-hosted asset in
--    migrations 0053/0054 except this one. We don't have a local asset
--    to self-host for PayUnit, so this points at their real, verified
--    logo URL (confirmed live on their own site footer) instead of a
--    dead one.
--
-- 2. minimum_plan values were stored as 'basic' (13 rows) even though no
--    plan with that code exists anywhere else in the app — the real
--    lowest tier is 'starter' (src/lib/plans.ts). Combined with the
--    isProviderLocked() bug fixed in src/pages/modules/MarketplacePage.tsx,
--    the plan tiering was effectively meaningless. On top of that, every
--    real plan tier through 'premium' had at least one integration
--    reserved for it, but 'entreprise' — the top, most expensive plan —
--    had NONE: an Entreprise customer got access to literally the same
--    integrations as a Premium one. This normalizes minimum_plan to the
--    app's real codes and gives Entreprise two integrations that
--    genuinely fit that tier: Adyen (the one processor here actually
--    positioned for large/global merchants, unlike the regional
--    mobile-money gateways) and the POS Flow public API (custom
--    integration access is a standard enterprise-tier feature).

update public.integration_providers set minimum_plan = 'starter' where minimum_plan = 'basic';

update public.integration_providers set logo_url = 'https://web.payunit.net/_next/image?url=%2Fimages%2Flogo%20payunit.png&w=384&q=75', minimum_plan = 'starter' where provider_key = 'payunit';

update public.integration_providers set minimum_plan = 'entreprise' where provider_key in ('adyen', 'posflow_api');
