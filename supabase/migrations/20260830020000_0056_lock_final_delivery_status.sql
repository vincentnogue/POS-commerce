-- BUG: public.deliveries.status has no CHECK constraint and no trigger,
-- so any status could be set to any other status in any order — e.g. a
-- delivery already marked 'delivered' could be flipped back to 'pending',
-- or a 'cancelled' one moved to 'shipped' — via the UI (a plain <select>
-- in the deliveries table with every option always enabled, fixed in
-- src/pages/modules/DeliveriesPage.tsx in the same change as this
-- migration) and, more importantly, via any direct API call, since the
-- database itself enforced nothing.
--
-- This only locks the two states the app already treats as final
-- everywhere else — the delivery detail modal already hides its
-- "mark delivered" action once status is 'delivered' or 'cancelled'
-- (src/pages/modules/DeliveriesPage.tsx, completeDelivery button). It
-- does NOT restrict movement between pending / shipped /
-- partially_delivered, which the app's own item-quantity-driven logic
-- (updateItemDelivered) needs to move between freely as received
-- quantities are entered or corrected — restricting those would break
-- real existing behavior. Purely additive: no existing rows touched, no
-- columns/constraints removed, only a new trigger on future updates.

create or replace function public.enforce_delivery_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status in ('delivered', 'cancelled') then
    raise exception 'Delivery status % is final and cannot be changed', old.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_delivery_status_transition on public.deliveries;
create trigger trg_enforce_delivery_status_transition
  before update of status on public.deliveries
  for each row
  execute function public.enforce_delivery_status_transition();
