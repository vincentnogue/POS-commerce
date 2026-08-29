-- Continue migration 0053's pattern: replace remaining third-party CDN
-- logo_url values with the merchant-supplied brand assets, self-hosted
-- under /public/logos/partners/ (Stripe, Paystack, Mollie were still on
-- worldvectorlogo.com; Libooks had no real asset yet).
update public.integration_providers set logo_url = '/logos/partners/stripe.png' where provider_key = 'stripe';
update public.integration_providers set logo_url = '/logos/partners/paystack.png' where provider_key = 'paystack';
update public.integration_providers set logo_url = '/logos/partners/mollie.png' where provider_key = 'mollie';
update public.integration_providers set logo_url = '/logos/partners/libooks.png' where provider_key = 'libooks';
