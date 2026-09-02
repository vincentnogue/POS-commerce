-- Commission computation — the missing PL/pgSQL half of migration 0075,
-- same posture as 0076 for serials/batches: the tables
-- (commission_rules, sale_commissions) existed but nothing populated
-- sale_commissions. Attribution rule decided here: whoever's tenant_member
-- id is passed in (the staff member who rang up the sale, i.e.
-- sales.user_id's matching tenant_members row) gets credited — the
-- simplest, least surprising default ("who processed the sale"), matching
-- how commission works in most retail POS systems. A tenant that wants
-- "whoever the customer belongs to" instead can extend this later; this
-- migration only wires the common case end-to-end.
--
-- Per sale_item, the applicable rule is the active rule scoped to that
-- item's category (public.products.category_id) if one exists, otherwise
-- the tenant's one active category_id IS NULL "default rate" rule if any.
-- No matching rule for an item = no commission on that line — never a
-- silent 100%-of-nothing default.

create or replace function public.compute_sale_commission(
  p_tenant_id uuid,
  p_sale_id uuid,
  p_member_id uuid
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric := 0;
  v_line record;
  v_rule record;
  v_line_commission numeric;
begin
  -- Never double-credit if this sale was already processed (e.g. a retry).
  if exists (select 1 from public.sale_commissions where sale_id = p_sale_id) then
    return 0;
  end if;

  for v_line in
    select si.id as sale_item_id, si.total as line_total, p.category_id
    from public.sale_items si
    join public.products p on p.id = si.product_id
    where si.sale_id = p_sale_id
  loop
    select * into v_rule from public.commission_rules
    where tenant_id = p_tenant_id and is_active = true and category_id = v_line.category_id
    limit 1;

    if not found then
      select * into v_rule from public.commission_rules
      where tenant_id = p_tenant_id and is_active = true and category_id is null
      limit 1;
    end if;

    if found then
      v_line_commission := round(v_line.line_total * v_rule.rate_percent / 100, 2);
      v_total := v_total + v_line_commission;
    end if;
  end loop;

  if v_total > 0 then
    -- commission_rule_id records whichever rule applied to the last
    -- matching line — sale_commissions is one aggregate row per sale here,
    -- not one row per line, so with several different rules on one sale
    -- this is an approximation of "the" rule, not a full per-line trail.
    -- Good enough for "how much commission did this sale generate", not
    -- meant to answer "which exact rule produced which cent".
    insert into public.sale_commissions (tenant_id, sale_id, member_id, commission_rule_id, amount)
    values (p_tenant_id, p_sale_id, p_member_id, v_rule.id, v_total);
  end if;

  return v_total;
end;
$$;

grant execute on function public.compute_sale_commission to authenticated;
