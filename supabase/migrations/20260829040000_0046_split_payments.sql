-- Split payment: a single sale can be settled with more than one tender
-- (part cash, part card, part mobile money...), which today's schema can't
-- express — sales has exactly one payment_method/paid_amount pair.
--
-- Purely additive: sales.payment_method/paid_amount are untouched and keep
-- meaning exactly what they meant before for every existing sale and every
-- single-tender sale going forward (they're set to the lone tender's method
-- and amount, so nothing reading those two columns elsewhere breaks). A new
-- sale_payments table holds the itemized breakdown when there's more than
-- one tender; for a normal single-payment sale, app code can choose to also
-- write one matching sale_payments row for consistency, but nothing
-- requires it — a sale with zero sale_payments rows is exactly like every
-- sale made before this migration.

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  method text not null,
  amount numeric not null check (amount > 0),
  reference text,
  created_at timestamptz not null default now()
);

create index sale_payments_sale_idx on public.sale_payments (sale_id);
create index sale_payments_tenant_idx on public.sale_payments (tenant_id, created_at desc);

alter table public.sale_payments enable row level security;

create policy "sale_payments_select_member" on public.sale_payments for select
  to authenticated using (
    (exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_payments.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), s.tenant_id, 'pos', 'view'))
    or public.is_super_admin(auth.uid()))
  );

create policy "sale_payments_insert_member" on public.sale_payments for insert
  to authenticated with check (
    (exists (select 1 from public.tenant_members tm
      join public.sales s on s.id = sale_payments.sale_id
      where tm.tenant_id = s.tenant_id and tm.user_id = auth.uid()
      and public.can_on_tenant(auth.uid(), s.tenant_id, 'pos', 'create'))
    or public.is_super_admin(auth.uid()))
    and public.tenant_access_active((select s.tenant_id from public.sales s where s.id = sale_payments.sale_id))
  );

-- No update/delete policy: a settled tender line is a financial record,
-- corrected via a return/refund (its own module), not edited in place —
-- same posture as sale_items already has no delete-by-client policy for
-- completed sales.

comment on table public.sale_payments is
  'Itemized tender lines for a sale (part cash, part card, part mobile money, ...). sales.payment_method/paid_amount stay authoritative for single-tender sales; this table is the breakdown when a sale has more than one tender. sum(sale_payments.amount) for a sale should equal sales.paid_amount when populated.';
