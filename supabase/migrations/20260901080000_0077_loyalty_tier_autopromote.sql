-- Loyalty tier auto-promotion — the missing automation half of migration
-- 0075 (which deliberately left loyalty_tiers as "the table exists, the
-- automation is a separate step"). Whenever a customer's loyalty_points
-- changes (via earn_loyalty_points, redeem_loyalty_points, a manual admin
-- edit, or anything else that writes that column), recompute which tier
-- they qualify for: the highest-min_points tier for that tenant whose
-- min_points is <= the customer's new balance.
--
-- Deliberately a BEFORE trigger on public.customers rather than a
-- separate job: it needs to run for every path that can change
-- loyalty_points (including ones added after this migration) without
-- each of them remembering to also update loyalty_tier_id. If a tenant
-- has no loyalty_tiers configured yet, loyalty_tier_id simply stays null
-- — purely additive, no behavior change until tiers are created.

create or replace function public.recompute_loyalty_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.loyalty_points is distinct from old.loyalty_points or old is null then
    select id into new.loyalty_tier_id
    from public.loyalty_tiers
    where tenant_id = new.tenant_id
      and min_points <= coalesce(new.loyalty_points, 0)
    order by min_points desc
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_recompute_loyalty_tier on public.customers;
create trigger customers_recompute_loyalty_tier
  before insert or update of loyalty_points on public.customers
  for each row execute function public.recompute_loyalty_tier();

-- Backfill: assign existing customers to whatever tier they already
-- qualify for, for tenants that add tiers retroactively.
update public.customers c
set loyalty_tier_id = (
  select lt.id from public.loyalty_tiers lt
  where lt.tenant_id = c.tenant_id and lt.min_points <= coalesce(c.loyalty_points, 0)
  order by lt.min_points desc
  limit 1
)
where exists (select 1 from public.loyalty_tiers lt2 where lt2.tenant_id = c.tenant_id);
