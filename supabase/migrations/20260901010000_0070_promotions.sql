-- D365-style promotions engine — MVP scope: cart-level discounts, either
-- automatic (matches silently when conditions are met) or coupon-code
-- gated, with an optional minimum purchase and an active date window.
--
-- Deliberately NOT in this first pass (kept simple and honest rather than
-- half-built): category/product-scoped promotions, multi-buy ("buy 2 get
-- 1"), and stacking-priority rules between multiple automatic promotions
-- (only the single best one is auto-applied — see POS wiring). These are
-- real, separate follow-up work, same as multi-currency and serial/lot
-- numbers.
--
-- No PL/pgSQL business logic here on purpose: unlike manual discounts
-- (which need a manager PIN check) or gift cards (which need atomic
-- balance mutation), promotion matching has no side effects and no
-- privileged step, so it's plain RLS-protected CRUD — the same pattern
-- already used for held_sales — with the actual matching computed in the
-- POS client from the tenant's active promotions.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  type text not null check (type in ('percent', 'fixed')),
  value numeric not null check (value > 0),
  requires_code boolean not null default false,
  code text,
  min_purchase numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.promotions is 'Cart-level promotions (D365-style): automatic or coupon-code discounts, matched client-side in POS from this tenant''s active rows.';

alter table public.promotions enable row level security;

drop policy if exists promotions_tenant_access on public.promotions;
create policy promotions_tenant_access on public.promotions
  for all using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create index if not exists promotions_tenant_active_idx on public.promotions(tenant_id, is_active);

-- A code, when set, must be unique per tenant — but many rows have no
-- code at all (automatic promotions), so this has to be a partial index
-- rather than a table-level unique constraint.
create unique index if not exists promotions_tenant_code_idx on public.promotions(tenant_id, upper(code)) where (code is not null);
