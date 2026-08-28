-- Fix super admin tenant membership
-- Ensure super admins have proper tenant_members entries
--
-- BUG FIX: this used to read `FROM users u ... WHERE u.role = 'super_admin'`
-- — a table that never existed (see 0037's fix note). ensure_super_admin_user
-- (fixed in 0037) now grants tenant_members directly from auth.users, so
-- this migration is now a redundant safety net: idempotent, re-runs the
-- same grant directly from auth.users so it's harmless either way.

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
    WHERE au.email IN ('vincentnogue2@gmail.com', 'vincentnogue@yahoo.com', 'webdxb1@gmail.com')
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

  RAISE NOTICE 'Super admin tenant members initialized';
END;
$$;

-- Verify super admins
-- SELECT au.email, tm.role, t.name
-- FROM auth.users au
-- LEFT JOIN tenant_members tm ON au.id = tm.user_id
-- LEFT JOIN tenants t ON tm.tenant_id = t.id
-- WHERE au.email IN ('vincentnogue2@gmail.com', 'vincentnogue@yahoo.com', 'webdxb1@gmail.com');
