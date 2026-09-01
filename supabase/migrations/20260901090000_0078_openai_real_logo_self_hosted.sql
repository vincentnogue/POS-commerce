-- Completes what migration 0066 left as a CDN fallback: openai_chatgpt was
-- using a generic icon from cdn.simpleicons.org because no clean brand
-- asset had been supplied yet (migration 0063 explicitly skipped it —
-- the merchant-supplied file at the time was a watermarked stock/
-- editorial image, not usable). The merchant has now supplied a real,
-- clean OpenAI mark. Self-host it the same way every other partner logo
-- in this table already is (see migrations 0053/0054/0063).
--
-- sellia's logo_url already points at the correct self-hosted asset
-- (/logos/partners/sellia.png, set in migration 0053) — nothing to do
-- there, this migration only touches openai_chatgpt.
update public.integration_providers
  set logo_url = '/logos/partners/openai.svg'
  where provider_key = 'openai_chatgpt';
