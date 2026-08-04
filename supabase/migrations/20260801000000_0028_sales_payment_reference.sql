-- Card and Mobile Money payments settled outside the app (on the
-- merchant's own card terminal / phone) need their approval/reference
-- code recorded, so it can appear on the printed receipt — the number a
-- customer would check against their bank statement or terminal slip.

alter table public.sales add column if not exists payment_reference text;
