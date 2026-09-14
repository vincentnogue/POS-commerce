-- LAUNCH-BLOCKING FIXES found during a deep end-to-end marketplace audit
-- (checking that connecting an app actually results in working
-- functionality, not just a saved credential row).

-- 1) mpesa's auth_schema only collected consumer_key/consumer_secret, but
--    mpesa-payments also requires short_code and passkey to build the STK
--    push password — a merchant filling in the connection form could
--    never actually complete a payment, regardless of the sandbox/prod
--    fix already made to the function itself.
update public.integration_providers
set auth_schema = '{"type":"object","properties":{"consumer_key":{"type":"string","title":"Consumer Key"},"consumer_secret":{"type":"string","title":"Consumer Secret"},"short_code":{"type":"string","title":"Business Short Code (Paybill/Till)"},"passkey":{"type":"string","title":"Lipa Na M-Pesa Passkey"}},"required":["consumer_key","consumer_secret","short_code","passkey"]}'::jsonb
where provider_key = 'mpesa';

-- 2) orange_money's auth_schema collected merchant_key/api_secret, but
--    orange-money-payments reads api_key/client_id/client_secret from
--    stored credentials — completely different field names, so nothing
--    typed into the form would ever reach the function correctly.
update public.integration_providers
set auth_schema = '{"type":"object","properties":{"api_key":{"type":"string","title":"Clé API (X-API-Key)"},"client_id":{"type":"string","title":"Client ID (OAuth)"},"client_secret":{"type":"string","title":"Client Secret (OAuth)"}},"required":["api_key","client_id","client_secret"]}'::jsonb
where provider_key = 'orange_money';

-- 3) paypal-payments reads `sandbox` from stored credentials and defaults
--    to true when absent — but the auth_schema never exposed a sandbox/
--    live field in the connection form at all, so a merchant had no way
--    to ever take PayPal out of sandbox mode. Adding the field with the
--    same safe default (test mode on) the code already assumes, matching
--    the pattern already used for PayUnit's test_mode field.
update public.integration_providers
set auth_schema = '{"type":"object","properties":{"client_id":{"type":"string","title":"Client ID"},"secret":{"type":"string","title":"Secret"},"sandbox":{"type":"boolean","title":"Mode test (sandbox)","default":true}},"required":["client_id","secret"]}'::jsonb
where provider_key = 'paypal';

-- 4) Marketplace apps with zero real backend behind them: connecting them
--    saves credentials and then nothing in the app ever uses them. Rather
--    than leave a working-looking "Connect" button that silently leads
--    nowhere for a paying customer, deactivate until real support ships.
--    (wave/adyen/mollie/mtn_momo/cinetpay/quickbooks: no edge function or
--    frontend caller anywhere. whatsapp_business: the real WhatsApp
--    capability in this app goes through the Twilio connection instead —
--    this separate provider entry is a redundant dead end. telegram: has
--    a credential test only, nothing ever sends a Telegram message.)
update public.integration_providers
set is_active = false
where provider_key in ('adyen', 'mollie', 'wave', 'mtn_momo', 'cinetpay', 'quickbooks', 'whatsapp_business', 'telegram');
