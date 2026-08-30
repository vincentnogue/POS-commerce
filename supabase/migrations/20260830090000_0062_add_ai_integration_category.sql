-- Add a real "AI" category to the marketplace, with an actual connectable
-- integration in it (not a placeholder). Follows the exact same pattern as
-- every other real provider in this table (e.g. PayUnit, migration 0035):
-- a genuine catalog row with a real auth_schema, so the existing generic
-- IntegrationCredentialForm renders a working "Connect" flow that stores
-- the tenant's own API key for later use — the same mechanism every other
-- integration in this marketplace already uses.
--
-- Named as our own branded feature ("LiAfrik AI Insights") rather than a
-- specific third-party AI vendor's name/logo — this avoids any trademark
-- question while still being honest about what it does: the tenant
-- connects their own OpenAI-compatible API key, and POS Flow uses it for
-- product description generation, sales insight summaries, and a customer
-- support chat draft assistant.
INSERT INTO public.integration_providers (
  provider_key,
  provider_name,
  description,
  category,
  subcategory,
  logo_url,
  documentation_url,
  auth_type,
  auth_schema,
  capabilities,
  minimum_plan,
  is_active,
  is_featured,
  webhook_support,
  created_at
) VALUES (
  'liafrik_ai_insights',
  'LiAfrik AI Insights',
  'Connect your own OpenAI-compatible API key to generate product descriptions, weekly sales summaries, and draft replies for customer support — powered by your data, using your own API key.',
  'ai',
  'automation',
  '/logos/partners/ai-insights.svg',
  'https://docs.posflow.io/integrations/ai-insights',
  'api_key',
  '{
    "type": "object",
    "properties": {
      "api_key": {
        "type": "string",
        "title": "API Key",
        "description": "Your OpenAI-compatible API key (kept encrypted, never shared)"
      },
      "model": {
        "type": "string",
        "title": "Model",
        "description": "Model identifier, e.g. gpt-4o-mini",
        "default": "gpt-4o-mini"
      }
    },
    "required": ["api_key"]
  }'::jsonb,
  ARRAY['product_descriptions', 'sales_insights', 'customer_chat_drafts'],
  'pro',
  true,
  true,
  false,
  now()
) ON CONFLICT (provider_key) DO NOTHING;
