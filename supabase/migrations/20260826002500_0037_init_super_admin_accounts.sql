-- Initialize super admin accounts (Vincent & team)
-- These accounts have FULL access to entire platform without restrictions

-- Function to ensure super admin user exists
CREATE OR REPLACE FUNCTION ensure_super_admin_user(p_email text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_existing_user uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_existing_user FROM users WHERE email = p_email LIMIT 1;
  
  IF v_existing_user IS NOT NULL THEN
    -- Update existing user to super_admin role
    UPDATE users 
    SET role = 'super_admin', updated_at = now()
    WHERE email = p_email;
    RETURN;
  END IF;

  -- Create master tenant for super admins if needed
  SELECT id INTO v_tenant_id FROM tenants 
  WHERE name = 'POS Flow - Administration'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    INSERT INTO tenants (
      id, name, slug, plan_id, trial_ends_at, 
      currency, language, country, timezone,
      status, created_at
    ) VALUES (
      gen_random_uuid(),
      'POS Flow - Administration',
      'posflow-admin',
      'enterprise',
      now() + interval '10 years',
      'USD',
      'en',
      'US',
      'UTC',
      'active',
      now()
    )
    RETURNING id INTO v_tenant_id;
  END IF;

  -- Create super admin user if email not found
  INSERT INTO users (
    id, tenant_id, email, email_confirmed_at,
    role, status, created_at, updated_at
  ) VALUES (
    p_user_id,
    v_tenant_id,
    p_email,
    now(),
    'super_admin',
    'active',
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE
  SET role = 'super_admin', updated_at = now();

END;
$$;

-- Initialize the 3 super admin accounts
SELECT ensure_super_admin_user('vincentnogue2@gmail.com', gen_random_uuid());
SELECT ensure_super_admin_user('vincentnogue@yahoo.com', gen_random_uuid());
SELECT ensure_super_admin_user('webdxb1@gmail.com', gen_random_uuid());

-- Verify they are super admins
-- SELECT email, role, tenant_id FROM users WHERE email IN ('vincentnogue2@gmail.com', 'vincentnogue@yahoo.com', 'webdxb1@gmail.com');
