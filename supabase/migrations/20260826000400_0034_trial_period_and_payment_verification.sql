-- Add trial_ends_at column for 14-day free trial
ALTER TABLE tenants ADD COLUMN trial_ends_at TIMESTAMP NULL DEFAULT NULL;

-- Create index on trial_ends_at for quick lookups
CREATE INDEX idx_tenants_trial_ends_at ON tenants(trial_ends_at);

-- Add comment explaining the field
COMMENT ON COLUMN tenants.trial_ends_at IS '14-day free trial expiration date. If NULL, either trial not started or plan active.';

-- Create a function to check if tenant is in trial period
CREATE OR REPLACE FUNCTION is_tenant_in_trial(tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  trial_date TIMESTAMP;
BEGIN
  SELECT trial_ends_at INTO trial_date FROM tenants WHERE id = tenant_id;
  RETURN trial_date IS NOT NULL AND trial_date > NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a function to check if payment is required
CREATE OR REPLACE FUNCTION requires_payment(tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  trial_date TIMESTAMP;
  payment_status VARCHAR;
BEGIN
  SELECT trial_ends_at, status INTO trial_date, payment_status FROM tenants WHERE id = tenant_id;
  
  -- If in trial, no payment required
  IF trial_date IS NOT NULL AND trial_date > NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- If no plan or status is inactive, payment required
  IF payment_status = 'inactive' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Audit log table for super admin activities
CREATE TABLE IF NOT EXISTS super_admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index on super_admin_audit_logs
CREATE INDEX idx_super_admin_audit_created_at ON super_admin_audit_logs(created_at DESC);
CREATE INDEX idx_super_admin_audit_super_admin_id ON super_admin_audit_logs(super_admin_id);

-- RLS for super_admin_audit_logs (only super admins can view their own logs)
ALTER TABLE super_admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY super_admin_audit_self ON super_admin_audit_logs
  FOR SELECT
  USING (
    (auth.uid())::text = (SELECT auth_id FROM members WHERE id = super_admin_id LIMIT 1)
  );

-- Payment verification table to prevent bypass
CREATE TABLE IF NOT EXISTS payment_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  verification_type VARCHAR(50) NOT NULL, -- 'subscription', 'trial', 'addon'
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, verified, failed
  payment_method VARCHAR(100),
  payment_reference VARCHAR(255),
  verified_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, verification_type)
);

CREATE INDEX idx_payment_verification_tenant ON payment_verification(tenant_id);
CREATE INDEX idx_payment_verification_status ON payment_verification(status);

-- RLS for payment_verification
ALTER TABLE payment_verification ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_verification_own_tenant ON payment_verification
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM members 
      WHERE auth_id = auth.uid()::text
    )
  );

-- Update existing tenants with trial end date (14 days from now)
UPDATE tenants 
SET trial_ends_at = NOW() + INTERVAL '14 days'
WHERE trial_ends_at IS NULL AND status = 'active';
