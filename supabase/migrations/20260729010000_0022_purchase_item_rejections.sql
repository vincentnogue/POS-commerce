-- Support explicit rejection tracking when receiving a purchase order:
-- distinguishes "not yet received" from "received but rejected" (damaged,
-- wrong item, etc.), with a required comment explaining why. Rejected
-- quantities never enter inventory.

alter table public.purchase_items
  add column if not exists rejected_quantity numeric not null default 0,
  add column if not exists rejection_reason text;
