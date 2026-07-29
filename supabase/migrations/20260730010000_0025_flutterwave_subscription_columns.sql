-- Support a second payment provider alongside Stripe: Flutterwave, the
-- natural fit for Mobile Money across Africa (Orange Money, MTN, etc.).
-- payment_provider distinguishes which one activated/renewed a given
-- subscription; the flutterwave_tx_ref mirrors what stripe_subscription_id
-- already does for Stripe (idempotency + support lookups).

alter table public.subscriptions
  add column if not exists payment_provider text not null default 'stripe',
  add column if not exists flutterwave_tx_ref text;
