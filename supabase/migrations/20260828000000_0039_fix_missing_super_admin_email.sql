-- BUG FIX: the platform_admins allowlist (migration 0015) contains 4 emails
-- ('vincentnogue@yahoo.com', 'vincentnogue2@gmail.com', 'webdxb1@gmail.com',
-- 'liyahjoha@gmail.com') but migrations 0037 and 0038, which actually grant
-- the super_admin role (users.role + tenant_members row required by the
-- super-admin-auth edge function — see its comments), only ever processed
-- the first 3 emails. As a result 'liyahjoha@gmail.com' was listed as an
-- admin but could never actually log into the Super Admin module.
--
-- This migration is additive only (reuses ensure_super_admin_user from
-- 0037) and brings the missing account in line with the other three,
-- without altering the already-applied 0037/0038 migrations.

SELECT ensure_super_admin_user('liyahjoha@gmail.com', gen_random_uuid());

DO $$
BEGIN
  INSERT INTO tenant_members (id, tenant_id, user_id, role, created_at)
  SELECT
    gen_random_uuid(),
    t.id,
    u.id,
    'super_admin',
    now()
  FROM users u
  CROSS JOIN tenants t
  WHERE u.role = 'super_admin'
    AND u.email = 'liyahjoha@gmail.com'
    AND t.name = 'POS Flow - Administration'
    AND NOT EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.user_id = u.id AND tm.tenant_id = t.id
    )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET role = 'super_admin';

  RAISE NOTICE 'liyahjoha@gmail.com super admin tenant membership ensured';
END;
$$;

-- Verify all 4 platform admins now have both requirements met:
-- SELECT pa.email, u.role AS user_role, tm.role AS tenant_role
-- FROM platform_admins pa
-- LEFT JOIN users u ON u.email = pa.email
-- LEFT JOIN tenant_members tm ON tm.user_id = u.id
-- LEFT JOIN tenants t ON t.id = tm.tenant_id AND t.name = 'POS Flow - Administration';
