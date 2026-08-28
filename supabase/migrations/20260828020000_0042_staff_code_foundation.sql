-- Foundation for staff identity across POS-facing workflows (stock transfers,
-- day-open/day-close, receipt attribution, RMS...): a short, human-readable
-- Staff ID (e.g. "STF-001") per tenant_members row, instead of forcing staff
-- and other modules to reference a raw auth.users uuid.
--
-- Purely additive: new nullable-then-backfilled column, existing tables,
-- functions, RLS policies and app behavior are untouched. Nothing that
-- already works (login, transfers, sales) changes shape or semantics.

alter table public.tenant_members add column if not exists staff_code text;

-- Auto-assign the next sequential code within a tenant on insert, unless
-- one was explicitly provided (lets a future admin UI set a custom code).
create or replace function public.generate_staff_code() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  if new.staff_code is not null then
    return new;
  end if;

  select coalesce(max(substring(staff_code from '^STF-(\d+)$')::int), 0) + 1
  into v_next
  from public.tenant_members
  where tenant_id = new.tenant_id and staff_code ~ '^STF-\d+$';

  new.staff_code := 'STF-' || lpad(v_next::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists trg_generate_staff_code on public.tenant_members;
create trigger trg_generate_staff_code
before insert on public.tenant_members
for each row execute function public.generate_staff_code();

-- Backfill existing members deterministically (oldest first) so current
-- staff get a stable, ordered Staff ID retroactively.
do $$
declare
  v_tenant uuid;
  r record;
  v_counter int;
begin
  for v_tenant in select distinct tenant_id from public.tenant_members where staff_code is null loop
    v_counter := 0;
    for r in
      select id from public.tenant_members
      where tenant_id = v_tenant and staff_code is null
      order by created_at
    loop
      v_counter := v_counter + 1;
      update public.tenant_members
      set staff_code = 'STF-' || lpad(v_counter::text, 3, '0')
      where id = r.id;
    end loop;
  end loop;
end $$;

alter table public.tenant_members
  add constraint tenant_members_staff_code_unique unique (tenant_id, staff_code);

comment on column public.tenant_members.staff_code is
  'Human-readable per-tenant staff identifier (e.g. STF-001), used across POS-facing modules (transfers, day-open, receipts) so staff don''t need to reference the raw user id.';
