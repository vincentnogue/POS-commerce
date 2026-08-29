-- X-Report: a printable snapshot of the currently open day session
-- (sales so far, payment breakdown, staff present) that does NOT close
-- the day — unlike the Z-Report, which is the existing close_day_session
-- (see migration 0045). The admin controls how many times per day it can
-- be printed; 0 means unlimited. Purely additive.

alter table public.tenants
  add column if not exists max_x_reports_per_day integer not null default 0;

alter table public.day_sessions
  add column if not exists x_report_count integer not null default 0;

create or replace function public.record_x_report_print(
  p_session_id uuid,
  p_user_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_member_id uuid;
  v_limit integer;
  v_new_count integer;
begin
  select * into v_session from public.day_sessions where id = p_session_id for update;
  if v_session is null then
    raise exception 'Journée introuvable.';
  end if;
  if v_session.status <> 'open' then
    raise exception 'Cette journée est déjà clôturée.';
  end if;

  select id into v_member_id from public.tenant_members where user_id = p_user_id and tenant_id = v_session.tenant_id;
  if v_member_id is null then
    raise exception 'Non autorisé.';
  end if;

  select max_x_reports_per_day into v_limit from public.tenants where id = v_session.tenant_id;
  v_limit := coalesce(v_limit, 0);

  if v_limit > 0 and v_session.x_report_count >= v_limit then
    raise exception 'Nombre maximum d''impressions du X-Report atteint pour aujourd''hui (%). Contactez votre administrateur.', v_limit;
  end if;

  update public.day_sessions set x_report_count = x_report_count + 1 where id = p_session_id
  returning x_report_count into v_new_count;

  return v_new_count;
end;
$$;

grant execute on function public.record_x_report_print to authenticated;

comment on function public.record_x_report_print is
  'Increments and enforces the per-day X-Report print limit set by the admin (tenants.max_x_reports_per_day, 0 = unlimited). The Z-Report is not print-limited: it is the close_day_session() call itself, printed once at close.';
