-- Align max_products with the corrected pricing: Starter 100 -> 50,
-- Pro 1000 -> 500 (matches src/lib/plans.ts, the single source of truth
-- for what's advertised, now consistent with what's enforced by the
-- plan-limit triggers from migration 0017).

update public.plans set max_products = 50 where code = 'starter';
update public.plans set max_products = 500 where code = 'pro';
