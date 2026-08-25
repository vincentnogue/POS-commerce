/*
# Seed Integration Providers

Populate the integration_providers catalog with available integrations.
These are the integrations POS Flow officially supports.

Categories:
- payments: Payment Service Providers (cards, mobile money, etc)
- liafrik: Liafrik ecosystem (Sellia, Libooks)
- logistics: Shipping & delivery
- communication: SMS, WhatsApp, email
- accounting: Financial software
- marketing: Marketing automation
- developers: Developer tools (webhooks, API)
*/

-- ============================================================================
-- PAYMENTS — Card Payments
-- ============================================================================

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'stripe',
  'Stripe Payments',
  'Accept card payments, manage subscriptions, handle refunds with Stripe',
  'https://cdn.worldvectorlogo.com/logos/stripe-2.svg',
  'https://docs.posflow.io/integrations/stripe',
  'payments', 'card_payments',
  'api_key_secret',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"Publishable Key"},"secret_key":{"type":"string","title":"Secret Key"}},"required":["api_key","secret_key"]}'::jsonb,
  ARRAY['payments', 'refunds', 'webhooks', 'subscriptions', 'charges'],
  'basic', true, true, true
) ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'paypal',
  'PayPal Payments',
  'Accept PayPal, debit card, and credit card payments',
  'https://cdn.worldvectorlogo.com/logos/paypal-2.svg',
  'https://docs.posflow.io/integrations/paypal',
  'payments', 'card_payments',
  'api_key_secret',
  '{"type":"object","properties":{"client_id":{"type":"string","title":"Client ID"},"secret":{"type":"string","title":"Secret"}},"required":["client_id","secret"]}'::jsonb,
  ARRAY['payments', 'refunds', 'webhooks', 'subscriptions'],
  'basic', true, true, true
) ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'adyen',
  'Adyen Payments',
  'Global payment processing with Adyen',
  'https://cdn.worldvectorlogo.com/logos/adyen.svg',
  'https://docs.posflow.io/integrations/adyen',
  'payments', 'card_payments',
  'api_key_secret',
  '{"type":"object","properties":{"merchant_account":{"type":"string","title":"Merchant Account"},"api_key":{"type":"string","title":"API Key"}},"required":["merchant_account","api_key"]}'::jsonb,
  ARRAY['payments', 'refunds', 'webhooks'],
  'pro', true, false, true
) ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'mollie',
  'Mollie Payments',
  'European payment processor supporting 30+ payment methods',
  'https://cdn.worldvectorlogo.com/logos/mollie.svg',
  'https://docs.posflow.io/integrations/mollie',
  'payments', 'card_payments',
  'api_key',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"API Key"}},"required":["api_key"]}'::jsonb,
  ARRAY['payments', 'refunds', 'webhooks', 'subscriptions'],
  'pro', true, false, true
) ON CONFLICT (provider_key) DO NOTHING;

-- ============================================================================
-- PAYMENTS — Mobile Money (Africa-focused)
-- ============================================================================

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'flutterwave',
  'Flutterwave',
  'Accept mobile money, cards, and bank transfers across Africa',
  'https://cdn.worldvectorlogo.com/logos/flutterwave.svg',
  'https://docs.posflow.io/integrations/flutterwave',
  'payments', 'mobile_money',
  'api_key_secret',
  '{"type":"object","properties":{"public_key":{"type":"string","title":"Public Key"},"secret_key":{"type":"string","title":"Secret Key"}},"required":["public_key","secret_key"]}'::jsonb,
  ARRAY['payments', 'refunds', 'webhooks', 'mobile_money'],
  'basic', true, true, true
) ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'paystack',
  'Paystack',
  'Accept payments across Africa with Paystack',
  'https://cdn.worldvectorlogo.com/logos/paystack-2.svg',
  'https://docs.posflow.io/integrations/paystack',
  'payments', 'mobile_money',
  'api_key',
  '{"type":"object","properties":{"secret_key":{"type":"string","title":"Secret Key"}},"required":["secret_key"]}'::jsonb,
  ARRAY['payments', 'refunds', 'webhooks', 'transfers'],
  'basic', true, true, true
) ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'mpesa',
  'M-Pesa (Safaricom)',
  'M-Pesa payments for Kenya and East Africa',
  'https://cdn.worldvectorlogo.com/logos/mpesa.svg',
  'https://docs.posflow.io/integrations/mpesa',
  'payments', 'mobile_money',
  'api_key_secret',
  '{"type":"object","properties":{"consumer_key":{"type":"string","title":"Consumer Key"},"consumer_secret":{"type":"string","title":"Consumer Secret"}},"required":["consumer_key","consumer_secret"]}'::jsonb,
  ARRAY['payments', 'webhooks', 'mobile_money'],
  'basic', true, true, true
) ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'wave',
  'Wave Money',
  'Mobile money in West Africa (Senegal, Mali, Côte d''Ivoire)',
  'https://cdn.worldvectorlogo.com/logos/wave-3.svg',
  'https://docs.posflow.io/integrations/wave',
  'payments', 'mobile_money',
  'api_key',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"API Key"}},"required":["api_key"]}'::jsonb,
  ARRAY['payments', 'webhooks', 'mobile_money'],
  'basic', true, true, true
) ON CONFLICT (provider_key) DO NOTHING;

-- ============================================================================
-- LIAFRIK ECOSYSTEM
-- ============================================================================

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'sellia',
  'Sellia E-commerce',
  'Sync products, inventory, and orders between Sellia and POS Flow',
  'https://sellia.liafrik.com/logo.svg',
  'https://docs.posflow.io/integrations/sellia',
  'liafrik', 'ecommerce',
  'api_key',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"API Key"}},"required":["api_key"]}'::jsonb,
  ARRAY['product_sync', 'inventory_sync', 'order_sync', 'bidirectional_sync'],
  'pro', true, true, true
) ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'libooks',
  'Libooks Accounting',
  'Sync financial data, sales, and reports to Libooks',
  'https://libooks.liafrik.com/logo.svg',
  'https://docs.posflow.io/integrations/libooks',
  'liafrik', 'accounting',
  'api_key',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"API Key"}},"required":["api_key"]}'::jsonb,
  ARRAY['accounting_sync', 'sales_sync', 'payment_sync', 'report_sync'],
  'pro', true, true, true
) ON CONFLICT (provider_key) DO NOTHING;

-- ============================================================================
-- LOGISTICS
-- ============================================================================

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'dhl',
  'DHL Shipping',
  'Create shipments, track deliveries, and manage logistics with DHL',
  'https://cdn.worldvectorlogo.com/logos/dhl-2.svg',
  'https://docs.posflow.io/integrations/dhl',
  'logistics', 'shipping',
  'api_key_secret',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"API Key"},"account_number":{"type":"string","title":"Account Number"}},"required":["api_key","account_number"]}'::jsonb,
  ARRAY['shipping_creation', 'tracking', 'label_generation', 'webhooks'],
  'premium', true, false, true
) ON CONFLICT (provider_key) DO NOTHING;

-- ============================================================================
-- COMMUNICATION
-- ============================================================================

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'twilio',
  'Twilio SMS',
  'Send SMS notifications for orders, deliveries, and alerts',
  'https://cdn.worldvectorlogo.com/logos/twilio.svg',
  'https://docs.posflow.io/integrations/twilio',
  'communication', 'sms',
  'api_key_secret',
  '{"type":"object","properties":{"account_sid":{"type":"string","title":"Account SID"},"auth_token":{"type":"string","title":"Auth Token"},"phone_number":{"type":"string","title":"From Phone Number"}},"required":["account_sid","auth_token","phone_number"]}'::jsonb,
  ARRAY['sms', 'notifications', 'webhooks'],
  'pro', true, false, true
) ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'whatsapp_business',
  'WhatsApp Business',
  'Send transactional messages and notifications via WhatsApp',
  'https://cdn.worldvectorlogo.com/logos/whatsapp-2.svg',
  'https://docs.posflow.io/integrations/whatsapp',
  'communication', 'messaging',
  'oauth2',
  '{"type":"object","properties":{"business_account_id":{"type":"string","title":"Business Account ID"},"phone_number_id":{"type":"string","title":"Phone Number ID"},"access_token":{"type":"string","title":"Access Token"}},"required":["business_account_id","phone_number_id","access_token"]}'::jsonb,
  ARRAY['messaging', 'notifications', 'webhooks'],
  'premium', true, false, true
) ON CONFLICT (provider_key) DO NOTHING;

-- ============================================================================
-- DEVELOPERS
-- ============================================================================

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'posflow_webhooks',
  'POS Flow Webhooks',
  'Send custom webhooks for events in POS Flow',
  NULL,
  'https://docs.posflow.io/developers/webhooks',
  'developers', 'webhooks',
  'webhook_only',
  '{"type":"object","properties":{"webhook_url":{"type":"string","title":"Webhook URL"}},"required":["webhook_url"]}'::jsonb,
  ARRAY['webhooks', 'custom_events'],
  'pro', true, false, false
) ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'posflow_api',
  'POS Flow Public API',
  'Build custom integrations using the POS Flow REST API',
  NULL,
  'https://docs.posflow.io/developers/api',
  'developers', 'api',
  'api_key',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"API Key"}},"required":["api_key"]}'::jsonb,
  ARRAY['api_access', 'webhooks', 'custom_integrations'],
  'premium', true, false, false
) ON CONFLICT (provider_key) DO NOTHING;
