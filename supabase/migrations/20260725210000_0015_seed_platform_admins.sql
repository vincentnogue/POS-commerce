-- Seed the platform_admins allowlist. Access to the Super Admin module
-- (SuperAdminPage) requires BOTH: the user's email to be in this table
-- AND the user to have a tenant_members row with role = 'super_admin'.
-- This table is the server-side source of truth checked by the
-- super-admin-auth edge function; it cannot be bypassed from the client.

-- Written defensively (no ON CONFLICT) since platform_admins was created
-- directly in the Supabase dashboard rather than through a tracked
-- migration, so its exact constraints aren't known here.
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

