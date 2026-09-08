-- New pricing: Starter stays $9, Pro $19 -> $29, Premium $49 -> $69,
-- Entreprise $119 -> $189 (monthly). Annual = 10x monthly (2 months
-- free), matching the real Paddle catalog prices already created:
-- Starter $90/yr, Pro $290/yr, Premium $690/yr, Entreprise $1,890/yr.
--
-- This is the authoritative source every checkout function (Stripe,
-- Flutterwave, Paystack, PayUnit, Paddle) reads price_usd from — updating
-- it here is what actually changes what customers are charged, not just
-- the marketing copy in plans.ts.

update public.plans set price_usd = 29 where code = 'pro';
update public.plans set price_usd = 69 where code = 'premium';
update public.plans set price_usd = 189 where code = 'entreprise';
-- starter unchanged (9 -> 9)
