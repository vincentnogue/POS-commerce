-- Replace the placeholder worldvectorlogo.com CDN logos with the actual
-- brand assets the merchant supplied for these providers, hosted from our
-- own /public/logos/partners/ (same self-hosting pattern already used for
-- POS Flow's own developer-tool entries, migration 0048) — no dependency
-- on a third-party logo CDN that could change or disappear.
--
-- Also adds MTN Mobile Money as a real, distinct provider: it was only
-- ever mentioned in marketing copy (blog post), never an actual catalog
-- entry a tenant could connect to.

update public.integration_providers set logo_url = '/logos/partners/adyen.png' where provider_key = 'adyen';
update public.integration_providers set logo_url = '/logos/partners/paypal.png' where provider_key = 'paypal';
update public.integration_providers set logo_url = '/logos/partners/flutterwave.png' where provider_key = 'flutterwave';
update public.integration_providers set logo_url = '/logos/partners/dhl.png' where provider_key = 'dhl';
update public.integration_providers set logo_url = '/logos/partners/whatsapp.png' where provider_key = 'whatsapp_business';
update public.integration_providers set logo_url = '/logos/partners/wave.png' where provider_key = 'wave';
update public.integration_providers set logo_url = '/logos/partners/mpesa.png' where provider_key = 'mpesa';
update public.integration_providers set logo_url = '/logos/partners/sellia.png' where provider_key = 'sellia';

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'mtn_momo',
  'MTN Mobile Money',
  'Mobile money payments and payouts across MTN''s footprint in Africa (Ghana, Uganda, Côte d''Ivoire, Cameroon and more)',
  '/logos/partners/mtn-momo.png',
  'https://docs.posflow.io/integrations/mtn-momo',
  'payments', 'mobile_money',
  'api_key_secret',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"API Key"},"api_secret":{"type":"string","title":"API Secret"},"subscription_key":{"type":"string","title":"Subscription Key"}},"required":["api_key","api_secret","subscription_key"]}'::jsonb,
  ARRAY['payments', 'payouts', 'webhooks', 'mobile_money'],
  'basic', true, true, true
) ON CONFLICT (provider_key) DO UPDATE SET
  logo_url = excluded.logo_url,
  provider_name = excluded.provider_name,
  description = excluded.description;
