-- Fix super admin tenant membership
-- Ensure super admins have proper tenant_members entries

-- First, ensure tenant_members table exists and has super_admin role
DO $$
BEGIN
  -- For each super admin user, create/update tenant_members entry
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
    AND u.email IN ('vincentnogue2@gmail.com', 'vincentnogue@yahoo.com', 'webdxb1@gmail.com')
    AND t.name = 'POS Flow - Administration'
    AND NOT EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.user_id = u.id AND tm.tenant_id = t.id
    )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET role = 'super_admin';
  
  RAISE NOTICE 'Super admin tenant members initialized';
END;
$$;

-- Verify super admins
-- SELECT u.email, u.role, tm.role, t.name 
-- FROM users u
-- LEFT JOIN tenant_members tm ON u.id = tm.user_id
-- LEFT JOIN tenants t ON tm.tenant_id = t.id
-- WHERE u.email IN ('vincentnogue2@gmail.com', 'vincentnogue@yahoo.com', 'webdxb1@gmail.com');
