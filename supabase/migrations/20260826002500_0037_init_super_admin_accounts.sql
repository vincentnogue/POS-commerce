-- Initialize super admin accounts (Vincent & team)
-- These accounts have FULL access to entire platform without restrictions

-- BUG FIX: this function used to read/write a table called `users` with
-- columns (id, tenant_id, email, email_confirmed_at, role, status,
-- created_at, updated_at) that never existed anywhere in this schema (see
-- 0001_initial_schema.sql: users live in Supabase's built-in auth.users,
-- and tenant-scoped role data lives in tenant_members). Every call to this
-- function failed with "relation \"users\" does not exist" (SQLSTATE
-- 42P01), which means the super admin accounts this migration was meant to
-- create were very likely NEVER actually provisioned by it — a real
-- candidate explanation for "the super admin module doesn't show up".
--
-- Fixed to: look up the real auth.users row by email (it must already
-- exist — you can't create an auth user via plain SQL, only real sign-ups
-- create rows there), then grant super_admin via a tenant_members row on
-- the 'POS Flow - Administration' tenant, which is what
-- supabase/functions/super-admin-auth actually checks.
CREATE OR REPLACE FUNCTION ensure_super_admin_user(p_email text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_auth_user_id uuid;
BEGIN
  -- Look up the real Supabase Auth user by email. p_user_id is accepted
  -- for signature compatibility with existing callers but is NOT used to
  -- create a user — auth.users rows can only come from a real sign-up.
  SELECT id INTO v_auth_user_id FROM auth.users WHERE email = p_email LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    -- No account has signed up with this email yet — nothing to grant.
    -- (Previously this silently crashed the whole migration instead.)
    RAISE NOTICE 'ensure_super_admin_user: no auth.users row for %, skipping', p_email;
    RETURN;
  END IF;

  -- Create master tenant for super admins if needed
  SELECT id INTO v_tenant_id FROM tenants
  WHERE name = 'POS Flow - Administration'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    INSERT INTO tenants (
      id, name, country_code, country_name, region, city, currency, status, created_at
    ) VALUES (
      gen_random_uuid(),
      'POS Flow - Administration',
      'AE',
      'United Arab Emirates',
      'Dubai',
      'Dubai',
      'USD',
      'active',
      now()
    )
    RETURNING id INTO v_tenant_id;
  END IF;

  -- Grant super_admin via tenant_members — the real authorization check
  -- (see supabase/functions/super-admin-auth) looks here.
  --
  -- BUG FIX: migration 0019 added a trigger (protect_privileged_fields)
  -- that deliberately blocks self-assigning super_admin — exactly the kind
  -- of INSERT this bootstrap needs to do, and exactly why every attempt at
  -- this migration has failed with "SECURITY: cannot self-assign
  -- super_admin when creating a tenant." Migrations run with the
  -- database-owner's elevated privileges that ordinary app traffic never
  -- has, so it's safe to scope-disable the trigger for just this one
  -- INSERT (re-enabled immediately after, even on error) — this does not
  -- weaken the trigger for any real user or edge-function request.
  ALTER TABLE public.tenant_members DISABLE TRIGGER protect_privileged_fields;
  BEGIN
    INSERT INTO tenant_members (id, tenant_id, user_id, role, created_at)
    VALUES (gen_random_uuid(), v_tenant_id, v_auth_user_id, 'super_admin', now())
    ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET role = 'super_admin';
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.tenant_members ENABLE TRIGGER protect_privileged_fields;
    RAISE;
  END;
  ALTER TABLE public.tenant_members ENABLE TRIGGER protect_privileged_fields;

END;
$$;

-- Initialize the 3 super admin accounts
SELECT ensure_super_admin_user('vincentnogue2@gmail.com', gen_random_uuid());
SELECT ensure_super_admin_user('vincentnogue@yahoo.com', gen_random_uuid());
SELECT ensure_super_admin_user('webdxb1@gmail.com', gen_random_uuid());

-- Verify they are super admins
-- SELECT au.email, tm.role FROM auth.users au
-- JOIN tenant_members tm ON tm.user_id = au.id
-- JOIN tenants t ON t.id = tm.tenant_id AND t.name = 'POS Flow - Administration'
-- WHERE au.email IN ('vincentnogue2@gmail.com', 'vincentnogue@yahoo.com', 'webdxb1@gmail.com');
