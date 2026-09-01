-- Time clock: manager correction + audit trail.
--
-- 0069 gave staff clock-in/out and let a manager delete an entry, but the
-- spec explicitly asks for "gestion des oublis de clock-out" (a forgotten
-- clock-out) and "correction contrôlée par un responsable" with a
-- "historique des modifications" — delete alone can't do either: it
-- destroys the original entry instead of fixing it, and leaves no record
-- that a correction ever happened. This adds the missing edit path without
-- touching the existing columns, RLS policies, or the one-open-entry-per-
-- user constraint from 0069.

alter table public.time_clock_entries
  add column if not exists corrections jsonb not null default '[]'::jsonb;

comment on column public.time_clock_entries.corrections is
  'Audit trail of manual edits by a manager: [{at, by, field, old_value, new_value, reason}, ...]. Append-only from the app; the row''s clock_in/clock_out always reflect the latest corrected value, this column is purely historical.';

-- The existing time_clock_update RLS policy (0069) already restricts
-- updates to the entry's own owner or a tenant admin/manager/super_admin,
-- which is exactly the "contrôlée par un responsable" requirement for
-- editing someone else's entry — no policy change needed here, only the
-- new column for the app to append correction records into.
