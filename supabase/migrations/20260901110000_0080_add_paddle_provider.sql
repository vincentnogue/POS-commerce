-- Adds Paddle as a real integration_providers entry. Paddle positions
-- itself specifically as "Subscriptions, Payments & Tax Compliance for
-- SaaS & Mobile Apps" — a merchant-of-record that handles global VAT/sales
-- tax automatically, which is exactly what a platform billing tenants
-- internationally (see the currency/tax pages just added) needs. Unlike
-- the other 12 payment providers already seeded (Stripe, PayPal, M-Pesa,
-- etc. — connectable by a tenant but not consumed anywhere, per the
-- marketplace audit), Paddle is wired to a real, working consumer from
-- the same commit that adds this row: it's now a 5th option on
-- SubscribePage (see paddle-checkout function + payment-providers-status),
-- billing the tenant for their own POS Flow subscription.
--
-- auth_type/auth_schema describe what a *tenant* would need if they
-- connected their own Paddle account from the Marketplace for their own
-- purposes (e.g. if they also sell their own SaaS product) — API Key for
-- server-side calls, Client-side Token for Paddle.js checkouts. This is
-- deliberately the same shape used by the working platform-level
-- credentials (PADDLE_API_KEY / PADDLE_CLIENT_TOKEN env vars), just scoped
-- per-tenant instead of platform-wide.
insert into public.integration_providers (
  provider_key, provider_name, description, logo_url, documentation_url,
  category, subcategory, auth_type, auth_schema, capabilities,
  minimum_plan, is_active, is_featured, webhook_support
) values (
  'paddle',
  'Paddle',
  'Subscriptions, payments, and global tax compliance (VAT/sales tax) as merchant of record',
  -- No logo_url: every other provider row here points at a real file
  -- already downloaded into public/logos/partners/, and inventing a path
  -- that doesn't exist would repeat the exact broken-asset bug just fixed
  -- on the landing page. The marketplace grid and detail page both
  -- already fall back to a generic icon when logo_url is null — add the
  -- real file to public/logos/partners/paddle.png and backfill this
  -- column whenever one is actually sourced.
  null,
  'https://developer.paddle.com',
  'payments', 'subscription_billing',
  'api_key_secret',
  '{"type":"object","properties":{"api_key":{"type":"string","title":"API Key"},"client_token":{"type":"string","title":"Client-side Token"}},"required":["api_key","client_token"]}'::jsonb,
  ARRAY['payments', 'subscriptions', 'tax_compliance', 'webhooks', 'refunds'],
  'basic', true, true, true
) on conflict (provider_key) do nothing;
