-- Void Transaction — the one POS operation explicitly called out as
-- missing (D365 has a dedicated "Void product"/void-transaction op; this
-- app had "Return" for after-the-fact customer returns, but nothing for
-- immediately reversing a mistaken sale). A void is not a return: it
-- fully un-does a sale's side effects rather than creating a new
-- return/refund record against it, and is restricted to the SAME
-- CALENDAR DAY the sale was made — a mistake from an hour ago should be
-- voided; a sale from three weeks ago that a customer wants to give back
-- should go through Returns instead, which doesn't retroactively rewrite
-- an already-closed day's reconciled totals. (This window is a
-- deliberate first-cut choice, not a hard product law — a tenant setting
-- to adjust it is reasonable future work, not attempted here.)
--
-- Reverses, when present: stock (mirrors the decrement trigger from
-- 0018, in reverse), serial/batch consumption (0076), gift-card
-- redemption (via the existing refund_to_gift_card, so it goes through
-- the same audited path a manual refund would), and loyalty points
-- EARNED on this sale (traceable via loyalty_transactions.sale_id).
--
-- Known, stated limitation: loyalty points REDEEMED for a discount on
-- this sale are not auto-reversed — redeem_loyalty_points (0067) never
-- recorded a sale_id on its ledger entry, so there is no reliable way to
-- trace which sale a given redemption belonged to. A voided sale where
-- the customer redeemed points therefore leaves those points spent; a
-- manager can manually credit them back via the customer's loyalty
-- history if needed. Flagging this rather than silently guessing.

create or replace function public.void_sale(
  p_tenant_id uuid,
  p_sale_id uuid,
  p_staff_code text,
  p_pin text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_approver_id uuid;
  v_sale record;
  v_item record;
  v_payment record;
  v_batch_link record;
  v_earned_points integer;
begin
  -- verify_manager_pin (0067) both authenticates AND authorizes: it
  -- requires a valid staff_code+PIN *for this specific tenant* with an
  -- admin/super_admin/manager role, so — unlike the functions fixed in
  -- migration 0078 — this one has no separate can_on_tenant check to add;
  -- the PIN check already is the tenant + authorization barrier.
  v_approver_id := public.verify_manager_pin(p_tenant_id, p_staff_code, p_pin);

  select * into v_sale from public.sales where id = p_sale_id and tenant_id = p_tenant_id for update;
  if v_sale is null then
    raise exception 'Vente introuvable.';
  end if;
  if v_sale.sale_status = 'cancelled' then
    raise exception 'Cette vente a déjà été annulée.';
  end if;
  if v_sale.sale_status <> 'completed' then
    raise exception 'Seule une vente terminée peut être annulée.';
  end if;
  if v_sale.sale_date::date <> (now() at time zone 'utc')::date then
    raise exception 'Cette vente ne peut plus être annulée directement (pas le même jour) — utilisez un retour à la place.';
  end if;

  -- 1. Stock: put every line's quantity back, mirroring
  --    trg_decrement_stock_on_sale (0018) in reverse.
  for v_item in select * from public.sale_items where sale_id = p_sale_id loop
    if v_item.product_id is not null then
      update public.inventory
        set quantity = quantity + v_item.quantity, updated_at = now()
        where tenant_id = p_tenant_id and product_id = v_item.product_id
          and store_id is not distinct from v_sale.store_id;
      if not found then
        insert into public.inventory (tenant_id, product_id, store_id, quantity)
        values (p_tenant_id, v_item.product_id, v_sale.store_id, v_item.quantity);
      end if;
      insert into public.stock_movements (tenant_id, product_id, store_id, movement_type, quantity, reason, user_id)
      values (p_tenant_id, v_item.product_id, v_sale.store_id, 'in', v_item.quantity,
              'Annulation vente ' || v_sale.reference || coalesce(' — ' || p_reason, ''),
              (select user_id from public.tenant_members where id = v_approver_id));
    end if;

    -- 2a. Serial-tracked units sold on this line go back to in_stock.
    update public.product_serials
      set status = 'in_stock', sale_id = null, sale_item_id = null, store_id = v_sale.store_id, updated_at = now()
      where sale_item_id = v_item.id and status = 'sold';

    -- 2b. Batch-tracked quantity consumed by this line goes back into
    --     each batch it was drawn from.
    for v_batch_link in select * from public.sale_item_batches where sale_item_id = v_item.id loop
      update public.product_batches
        set remaining_quantity = remaining_quantity + v_batch_link.quantity, updated_at = now()
        where id = v_batch_link.batch_id;
    end loop;
  end loop;

  -- 3. Gift card tenders: credit the card back via the same audited path
  --    a manual refund would use, rather than writing to gift_cards
  --    directly.
  for v_payment in select * from public.sale_payments where sale_id = p_sale_id and method = 'gift_card' loop
    if v_payment.reference is not null then
      perform public.refund_to_gift_card(p_tenant_id, v_payment.reference, v_payment.amount, p_sale_id);
    end if;
  end loop;

  -- 4. Loyalty points earned on this sale (see the limitation note above
  --    for redeemed points, which cannot be reliably traced back here).
  select coalesce(sum(points_delta), 0) into v_earned_points
    from public.loyalty_transactions where sale_id = p_sale_id and points_delta > 0;
  if v_earned_points > 0 and v_sale.customer_id is not null then
    update public.customers set loyalty_points = greatest(0, loyalty_points - v_earned_points) where id = v_sale.customer_id;
    insert into public.loyalty_transactions (tenant_id, customer_id, sale_id, points_delta, reason)
    values (p_tenant_id, v_sale.customer_id, p_sale_id, -v_earned_points, 'Annulation vente ' || v_sale.reference);
  end if;

  -- 5. Finally, mark the sale itself cancelled. sale_status changing away
  --    from 'completed' does NOT retroactively fire the stock trigger
  --    (that trigger only runs on sale_items INSERT) — which is exactly
  --    why steps 1-4 above exist rather than relying on it.
  update public.sales set sale_status = 'cancelled', updated_at = now() where id = p_sale_id;

  return jsonb_build_object('id', p_sale_id, 'reference', v_sale.reference, 'status', 'cancelled');
end;
$$;

grant execute on function public.void_sale to authenticated;

-- Security fix, found in the same audit pass that led to this feature:
-- process_sale_return (0049) trusted its p_user_id PARAMETER for both
-- authorization (looking up tenant_members by it) and attribution
-- (processed_by, stock_movements.user_id) without ever checking it
-- against auth.uid() — the actual authenticated caller. Since the
-- function is SECURITY DEFINER and GRANTed to authenticated, any signed-
-- in user who knew (or could enumerate) a valid (user_id, tenant_id) pair
-- for a DIFFERENT tenant's staff member could process a return "as" that
-- person: crediting arbitrary store_credit, restocking arbitrary
-- inventory, and poisoning that tenant's return audit trail with a
-- return attributed to someone who never touched it. The app's own
-- frontend has always sent p_user_id: user.id (the real caller), so this
-- fix changes nothing for a legitimate call — it only closes the ability
-- to lie about who's calling.
create or replace function public.process_sale_return(
  p_tenant_id uuid,
  p_sale_id uuid,
  p_items jsonb,
  p_refund_method text,
  p_kind text,
  p_reason text,
  p_customer_id uuid,
  p_user_id uuid,
  p_staff_code text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_sale record;
  v_settings jsonb;
  v_return_id uuid;
  v_item jsonb;
  v_qty numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_already_returned numeric;
  v_original_qty numeric;
  v_refund_total numeric := 0;
  v_session_id uuid;
  v_ref text;
  v_actual_user_id uuid := auth.uid();
begin
  select id into v_member_id from public.tenant_members where user_id = v_actual_user_id and tenant_id = p_tenant_id;
  if v_member_id is null then
    raise exception 'Non autorisé.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id and tenant_id = p_tenant_id;
  if v_sale is null then
    raise exception 'Vente introuvable.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Aucun article sélectionné pour le retour.';
  end if;

  if p_kind not in ('return', 'exchange') then
    raise exception 'Type de retour invalide.';
  end if;

  select return_settings into v_settings from public.tenants where id = p_tenant_id;
  v_settings := coalesce(v_settings, '{"allow_cash":true,"allow_card":true,"allow_store_credit":true,"allow_exchange":true}'::jsonb);

  if p_refund_method = 'store_credit' and coalesce((v_settings->>'allow_store_credit')::boolean, true) is not true then
    raise exception 'Le remboursement en avoir client n''est pas autorisé pour ce compte.';
  end if;
  if p_refund_method in ('cash') and coalesce((v_settings->>'allow_cash')::boolean, true) is not true then
    raise exception 'Le remboursement en espèces n''est pas autorisé pour ce compte.';
  end if;
  if p_refund_method in ('card', 'mobile_money') and coalesce((v_settings->>'allow_card')::boolean, true) is not true then
    raise exception 'Le remboursement par carte / mobile money n''est pas autorisé pour ce compte.';
  end if;
  if p_kind = 'exchange' and coalesce((v_settings->>'allow_exchange')::boolean, true) is not true then
    raise exception 'Les échanges ne sont pas autorisés pour ce compte.';
  end if;
  if p_refund_method = 'store_credit' and p_customer_id is null then
    raise exception 'Un client doit être sélectionné pour émettre un avoir.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantité invalide.';
    end if;

    if v_item->>'sale_item_id' is not null then
      select quantity into v_original_qty from public.sale_items where id = (v_item->>'sale_item_id')::uuid and sale_id = p_sale_id;
      if v_original_qty is null then
        raise exception 'Article de vente introuvable sur cette facture.';
      end if;
      select coalesce(sum(sri.quantity), 0) into v_already_returned
      from public.sale_return_items sri
      join public.sale_returns sr on sr.id = sri.return_id
      where sri.sale_item_id = (v_item->>'sale_item_id')::uuid and sr.original_sale_id = p_sale_id;

      if v_already_returned + v_qty > v_original_qty then
        raise exception 'Quantité à retourner supérieure à la quantité restante (%: déjà retourné %, vendu %).', v_item->>'name', v_already_returned, v_original_qty;
      end if;
    end if;

    v_line_total := v_qty * v_unit_price;
    v_refund_total := v_refund_total + v_line_total;
  end loop;

  select id into v_session_id from public.day_sessions
  where tenant_id = p_tenant_id
    and coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_sale.store_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and status = 'open';

  v_ref := 'RET-' || to_char(now(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.sale_returns (
    tenant_id, store_id, original_sale_id, customer_id, day_session_id, reference, kind, reason,
    refund_method, refund_amount, staff_code, processed_by
  ) values (
    p_tenant_id, v_sale.store_id, p_sale_id, p_customer_id, v_session_id, v_ref, p_kind, p_reason,
    p_refund_method, v_refund_total, nullif(trim(p_staff_code), ''), v_actual_user_id
  ) returning id into v_return_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);

    insert into public.sale_return_items (return_id, sale_item_id, product_id, name, quantity, unit_price, total)
    values (
      v_return_id,
      nullif(v_item->>'sale_item_id', '')::uuid,
      nullif(v_item->>'product_id', '')::uuid,
      v_item->>'name',
      v_qty,
      v_unit_price,
      v_qty * v_unit_price
    );

    if v_item->>'product_id' is not null then
      update public.inventory
      set quantity = quantity + v_qty, updated_at = now()
      where tenant_id = p_tenant_id
        and product_id = (v_item->>'product_id')::uuid
        and coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_sale.store_id, '00000000-0000-0000-0000-000000000000'::uuid);

      if not found then
        insert into public.inventory (tenant_id, product_id, store_id, quantity)
        values (p_tenant_id, (v_item->>'product_id')::uuid, v_sale.store_id, v_qty);
      end if;

      insert into public.stock_movements (tenant_id, product_id, store_id, movement_type, quantity, reason, user_id)
      values (p_tenant_id, (v_item->>'product_id')::uuid, v_sale.store_id, 'in', v_qty, concat('Retour vente ', v_sale.reference, coalesce(' — ' || p_reason, '')), v_actual_user_id);
    end if;
  end loop;

  if p_refund_method = 'store_credit' then
    update public.customers set store_credit_balance = store_credit_balance + v_refund_total where id = p_customer_id;
  end if;

  return v_return_id;
end;
$$;

-- Reports/Dashboard/Accounting/Administration coherence fix (found while
-- building void_sale): 'cancelled' as a sale_status has been referenced
-- in one client-side filter (POSPage's day report) since day one, but
-- nothing ever actually produced a cancelled sale until this migration —
-- so nobody had reason to notice that ReportsPage, DashboardPage,
-- AccountingPage, and AdministrationPage's per-employee totals all query
-- public.sales with no sale_status filter at all. The first voided sale
-- would have silently counted as real revenue everywhere except the one
-- place that already excluded it. See the matching frontend fix in this
-- same PR — this comment exists so the reasoning travels with the schema
-- change that exposed the gap, not just the UI patch.
