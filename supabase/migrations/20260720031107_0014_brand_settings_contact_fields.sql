/*
# Add contact fields to brand_settings

## Summary
Adds phone, address, and email columns to the brand_settings table so the
Settings page can store tenant contact info used on invoices, quotes, and
receipts (Partie 6 — Paramètres: coordonnées de facturation).

## Modified tables
- brand_settings: add phone (text, nullable), address (text, nullable),
  email (text, nullable)

## Notes
- All columns nullable so existing rows are not affected.
- No RLS change needed — existing policies already cover the new columns.
*/

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='brand_settings' and column_name='phone') then
    alter table public.brand_settings add column phone text;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='brand_settings' and column_name='address') then
    alter table public.brand_settings add column address text;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='brand_settings' and column_name='email') then
    alter table public.brand_settings add column email text;
  end if;
end $$;