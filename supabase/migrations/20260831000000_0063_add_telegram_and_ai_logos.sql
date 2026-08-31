-- Two changes, following the exact patterns already established in this
-- table (see migrations 0053/0054 for self-hosted logos, 0057 for the AI
-- providers, 0060 for messaging providers):
--
-- 1. The merchant has now supplied real icon assets for the three AI
--    providers added in migration 0057 (which intentionally shipped with
--    logo_url = NULL — no asset was available at the time). Self-host
--    them the same way every other partner logo in this table already is.
--    Note: the merchant also supplied a ChatGPT icon, but that file is a
--    watermarked stock/editorial image (not a clean brand asset), so
--    openai_chatgpt.logo_url is intentionally left untouched here.
--
-- 2. Telegram appears in the App Marketplace mock but has never existed
--    as a real row in this table. Adds it as a genuine connectable
--    messaging provider (bot-token auth, same shape as the whatsapp row
--    from migration 0060) with the merchant-supplied logo self-hosted.

update public.integration_providers
  set logo_url = '/logos/partners/anthropic-claude.png'
  where provider_key = 'anthropic_claude';

update public.integration_providers
  set logo_url = '/logos/partners/google-gemini.png'
  where provider_key = 'google_gemini';

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'telegram',
  'Telegram',
  'Send order updates and receipts, and let customers reach your store, over a Telegram bot.',
  '/logos/partners/telegram.png',
  'https://core.telegram.org/bots',
  'communication', 'messaging',
  'api_key_secret',
  '{"type":"object","properties":{"bot_token":{"type":"string","title":"Telegram Bot Token"}},"required":["bot_token"]}'::jsonb,
  ARRAY['notifications', 'customer_support'],
  'starter', true, false, true
) ON CONFLICT (provider_key) DO NOTHING;
