-- Marketplace Access Control by Plan

-- Create table for integration limits per plan
CREATE TABLE IF NOT EXISTS marketplace_plan_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL UNIQUE,
  plan_name text NOT NULL,
  max_integrations integer NOT NULL,
  allowed_categories text[] NOT NULL, -- 'payments', 'shipping', 'accounting', 'ecommerce', 'notifications'
  allows_custom_integration boolean DEFAULT false,
  allows_api_access boolean DEFAULT false,
  allows_webhook_test boolean DEFAULT false,
  allows_production_mode boolean DEFAULT false,
  rate_limit_per_minute integer DEFAULT 100,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create table for role-based marketplace permissions
CREATE TABLE IF NOT EXISTS marketplace_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE, -- super_admin, admin, manager, staff, viewer
  can_browse_marketplace boolean DEFAULT true,
  can_connect_integration boolean DEFAULT false,
  can_disconnect_integration boolean DEFAULT false,
  can_test_connection boolean DEFAULT false,
  can_view_credentials boolean DEFAULT false,
  can_delete_connection boolean DEFAULT false,
  can_view_sync_logs boolean DEFAULT false,
  can_configure_webhooks boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Create user-specific marketplace access tracking
CREATE TABLE IF NOT EXISTS user_marketplace_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  role text NOT NULL,
  active_integrations integer DEFAULT 0,
  last_accessed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Enable RLS
ALTER TABLE marketplace_plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_marketplace_access ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY marketplace_plan_limits_public ON marketplace_plan_limits
  FOR SELECT USING (true); -- Everyone can read plan limits

CREATE POLICY marketplace_role_permissions_public ON marketplace_role_permissions
  FOR SELECT USING (true); -- Everyone can read role permissions

CREATE POLICY user_marketplace_access_owner ON user_marketplace_access
  FOR ALL USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT id FROM tenants WHERE id = auth.uid()::uuid
    )
    OR user_id IN (
      SELECT id FROM users WHERE id = auth.uid() AND tenant_id = user_marketplace_access.tenant_id
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS marketplace_plan_limits_plan_id_idx ON marketplace_plan_limits(plan_id);
CREATE INDEX IF NOT EXISTS marketplace_role_permissions_role_idx ON marketplace_role_permissions(role);
CREATE INDEX IF NOT EXISTS user_marketplace_access_tenant_idx ON user_marketplace_access(tenant_id);
CREATE INDEX IF NOT EXISTS user_marketplace_access_user_idx ON user_marketplace_access(user_id);

-- Seed default plan limits
INSERT INTO marketplace_plan_limits (plan_id, plan_name, max_integrations, allowed_categories, allows_custom_integration, allows_api_access, allows_webhook_test, allows_production_mode, rate_limit_per_minute)
VALUES
  ('starter', 'Starter', 5, ARRAY['payments', 'shipping'], false, false, false, false, 100),
  ('professional', 'Professional', 10, ARRAY['payments', 'shipping', 'accounting', 'ecommerce', 'notifications'], true, true, true, true, 500),
  ('enterprise', 'Enterprise', 999, ARRAY['payments', 'shipping', 'accounting', 'ecommerce', 'notifications'], true, true, true, true, 1000),
  ('custom', 'Custom', 999, ARRAY['payments', 'shipping', 'accounting', 'ecommerce', 'notifications'], true, true, true, true, 5000)
ON CONFLICT (plan_id) DO NOTHING;

-- Seed default role permissions
INSERT INTO marketplace_role_permissions (role, can_browse_marketplace, can_connect_integration, can_disconnect_integration, can_test_connection, can_view_credentials, can_delete_connection, can_view_sync_logs, can_configure_webhooks)
VALUES
  ('super_admin', true, true, true, true, true, true, true, true),
  ('admin', true, true, true, true, true, true, true, true),
  ('manager', true, true, false, true, false, false, true, false),
  ('staff', true, false, false, false, false, false, false, false),
  ('viewer', true, false, false, false, false, false, false, false)
ON CONFLICT (role) DO NOTHING;

-- Function to check if user can access marketplace
CREATE OR REPLACE FUNCTION check_marketplace_access(p_tenant_id uuid, p_user_id uuid, p_action text)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM user_marketplace_access uma
    JOIN marketplace_role_permissions mrp ON uma.role = mrp.role
    WHERE uma.tenant_id = p_tenant_id
      AND uma.user_id = p_user_id
      AND (
        (p_action = 'browse' AND mrp.can_browse_marketplace)
        OR (p_action = 'connect' AND mrp.can_connect_integration)
        OR (p_action = 'disconnect' AND mrp.can_disconnect_integration)
        OR (p_action = 'test' AND mrp.can_test_connection)
        OR (p_action = 'view_credentials' AND mrp.can_view_credentials)
        OR (p_action = 'delete' AND mrp.can_delete_connection)
        OR (p_action = 'view_logs' AND mrp.can_view_sync_logs)
        OR (p_action = 'webhooks' AND mrp.can_configure_webhooks)
      )
  );
$$;

-- Function to check integration limit
CREATE OR REPLACE FUNCTION check_integration_limit(p_tenant_id uuid)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT mpl.max_integrations
    FROM marketplace_plan_limits mpl
    JOIN tenants t ON t.plan_id = mpl.plan_id
    WHERE t.id = p_tenant_id
  ) > (
    SELECT COUNT(*)
    FROM integration_connections
    WHERE tenant_id = p_tenant_id
  );
$$;

-- Function to allow access by super_admin to all marketplace features
CREATE OR REPLACE FUNCTION allow_super_admin_marketplace(p_tenant_id uuid)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM users
    WHERE id = auth.uid()
      AND tenant_id = p_tenant_id
      AND role = 'super_admin'
  );
$$;
