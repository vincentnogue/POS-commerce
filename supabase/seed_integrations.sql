-- Real Integration Providers with actual logo URLs

-- Payment Providers
INSERT INTO integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url, 
  category, subcategory, auth_type, capabilities, minimum_plan, is_featured, is_active
) VALUES
  ('stripe', 'Stripe', 'Accept payments worldwide with Stripe', 
   'https://cdn.worldvectorlogo.com/logos/stripe-2.svg', 
   'https://stripe.com/docs',
   'payments', 'credit_card', 'api_key', 
   ARRAY['accept_payments', 'subscriptions', 'payouts'],
   'starter', TRUE, TRUE),

  ('paypal', 'PayPal', 'Accept payments and manage transactions',
   'https://cdn.worldvectorlogo.com/logos/paypal-3.svg',
   'https://developer.paypal.com/docs',
   'payments', 'digital_wallet', 'oauth2',
   ARRAY['accept_payments', 'subscriptions', 'payouts'],
   'starter', TRUE, TRUE),

  ('flutterwave', 'Flutterwave', 'Accept payments in Africa',
   'https://media.licdn.com/dms/image/C4D0BAQGuAz8QCAbP7A/company-logo_200_200/0/1631019882245?e=2147483647&v=beta&t=XvN1tXq8bN8PdgE0U3fG0K0pqK0pqK0pqK0pqK0pqK0',
   'https://developer.flutterwave.com',
   'payments', 'mobile_money', 'api_key',
   ARRAY['accept_payments', 'multi_currency'],
   'starter', TRUE, TRUE),

  ('paystack', 'Paystack', 'Accept payments in West Africa',
   'https://cdn.worldvectorlogo.com/logos/paystack-2.svg',
   'https://paystack.com/docs',
   'payments', 'mobile_money', 'api_key',
   ARRAY['accept_payments', 'payouts'],
   'starter', TRUE, TRUE),

  ('mpesa', 'M-Pesa', 'Mobile money in East Africa',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Mpesa-logo.png/220px-Mpesa-logo.png',
   'https://developer.safaricom.co.ke',
   'payments', 'mobile_money', 'oauth2',
   ARRAY['accept_payments', 'ussd_payments'],
   'starter', TRUE, TRUE),

  ('orange_money', 'Orange Money', 'Accept payments in West Africa',
   'https://orangemoney.io/assets/logo.png',
   'https://orangemoney.io/documentation',
   'payments', 'mobile_money', 'api_key',
   ARRAY['accept_payments', 'ussd_payments'],
   'starter', TRUE, TRUE),

-- Logistics
  ('dhl', 'DHL Shipping', 'Worldwide shipping integration',
   'https://cdn.worldvectorlogo.com/logos/dhl-1.svg',
   'https://developer.dhl.com',
   'logistics', 'shipping', 'api_key',
   ARRAY['shipping_labels', 'tracking', 'rate_quotes'],
   'pro', FALSE, TRUE),

-- Accounting
  ('libooks', 'Libooks', 'Accounting synchronization',
   'https://libooks.io/logo.png',
   'https://libooks.io/api',
   'accounting', 'general_ledger', 'api_key',
   ARRAY['sync_transactions', 'general_ledger'],
   'pro', FALSE, TRUE),

-- E-Commerce
  ('sellia', 'Sellia', 'E-Commerce product sync',
   'https://sellia.io/logo.png',
   'https://sellia.io/api',
   'liafrik', 'ecommerce', 'api_key',
   ARRAY['sync_products', 'sync_inventory'],
   'pro', FALSE, TRUE),

-- Communication
  ('twilio', 'Twilio', 'SMS and WhatsApp notifications',
   'https://cdn.worldvectorlogo.com/logos/twilio-2.svg',
   'https://www.twilio.com/docs',
   'communication', 'messaging', 'api_key',
   ARRAY['sms_notifications', 'whatsapp_messages'],
   'pro', FALSE, TRUE);

-- PayUnit.net (Multi-currency)
INSERT INTO integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url, 
  category, subcategory, auth_type, capabilities, minimum_plan, is_featured, is_active
) VALUES
  ('payunit', 'PayUnit', 'Multi-currency payments gateway',
   'https://payunit.net/logo.svg',
   'https://payunit.net/api/docs',
   'payments', 'payment_gateway', 'api_key',
   ARRAY['accept_payments', 'multi_currency', '200_countries'],
   'starter', TRUE, TRUE);

-- Sync Real Logos with Integration Connections on user request
-- Note: Logos will be displayed in MarketplacePage.tsx from logo_url field
