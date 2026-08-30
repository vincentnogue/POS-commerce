-- Real Integration Providers with actual logo URLs

-- Payment Providers (Featured)
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

  ('square', 'Square', 'Payment processing and POS system',
   'https://cdn.worldvectorlogo.com/logos/square-2.svg',
   'https://developer.squareup.com/docs',
   'payments', 'payment_gateway', 'api_key',
   ARRAY['accept_payments', 'invoicing', 'point_of_sale'],
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

  ('payunit', 'PayUnit', 'Multi-currency payments gateway',
   'https://payunit.net/logo.svg',
   'https://payunit.net/api/docs',
   'payments', 'payment_gateway', 'api_key',
   ARRAY['accept_payments', 'multi_currency', '200_countries'],
   'starter', TRUE, TRUE),

  ('mollie', 'Mollie', 'Payment solutions for Europe',
   'https://www.mollie.com/images/favicons/favicon-96x96.png',
   'https://docs.mollie.com',
   'payments', 'payment_gateway', 'api_key',
   ARRAY['accept_payments', 'subscriptions'],
   'starter', TRUE, TRUE),

-- Logistics & Shipping
  ('dhl', 'DHL Shipping', 'Worldwide shipping integration',
   'https://cdn.worldvectorlogo.com/logos/dhl-1.svg',
   'https://developer.dhl.com',
   'logistics', 'shipping', 'api_key',
   ARRAY['shipping_labels', 'tracking', 'rate_quotes'],
   'pro', FALSE, TRUE),

  ('fedex', 'FedEx', 'International shipping and tracking',
   'https://cdn.worldvectorlogo.com/logos/fedex-2.svg',
   'https://developer.fedex.com',
   'logistics', 'shipping', 'api_key',
   ARRAY['shipping_labels', 'tracking', 'rate_quotes'],
   'pro', FALSE, TRUE),

  ('ups', 'UPS', 'Shipping and logistics management',
   'https://cdn.worldvectorlogo.com/logos/ups-2.svg',
   'https://www.ups.com/upsdeveloperkit',
   'logistics', 'shipping', 'oauth2',
   ARRAY['shipping_labels', 'tracking', 'rate_quotes'],
   'pro', FALSE, TRUE),

-- Accounting & Finance
  ('libooks', 'Libooks', 'Accounting synchronization',
   'https://libooks.io/logo.png',
   'https://libooks.io/api',
   'accounting', 'general_ledger', 'api_key',
   ARRAY['sync_transactions', 'general_ledger'],
   'pro', FALSE, TRUE),

  ('quickbooks', 'QuickBooks', 'Accounting and financial management',
   'https://cdn.worldvectorlogo.com/logos/quickbooks-2.svg',
   'https://developer.intuit.com',
   'accounting', 'accounting_software', 'oauth2',
   ARRAY['sync_transactions', 'invoicing', 'expense_tracking'],
   'pro', FALSE, TRUE),

  ('xero', 'Xero', 'Cloud accounting platform',
   'https://cdn.worldvectorlogo.com/logos/xero-1.svg',
   'https://developer.xero.com',
   'accounting', 'accounting_software', 'oauth2',
   ARRAY['sync_transactions', 'invoicing', 'reports'],
   'pro', FALSE, TRUE),

-- E-Commerce & Inventory
  ('sellia', 'Sellia', 'E-Commerce product sync',
   'https://sellia.io/logo.png',
   'https://sellia.io/api',
   'liafrik', 'ecommerce', 'api_key',
   ARRAY['sync_products', 'sync_inventory'],
   'pro', FALSE, TRUE),

  ('shopify', 'Shopify', 'E-commerce platform integration',
   'https://cdn.worldvectorlogo.com/logos/shopify-1.svg',
   'https://shopify.dev/api',
   'liafrik', 'ecommerce', 'oauth2',
   ARRAY['sync_products', 'sync_inventory', 'sync_orders'],
   'pro', FALSE, TRUE),

  ('woocommerce', 'WooCommerce', 'WordPress e-commerce plugin',
   'https://cdn.worldvectorlogo.com/logos/woocommerce.svg',
   'https://woocommerce.com/document/woocommerce-rest-api/',
   'liafrik', 'ecommerce', 'api_key',
   ARRAY['sync_products', 'sync_inventory', 'sync_orders'],
   'pro', FALSE, TRUE),

-- Communication & Marketing
  ('twilio', 'Twilio', 'SMS and WhatsApp notifications',
   'https://cdn.worldvectorlogo.com/logos/twilio-2.svg',
   'https://www.twilio.com/docs',
   'communication', 'messaging', 'api_key',
   ARRAY['sms_notifications', 'whatsapp_messages', 'voice_calls'],
   'pro', FALSE, TRUE),

  ('sendgrid', 'SendGrid', 'Email marketing and delivery',
   'https://cdn.worldvectorlogo.com/logos/sendgrid.svg',
   'https://sendgrid.com/docs',
   'communication', 'email', 'api_key',
   ARRAY['send_emails', 'email_templates', 'analytics'],
   'pro', FALSE, TRUE),

  ('mailchimp', 'Mailchimp', 'Email marketing and automation',
   'https://cdn.worldvectorlogo.com/logos/mailchimp.svg',
   'https://mailchimp.com/developer',
   'communication', 'marketing_automation', 'oauth2',
   ARRAY['email_campaigns', 'segmentation', 'analytics'],
   'pro', FALSE, TRUE),

  ('slack', 'Slack', 'Team communication and notifications',
   'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg',
   'https://api.slack.com',
   'communication', 'team_chat', 'oauth2',
   ARRAY['send_notifications', 'team_collaboration'],
   'pro', FALSE, TRUE),

-- Analytics & Insights
  ('google_analytics', 'Google Analytics', 'Website and app analytics',
   'https://cdn.worldvectorlogo.com/logos/google-analytics-1.svg',
   'https://developers.google.com/analytics',
   'analytics', 'web_analytics', 'oauth2',
   ARRAY['track_events', 'user_insights', 'conversion_tracking'],
   'pro', FALSE, TRUE),

  ('mixpanel', 'Mixpanel', 'Product analytics platform',
   'https://cdn.worldvectorlogo.com/logos/mixpanel-1.svg',
   'https://developer.mixpanel.com',
   'analytics', 'product_analytics', 'api_key',
   ARRAY['event_tracking', 'cohort_analysis', 'user_segmentation'],
   'pro', FALSE, TRUE),

-- AI & Automation
  ('openai', 'OpenAI', 'AI-powered chatbots and content generation',
   'https://cdn.worldvectorlogo.com/logos/openai-2.svg',
   'https://platform.openai.com/docs',
   'ai', 'language_model', 'api_key',
   ARRAY['chatbot', 'content_generation', 'smart_responses'],
   'premium', FALSE, TRUE),

  ('huggingface', 'Hugging Face', 'ML models and AI services',
   'https://huggingface.co/front/assets/huggingface_logo-noborder.svg',
   'https://huggingface.co/docs',
   'ai', 'ml_models', 'api_key',
   ARRAY['text_classification', 'sentiment_analysis'],
   'premium', FALSE, TRUE),

-- CRM & Customer Management
  ('salesforce', 'Salesforce', 'Customer relationship management',
   'https://cdn.worldvectorlogo.com/logos/salesforce-1.svg',
   'https://developer.salesforce.com',
   'crm', 'crm_system', 'oauth2',
   ARRAY['sync_contacts', 'manage_deals', 'customer_insights'],
   'premium', FALSE, TRUE),

  ('hubspot', 'HubSpot', 'CRM platform and marketing automation',
   'https://cdn.worldvectorlogo.com/logos/hubspot-1.svg',
   'https://developers.hubspot.com',
   'crm', 'crm_system', 'oauth2',
   ARRAY['sync_contacts', 'email_tracking', 'sales_pipeline'],
   'pro', FALSE, TRUE),

-- Developers & Tools
  ('github', 'GitHub', 'Source code management and CI/CD',
   'https://cdn.worldvectorlogo.com/logos/github-icon-1.svg',
   'https://docs.github.com/en/developers',
   'developers', 'version_control', 'oauth2',
   ARRAY['code_deployment', 'automation'],
   'premium', FALSE, TRUE),

  ('sentry', 'Sentry', 'Error tracking and monitoring',
   'https://cdn.worldvectorlogo.com/logos/sentry-2.svg',
   'https://docs.sentry.io',
   'developers', 'monitoring', 'api_key',
   ARRAY['error_tracking', 'performance_monitoring'],
   'pro', FALSE, TRUE);
