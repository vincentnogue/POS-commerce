-- Product request: the marketplace had no AI integrations at all. Adds
-- 3 real, currently-operating AI providers, each with a genuine free/
-- self-service tier a merchant can actually sign up for and use — same
-- "bring your own API key" pattern as every other credential-based
-- provider already in this table (e.g. twilio, mtn_momo): the merchant
-- supplies their own key, we don't proxy or resell access.
--
-- Real, verifiable documentation URLs (not hotlinked logo CDNs — those
-- have caused real bugs before in this table, see migrations 0053-0055).
-- logo_url is intentionally left NULL for now: we don't have a network
-- path in this environment to fetch Anthropic's / OpenAI's / Google's
-- own official brand assets, and hotlinking a third-party logo
-- aggregator for well-known trademarks isn't something to do without
-- checking their usage terms first. Falls back to the marketplace's
-- existing generic-icon placeholder (same as any other provider with no
-- logo yet) until a real, properly-sourced asset is added.
INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'anthropic_claude',
  'Claude (Anthropic)',
  'Generate product descriptions, draft customer replies, and summarize sales/reports data using Claude. Anthropic offers a free-tier API key to get started.',
  NULL,
  'https://docs.claude.com',
  'ai', 'assistant',
  'api_key_secret',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"Anthropic API Key"}},"required":["api_key"]}'::jsonb,
  ARRAY['text_generation', 'summarization', 'customer_support'],
  'starter', true, true, false
) ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'openai_chatgpt',
  'ChatGPT (OpenAI)',
  'Generate product descriptions, draft customer replies, and summarize sales/reports data using ChatGPT. OpenAI offers a free trial credit to get started.',
  NULL,
  'https://platform.openai.com/docs',
  'ai', 'assistant',
  'api_key_secret',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"OpenAI API Key"}},"required":["api_key"]}'::jsonb,
  ARRAY['text_generation', 'summarization', 'customer_support'],
  'starter', true, true, false
) ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) VALUES (
  'google_gemini',
  'Gemini (Google)',
  'Generate product descriptions, draft customer replies, and summarize sales/reports data using Gemini. Google AI Studio offers a genuinely free API tier.',
  NULL,
  'https://ai.google.dev/gemini-api/docs',
  'ai', 'assistant',
  'api_key_secret',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"Google AI API Key"}},"required":["api_key"]}'::jsonb,
  ARRAY['text_generation', 'summarization', 'customer_support'],
  'starter', true, false, false
) ON CONFLICT (provider_key) DO NOTHING;
