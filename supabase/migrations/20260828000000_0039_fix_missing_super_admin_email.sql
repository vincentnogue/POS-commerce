-- BUG FIX: the platform_admins allowlist (migration 0015) contains 4 emails
-- ('vincentnogue@yahoo.com', 'vincentnogue2@gmail.com', 'webdxb1@gmail.com',
-- 'liyahjoha@gmail.com') but migrations 0037 and 0038, which actually grant
-- the super_admin role (a tenant_members row required by the
-- super-admin-auth edge function — see its comments), only ever processed
-- the first 3 emails. As a result 'liyahjoha@gmail.com' was listed as an
-- admin but could never actually log into the Super Admin module.
--
-- This migration is additive only (reuses ensure_super_admin_user from
-- 0037, now fixed to use auth.users/tenant_members instead of a
-- nonexistent 'users' table) and brings the missing account in line with
-- the other three, without altering the already-applied 0037/0038
-- migrations.

SELECT ensure_super_admin_user('liyahjoha@gmail.com', gen_random_uuid());

-- Redundant safety net (harmless/idempotent) in case ensure_super_admin_user
-- ran before the account had signed up yet.
DO $$
BEGIN
  ALTER TABLE public.tenant_members DISABLE TRIGGER protect_privileged_fields;
  BEGIN
    INSERT INTO tenant_members (id, tenant_id, user_id, role, created_at)
    SELECT
      gen_random_uuid(),
      t.id,
      au.id,
      'super_admin',
      now()
    FROM auth.users au
    CROSS JOIN tenants t
    WHERE au.email = 'liyahjoha@gmail.com'
      AND t.name = 'POS Flow - Administration'
      AND NOT EXISTS (
        SELECT 1 FROM tenant_members tm
        WHERE tm.user_id = au.id AND tm.tenant_id = t.id
      )
    ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET role = 'super_admin';
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.tenant_members ENABLE TRIGGER protect_privileged_fields;
    RAISE;
  END;
  ALTER TABLE public.tenant_members ENABLE TRIGGER protect_privileged_fields;

  RAISE NOTICE 'liyahjoha@gmail.com super admin tenant membership ensured';
END;
$$;

-- Verify all 4 platform admins now have both requirements met:
-- SELECT pa.email, tm.role AS tenant_role
-- FROM platform_admins pa
-- LEFT JOIN auth.users au ON au.email = pa.email
-- LEFT JOIN tenant_members tm ON tm.user_id = au.id
-- LEFT JOIN tenants t ON t.id = tm.tenant_id AND t.name = 'POS Flow - Administration';
