-- Completes what migration 0063 intentionally left undone: openai_chatgpt
-- had no logo (the merchant-supplied file carried a Dreamstime.com stock-
-- preview watermark, correctly not self-hosted). Uses OpenAI's icon from
-- Simple Icons' public CDN instead (cdn.simpleicons.org, CC0-licensed icon
-- shapes, used only for identification — same treatment as every other
-- brand mark in this table).
update public.integration_providers
  set logo_url = 'https://cdn.simpleicons.org/openai/000000'
  where provider_key = 'openai_chatgpt';
