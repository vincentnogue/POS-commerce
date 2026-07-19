/*
# Brand settings + Stripe subscriptions tables

## Summary
1. brand_settings — per-tenant branding (logo + cachet/stamp) for invoices, quotes, receipts.
2. subscriptions — Stripe subscription tracking linked to tenants and plans.

## Tables
1. brand_settings
   - tenant_id (FK tenants, unique, cascade)
   - logo_url (text) — company logo, appears on invoices/quotes/receipts
   - stamp_url (text) — official cachet/tampon, appears on invoices
   - primary_color (text) — accent color override
   - updated_at (timestamptz)

2. subscriptions
   - tenant_id (FK tenants, unique, cascade)
   - plan_id (FK plans)
   - stripe_customer_id (text)
   - stripe_subscription_id (text)
   - stripe_price_id (text)
   - status (text) — trialing, active, past_due, canceled, etc.
   - trial_ends_at (timestamptz) — end of 7-day trial
   - current_period_start (timestamptz)
   - current_period_end (timestamptz)
   - cancel_at_period_end (boolean)
   - billing_cycle (text) — monthly or annual
   - created_at, updated_at

## Security
- brand_settings: tenant members can read; admins can write.
- subscriptions: tenant members can read; super_admin can manage.
*/

create table if not exists public.brand_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  logo_url text,
  stamp_url text,
  primary_color text,
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  billing_cycle text not null default 'monthly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_settings enable row level security;
alter table public.subscriptions enable row level security;

-- brand_settings policies
drop policy if exists "brand_select_member" on public.brand_settings;
create policy "brand_select_member" on public.brand_settings for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = brand_settings.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "brand_insert_member" on public.brand_settings;
create policy "brand_insert_member" on public.brand_settings for insert
  to authenticated with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = brand_settings.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "brand_update_member" on public.brand_settings;
create policy "brand_update_member" on public.brand_settings for update
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = brand_settings.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  ) with check (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = brand_settings.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "brand_delete_member" on public.brand_settings;
create policy "brand_delete_member" on public.brand_settings for delete
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = brand_settings.tenant_id and tm.user_id = auth.uid() and tm.role in ('admin','super_admin'))
    or public.is_super_admin(auth.uid())
  );

-- subscriptions policies
drop policy if exists "sub_select_member" on public.subscriptions;
create policy "sub_select_member" on public.subscriptions for select
  to authenticated using (
    exists (select 1 from public.tenant_members tm where tm.tenant_id = subscriptions.tenant_id and tm.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "sub_insert_super" on public.subscriptions;
create policy "sub_insert_super" on public.subscriptions for insert
  to authenticated with check (public.is_super_admin(auth.uid()));

drop policy if exists "sub_update_super" on public.subscriptions;
create policy "sub_update_super" on public.subscriptions for update
  to authenticated using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));

drop policy if exists "sub_delete_super" on public.subscriptions;
create policy "sub_delete_super" on public.subscriptions for delete
  to authenticated using (public.is_super_admin(auth.uid()));