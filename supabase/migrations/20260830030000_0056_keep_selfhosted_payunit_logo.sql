-- Coordination fix: migration 0054 (this session) self-hosted PayUnit's
-- logo at /logos/partners/payunit.png (a real asset the merchant
-- supplied). A concurrently-authored migration 0055
-- (fix_payunit_logo_and_spread_plan_tiers), timestamped after this one,
-- pointed payunit's logo_url back at an external web.payunit.net URL —
-- so on a fresh database, 0055 would run after 0054 and silently
-- overwrite the self-hosted asset. Re-apply the self-hosted logo last so
-- the real, locally-hosted asset wins regardless of migration order.
update public.integration_providers set logo_url = '/logos/partners/payunit.png' where provider_key = 'payunit';
