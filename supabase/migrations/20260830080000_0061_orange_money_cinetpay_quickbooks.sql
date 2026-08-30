-- Three genuinely useful providers for African + international merchants
-- that did not exist in the catalog at all: Orange Money (one of the
-- largest mobile money networks in Francophone Africa), CinetPay (payment
-- aggregator widely used in Cameroon/Côte d'Ivoire/Senegal for card +
-- mobile money in one integration), and QuickBooks (accounting sync for
-- merchants who need their sales exported to an external ledger).
-- Also replaces PayUnit's external, unverified logo URL with a
-- self-hosted asset, same as migration 0053.

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'orange_money',
  'Orange Money',
  'Mobile money payments and payouts across Orange''s network in West and Central Africa (Côte d''Ivoire, Sénégal, Cameroun, Mali and more)',
  '/logos/partners/orange-money.png',
  'https://docs.posflow.io/integrations/orange-money',
  'payments', 'mobile_money',
  'api_key_secret',
  '{"type":"object","properties":{"merchant_key":{"type":"string","title":"Clé marchand"},"api_secret":{"type":"string","title":"Secret API"}},"required":["merchant_key","api_secret"]}'::jsonb,
  ARRAY['payments', 'payouts', 'webhooks', 'mobile_money'],
  'basic', true, true, true
) ON CONFLICT (provider_key) DO UPDATE SET logo_url = excluded.logo_url;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'cinetpay',
  'CinetPay',
  'Agrégateur de paiement (carte bancaire, Mobile Money, virement) très utilisé en Afrique francophone — une seule intégration pour tous les moyens de paiement locaux.',
  '/logos/partners/cinetpay.png',
  'https://docs.posflow.io/integrations/cinetpay',
  'payments', 'aggregator',
  'api_key_secret',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"Clé API"},"site_id":{"type":"string","title":"ID du site"}},"required":["api_key","site_id"]}'::jsonb,
  ARRAY['payments', 'refunds', 'webhooks', 'mobile_money'],
  'basic', true, true, true
) ON CONFLICT (provider_key) DO UPDATE SET logo_url = excluded.logo_url;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'quickbooks',
  'QuickBooks Online',
  'Export automatique des ventes, factures et dépenses vers QuickBooks pour votre comptabilité.',
  '/logos/partners/quickbooks.png',
  'https://docs.posflow.io/integrations/quickbooks',
  'accounting', 'ledger_sync',
  'oauth2',
  '{"type":"object","properties":{"client_id":{"type":"string","title":"Client ID"},"client_secret":{"type":"string","title":"Client Secret"},"realm_id":{"type":"string","title":"Realm ID (Company)"}},"required":["client_id","client_secret","realm_id"]}'::jsonb,
  ARRAY['accounting_sync', 'invoice_sync', 'expense_sync'],
  'pro', true, false, false
) ON CONFLICT (provider_key) DO UPDATE SET logo_url = excluded.logo_url;

update public.integration_providers set logo_url = '/logos/partners/payunit.png' where provider_key = 'payunit';
