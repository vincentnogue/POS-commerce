-- Fix missing logos for POS Flow's own developer-tool marketplace entries.
--
-- BUG: 'posflow_webhooks' and 'posflow_api' were seeded with logo_url = NULL
-- (see migration 0032). Every other provider in the marketplace has a real
-- logo, so these two show a generic placeholder icon in the Marketplace and
-- Super Admin integration grids. Since these are POS Flow's own developer
-- tools (not a third-party provider), the correct real logo is the app's
-- own icon, already shipped at /logo-pos-icon.png.
UPDATE public.integration_providers
SET logo_url = '/logo-pos-icon.png'
WHERE provider_key IN ('posflow_webhooks', 'posflow_api')
  AND logo_url IS NULL;
