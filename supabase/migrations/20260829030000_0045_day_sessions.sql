-- "Débuter la journée" / "Clôturer la journée" (day-open / day-close), the
-- foundation X/Z-report and clean per-day reporting depend on: a single
-- open register session per store, an opening petty-cash float, and the
-- list of staff physically present when the day started — so every sale
-- in a day is unambiguously attached to one session instead of reports
-- mixing days together.
--
-- Purely additive: a new pair of tables, and one new nullable column on
-- `sales` (day_session_id). Existing sales, existing POS checkout, and
-- everything else keep working exactly as before whether or not a day
-- session is open — this migration only lays the foundation; the POS
-- checkout flow is wired to *use* it in the accompanying app change,
-- best-effort (a sale still completes if no day is open).

create table public.day_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_cash numeric not null default 0,
  closing_cash numeric,
  expected_cash numeric,
  cash_variance numeric,
  notes text,
  opened_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Only one open session per store at a time (store_id can be null for
-- single-store tenants, same nullable convention as public.inventory).
create unique index day_sessions_one_open_per_store
  on public.day_sessions (tenant_id, coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'open';

create index day_sessions_tenant_idx on public.day_sessions (tenant_id, opened_at desc);

alter table public.day_sessions enable row level security;

drop policy if exists "ds_select_member" on public.day_sessions;
create policy "ds_select_member" on public.day_sessions for select
  using (exists (select 1 from public.tenant_members tm where tm.tenant_id = day_sessions.tenant_id and tm.user_id = auth.uid()));

-- Staff physically present when the day was opened (by Staff ID), for
-- reporting and to answer "who was on shift" independently of who has
-- individually clocked into the POS.
create table public.day_session_staff (
  id uuid primary key default gen_random_uuid(),
  day_session_id uuid not null references public.day_sessions(id) on delete cascade,
  tenant_member_id uuid not null references public.tenant_members(id) on delete cascade,
  staff_code text,
  unique (day_session_id, tenant_member_id)
);

alter table public.day_session_staff enable row level security;

drop policy if exists "dss_select_member" on public.day_session_staff;
create policy "dss_select_member" on public.day_session_staff for select
  using (exists (
    select 1 from public.day_sessions ds
    join public.tenant_members tm on tm.tenant_id = ds.tenant_id
    where ds.id = day_session_staff.day_session_id and tm.user_id = auth.uid()
  ));

-- Link sales to the day session they were made under. Nullable and
-- backward compatible: every existing sale, and any sale made while no
-- day session is open, is completely unaffected.
alter table public.sales add column if not exists day_session_id uuid references public.day_sessions(id) on delete set null;
create index if not exists sales_day_session_idx on public.sales (day_session_id);

create or replace function public.open_day_session(
  p_tenant_id uuid,
  p_store_id uuid,
  p_opening_cash numeric,
  p_staff_member_ids uuid[],
  p_notes text,
  p_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_session_id uuid;
  v_staff_id uuid;
begin
  if p_opening_cash < 0 then
    raise exception 'Le fonds de caisse ne peut pas être négatif.';
  end if;

  select id into v_member_id from public.tenant_members where user_id = p_user_id and tenant_id = p_tenant_id;
  if v_member_id is null then
    raise exception 'Non autorisé.';
  end if;

  if exists (
    select 1 from public.day_sessions
    where tenant_id = p_tenant_id
      and coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_store_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and status = 'open'
  ) then
    raise exception 'Une journée est déjà ouverte pour ce magasin.';
  end if;

  insert into public.day_sessions (tenant_id, store_id, status, opening_cash, notes, opened_by)
  values (p_tenant_id, p_store_id, 'open', p_opening_cash, p_notes, p_user_id)
  returning id into v_session_id;

  -- Always record whoever opened it, even if they forgot to list themselves.
  insert into public.day_session_staff (day_session_id, tenant_member_id, staff_code)
  select v_session_id, v_member_id, staff_code from public.tenant_members where id = v_member_id
  on conflict do nothing;

  if p_staff_member_ids is not null then
    foreach v_staff_id in array p_staff_member_ids loop
      if not exists (select 1 from public.tenant_members where id = v_staff_id and tenant_id = p_tenant_id) then
        raise exception 'Membre du personnel introuvable dans ce système.';
      end if;
      insert into public.day_session_staff (day_session_id, tenant_member_id, staff_code)
      select v_session_id, v_staff_id, staff_code from public.tenant_members where id = v_staff_id
      on conflict do nothing;
    end loop;
  end if;

  return v_session_id;
end;
$$;

create or replace function public.close_day_session(
  p_session_id uuid,
  p_closing_cash numeric,
  p_notes text,
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_member_id uuid;
  v_cash_sales numeric;
begin
  select * into v_session from public.day_sessions where id = p_session_id for update;
  if v_session is null then raise exception 'Journée introuvable.'; end if;
  if v_session.status <> 'open' then raise exception 'Cette journée est déjà clôturée.'; end if;

  select id into v_member_id from public.tenant_members where user_id = p_user_id and tenant_id = v_session.tenant_id;
  if v_member_id is null then raise exception 'Non autorisé.'; end if;

  select coalesce(sum(total), 0) into v_cash_sales
  from public.sales
  where day_session_id = p_session_id and payment_method = 'cash' and sale_status <> 'cancelled';

  update public.day_sessions
  set status = 'closed',
      closing_cash = p_closing_cash,
      expected_cash = v_session.opening_cash + v_cash_sales,
      cash_variance = p_closing_cash - (v_session.opening_cash + v_cash_sales),
      notes = coalesce(p_notes, v_session.notes),
      closed_by = p_user_id,
      closed_at = now()
  where id = p_session_id;
end;
$$;

grant execute on function public.open_day_session to authenticated;
grant execute on function public.close_day_session to authenticated;

comment on table public.day_sessions is
  'One register/day session per store: opening petty cash float, staff present, and (at close) counted cash vs. expected cash. Sales made while a session is open reference it via sales.day_session_id, keeping per-day reporting from mixing days together. Closing a session is the Z-report moment: the day is locked and a new one can be opened.';
