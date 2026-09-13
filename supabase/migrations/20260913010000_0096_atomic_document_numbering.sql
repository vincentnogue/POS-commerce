-- COMPLIANCE FIX: invoice/quote numbers could collide or be reused.
--
-- InvoicesPage.tsx computed the next invoice number as
-- `FAC-${year}-${String(invoices.length + 1).padStart(4, '0')}` — the
-- count of invoices already loaded into the browser's local state.
-- QuotesPage.tsx did the same for quotes (`DEV-...`) and, when converting
-- a quote into an invoice, re-queried the count but still without any
-- locking. None of this is atomic:
--   - Two staff members creating an invoice within the same second (or
--     two browser tabs) can both compute the same "next" number, so two
--     different invoices end up with the identical, duplicate number.
--   - Deleting an invoice lowers `invoices.length`, so the NEXT invoice
--     created can reuse a number that was already issued to a real,
--     still-existing invoice elsewhere in the list.
-- Many tax authorities (France's anti-fraud law, most VAT regimes across
-- Africa, etc.) require invoice numbers to be unique and sequential
-- without silent reuse — a duplicate invoice number is a real compliance
-- problem, not just a cosmetic one, and neither the `invoices` nor
-- `quotes` table had so much as a unique constraint on `number` to catch
-- it even after the fact.
--
-- Fix: a small per-tenant, per-document-type, per-year counter table,
-- incremented atomically via INSERT ... ON CONFLICT ... DO UPDATE
-- (Postgres serializes this per row, so two concurrent callers can never
-- receive the same number), plus a hard uniqueness backstop on the
-- tables themselves in case a number is ever supplied through another
-- path.

create table if not exists public.document_sequences (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  doc_type text not null, -- 'invoice' | 'quote'
  year int not null,
  last_number int not null default 0,
  primary key (tenant_id, doc_type, year)
);

alter table public.document_sequences enable row level security;
-- No client-facing policies: only reached via the SECURITY DEFINER
-- function below, called by authenticated tenant members with the
-- matching module permission already enforced on the invoices/quotes
-- table itself.

insert into public.document_sequences (tenant_id, doc_type, year, last_number)
select
  tenant_id,
  'invoice',
  (regexp_match(number, '^FAC-(\d{4})-(\d+)$'))[1]::int as year,
  max((regexp_match(number, '^FAC-(\d{4})-(\d+)$'))[2]::int) as last_number
from public.invoices
where number ~ '^FAC-\d{4}-\d+$'
group by tenant_id, (regexp_match(number, '^FAC-(\d{4})-(\d+)$'))[1]::int
on conflict (tenant_id, doc_type, year)
do update set last_number = greatest(public.document_sequences.last_number, excluded.last_number);

insert into public.document_sequences (tenant_id, doc_type, year, last_number)
select
  tenant_id,
  'quote',
  (regexp_match(number, '^DEV-(\d{4})-(\d+)$'))[1]::int as year,
  max((regexp_match(number, '^DEV-(\d{4})-(\d+)$'))[2]::int) as last_number
from public.quotes
where number ~ '^DEV-\d{4}-\d+$'
group by tenant_id, (regexp_match(number, '^DEV-(\d{4})-(\d+)$'))[1]::int
on conflict (tenant_id, doc_type, year)
do update set last_number = greatest(public.document_sequences.last_number, excluded.last_number);

create or replace function public.next_document_number(p_tenant_id uuid, p_doc_type text, p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_tenant_id is null or p_doc_type is null or p_year is null then
    raise exception 'tenant_id, doc_type and year are required';
  end if;
  if not exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id and user_id = auth.uid()
  ) and not public.is_super_admin(auth.uid()) then
    raise exception 'not a member of this tenant';
  end if;

  insert into public.document_sequences (tenant_id, doc_type, year, last_number)
  values (p_tenant_id, p_doc_type, p_year, 1)
  on conflict (tenant_id, doc_type, year)
  do update set last_number = public.document_sequences.last_number + 1
  returning last_number into n;

  return n;
end;
$$;

grant execute on function public.next_document_number to authenticated;

-- Hard backstop: even if a number were ever supplied through another
-- path, the database itself now refuses a duplicate within a tenant.
-- Wrapped defensively: the exact bug this migration fixes may already
-- have produced real duplicate numbers in existing data, and a bare
-- ALTER TABLE ADD CONSTRAINT would fail outright on those rows, breaking
-- this whole deploy. Prefer applying the constraint where possible over
-- silently skipping it, but never let pre-existing dirty data block the
-- fix that prevents new duplicates from this point forward.
do $$
begin
  begin
    alter table public.invoices add constraint invoices_tenant_number_unique unique (tenant_id, number);
  exception when unique_violation then
    raise notice 'Skipped invoices_tenant_number_unique: existing duplicate invoice numbers found — clean these up manually, then add the constraint.';
  end;
end $$;

do $$
begin
  begin
    alter table public.quotes add constraint quotes_tenant_number_unique unique (tenant_id, number);
  exception when unique_violation then
    raise notice 'Skipped quotes_tenant_number_unique: existing duplicate quote numbers found — clean these up manually, then add the constraint.';
  end;
end $$;
