-- The Super Admin module (SuperAdminPage) is gated server-side by the
-- super-admin-auth edge function, which requires BOTH:
--   1. the user's email to be present in platform_admins, AND
--   2. the user to have a tenant_members row with role = 'super_admin'.
-- These tables were referenced by the app code but had never actually
-- been created — this migration creates them and seeds the allowlist.

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  label text,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- No client-facing policies: this table is only ever read/written by
-- edge functions using the service role key, which bypasses RLS. Regular
-- authenticated/anon roles get no access at all, by design.

create table if not exists public.super_admin_access_log (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  actor_user_id uuid,
  authorized boolean not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.super_admin_access_log enable row level security;

insert into public.platform_admins (email, label)
select v.email, v.label
from (values
  ('vincentnogue@yahoo.com', 'Fondateur'),
  ('vincentnogue2@gmail.com', 'Fondateur'),
  ('webdxb1@gmail.com', 'Admin plateforme'),
  ('liyahjoha@gmail.com', 'Admin plateforme')
) as v(email, label)
where not exists (
  select 1 from public.platform_admins pa where lower(pa.email) = lower(v.email)
);
