-- Correction: migrations 0054 and 0056 (this session) mistakenly assigned
-- the "money bag with circular exchange arrows" asset to PayUnit. The
-- merchant has clarified that icon is actually for Libooks (accounting) —
-- and indeed migration "0054_more_self_hosted_partner_logos" (concurrent
-- session) had already correctly self-hosted that exact same icon at
-- /logos/partners/libooks.png. The mislabeled /logos/partners/payunit.png
-- file has been removed from the repo.
--
-- PayUnit has no merchant-supplied asset, so its logo_url reverts to the
-- real, verified URL from their own site (as fixed in migration 0055,
-- which this session's 0056 had unintentionally overridden).

update public.integration_providers
  set logo_url = 'https://web.payunit.net/_next/image?url=%2Fimages%2Flogo%20payunit.png&w=384&q=75'
  where provider_key = 'payunit';

update public.integration_providers
  set logo_url = '/logos/partners/libooks.png'
  where provider_key = 'libooks';
