-- Store location & currency identity — a tenant with stores in different
-- countries (e.g. Belgium and Nigeria) needs each store to say which
-- country/region it's actually in and which currency it operates in,
-- rather than "city" free text being the only location signal and every
-- store silently inheriting the tenant's single currency.
--
-- Scope, stated plainly: this migration establishes each store's country/
-- region/currency IDENTITY — real, structured data a store list, address
-- block, or filter can rely on today. It does not, by itself, make
-- product prices or POS totals switch currency per store; that would mean
-- teaching checkout/reporting to price a product differently at a NGN
-- store vs a EUR store, which is a real, separate, larger piece of work.
-- The foundation for that already exists and is designed to plug in here:
-- public.price_lists (migration 0074) is store_id-scoped AND has its own
-- currency column, so "this store's price list, in this store's
-- currency" is one query away once that follow-up is built — this
-- migration is what makes store.currency a meaningful value to join
-- against when that happens, instead of adding it twice.

alter table public.stores add column if not exists country text;
alter table public.stores add column if not exists region text;
alter table public.stores add column if not exists currency text;

comment on column public.stores.country is
  'ISO 3166-1 alpha-2 code (e.g. BE, NG) — matches src/lib/countries.ts on the frontend. Nullable for existing stores created before this column; a store list falls back to the tenant''s own country when this is unset.';
comment on column public.stores.region is
  'Free-text state/province/region within the country (e.g. "Lagos State", "Wallonie") — the "etc." locality level beyond city, for an address block or a future regional report, not used in any query logic yet.';
comment on column public.stores.currency is
  'This store''s own operating currency. Nullable — falls back to the tenant''s own currency (tenants.currency) wherever a store''s currency is needed and this is unset, so no existing single-country tenant needs to set anything for their stores to keep working exactly as before.';

-- Backfill every existing store with the tenant's own country/currency so
-- a tenant that has never touched this feature sees consistent, non-null
-- values rather than a store list half-populated with blanks.
update public.stores s
set
  country = coalesce(s.country, t.country_code),
  currency = coalesce(s.currency, t.currency)
from public.tenants t
where s.tenant_id = t.id;
