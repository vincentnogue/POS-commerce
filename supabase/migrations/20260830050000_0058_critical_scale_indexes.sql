-- Multi-tenant isolation & scale audit finding.
--
-- Every RLS policy in this app (see migration 0001 onward) scopes access
-- through a subquery against tenant_members, and almost every list/detail
-- screen filters by tenant_id or by a parent line-item's foreign key.
-- Auditing the schema turned up only 3 indexes in the entire initial
-- schema beyond primary keys and one unique constraint. Two findings are
-- severe enough to matter at real scale ("millions of users"):
--
-- 1. tenant_members has a UNIQUE (tenant_id, user_id) constraint, which
--    only helps queries that filter on tenant_id (leading column) or on
--    both columns together. But src/lib/auth.tsx's loadProfile() — run on
--    every single login and auth-state change, for every user — queries
--    `tenant_members WHERE user_id = ?` with NO tenant_id filter. Without
--    an index on user_id, that is a full sequential scan of the whole
--    tenant_members table, for every session, for every user, forever.
--    This is the single most-executed query in the app.
--
-- 2. Foreign keys are NOT automatically indexed in Postgres. sale_items,
--    invoice_items, purchase_items, quote_items and delivery_items are
--    queried by their parent id (sale_id, invoice_id, ...) every time
--    anyone opens a receipt, invoice, purchase order, quote or delivery —
--    with no index, each of those looks up its lines with a sequential
--    scan of the ENTIRE line-items table across every tenant.
--
-- All of the below are CREATE INDEX IF NOT EXISTS: purely additive, no
-- behavior change, safe to run on a live database (CONCURRENTLY is not
-- used because Supabase migrations run inside a transaction, where
-- CONCURRENTLY is not permitted — acceptable here given table sizes at
-- this stage; can be revisited with CONCURRENTLY run manually outside a
-- migration transaction once tables are large enough for lock time to
-- matter).

-- (1) The most critical one: every login/session load.
create index if not exists tenant_members_user_idx on public.tenant_members (user_id);

-- (2) Line items looked up by their parent document.
create index if not exists sale_items_sale_idx on public.sale_items (sale_id);
create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index if not exists purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id);
create index if not exists delivery_items_delivery_idx on public.delivery_items (delivery_id);

-- (3) High-traffic tables filtered by tenant_id on every list view, with
-- no index at all covering that column.
create index if not exists products_tenant_idx on public.products (tenant_id);
create index if not exists customers_tenant_idx on public.customers (tenant_id);
create index if not exists inventory_tenant_idx on public.inventory (tenant_id);
create index if not exists stock_movements_tenant_idx on public.stock_movements (tenant_id, created_at desc);
create index if not exists expenses_tenant_idx on public.expenses (tenant_id, created_at desc);
create index if not exists suppliers_tenant_idx on public.suppliers (tenant_id);
create index if not exists quotes_tenant_idx on public.quotes (tenant_id, created_at desc);
create index if not exists purchases_tenant_idx on public.purchases (tenant_id, created_at desc);
create index if not exists deliveries_tenant_idx on public.deliveries (tenant_id, created_at desc);
create index if not exists stores_tenant_idx on public.stores (tenant_id);

-- (4) Common foreign-key lookups elsewhere in the schema.
create index if not exists products_category_idx on public.products (category_id);
create index if not exists sales_customer_idx on public.sales (customer_id);
create index if not exists invoices_customer_idx on public.invoices (customer_id);

-- (5) Notifications: polled/read by user_id on every session, same
-- pattern as finding (1).
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- (6) audit_log and integration_connections: read by tenant admins and by
-- the marketplace on every visit.
create index if not exists audit_log_tenant_idx on public.audit_log (tenant_id, created_at desc);
create index if not exists integration_connections_tenant_idx on public.integration_connections (tenant_id);
