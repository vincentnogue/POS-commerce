-- The merchant has now supplied PayUnit's actual logo (previous attempts
-- in this session mistakenly assigned it Libooks' icon, then reverted to
-- an external URL). Self-host the real asset like every other partner.
update public.integration_providers set logo_url = '/logos/partners/payunit.png' where provider_key = 'payunit';
