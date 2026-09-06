import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.5';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

interface AccessCheckRequest {
  tenant_id: string;
  user_id: string;
  action: 'browse' | 'connect' | 'disconnect' | 'test' | 'view_credentials' | 'delete' | 'view_logs' | 'webhooks';
  integration_provider_id?: string;
}

async function checkMarketplaceAccess(req: AccessCheckRequest) {
  // BUG FIX: this queried a `users` table that does not exist anywhere in
  // this schema — every table/column with role+tenant_id association in
  // this app is `tenant_members` (id, tenant_id, user_id, role, ...).
  // Every single call to this function therefore always failed with
  // "User not found", which MarketplacePage.tsx's catch block silently
  // turned into "assume admin/super_admin only" — meaning a manager or
  // staff member with a real plan-level 'connect' permission could never
  // actually connect an integration, no matter their role or plan.
  const { data: user, error: userError } = await supabase
    .from('tenant_members')
    .select('id, tenant_id, user_id, role')
    .eq('user_id', req.user_id)
    .eq('tenant_id', req.tenant_id)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  // Super admins get full access
  if (user.role === 'super_admin' || user.role === 'admin') {
    return {
      allowed: true,
      reason: 'super_admin_or_admin_access',
      user_role: user.role,
    };
  }

  // Get tenant plan
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('plan_id')
    .eq('id', req.tenant_id)
    .single();

  if (tenantError || !tenant) {
    throw new Error('Tenant not found');
  }

  // BUG FIX: tenants.plan_id is a uuid (foreign key to plans.id), but
  // marketplace_plan_limits.plan_id is a text code ('starter', 'pro',
  // 'premium', 'entreprise' — the real codes from public.plans.code).
  // This used to compare the uuid directly against that text column,
  // which could never match for any tenant, ever — 'Plan limits not
  // found' on every single connect-limit check. Resolve the uuid to its
  // real code first.
  const { data: planRow, error: planCodeError } = await supabase
    .from('plans')
    .select('code')
    .eq('id', tenant.plan_id)
    .single();

  if (planCodeError || !planRow) {
    throw new Error('Plan not found');
  }

  // Get plan limits
  const { data: planLimits, error: planError } = await supabase
    .from('marketplace_plan_limits')
    .select('*')
    .eq('plan_id', planRow.code)
    .single();

  if (planError || !planLimits) {
    throw new Error('Plan limits not found');
  }

  // Get role permissions
  const { data: rolePerms, error: roleError } = await supabase
    .from('marketplace_role_permissions')
    .select('*')
    .eq('role', user.role)
    .single();

  if (roleError || !rolePerms) {
    throw new Error('Role permissions not found');
  }

  // Check specific action permission
  let actionAllowed = false;
  switch (req.action) {
    case 'browse':
      actionAllowed = rolePerms.can_browse_marketplace;
      break;
    case 'connect':
      actionAllowed = rolePerms.can_connect_integration;
      break;
    case 'disconnect':
      actionAllowed = rolePerms.can_disconnect_integration;
      break;
    case 'test':
      actionAllowed = rolePerms.can_test_connection;
      break;
    case 'view_credentials':
      actionAllowed = rolePerms.can_view_credentials;
      break;
    case 'delete':
      actionAllowed = rolePerms.can_delete_connection;
      break;
    case 'view_logs':
      actionAllowed = rolePerms.can_view_sync_logs;
      break;
    case 'webhooks':
      actionAllowed = rolePerms.can_configure_webhooks;
      break;
  }

  if (!actionAllowed) {
    return {
      allowed: false,
      reason: 'insufficient_permissions',
      user_role: user.role,
      plan: planRow.code,
      required_action: req.action,
    };
  }

  // For connect action, check integration limits
  if (req.action === 'connect') {
    const { data: activeIntegrations, error: countError } = await supabase
      .from('integration_connections')
      .select('id', { count: 'exact' })
      .eq('tenant_id', req.tenant_id);

    if (countError) {
      throw new Error('Could not count integrations');
    }

    const count = activeIntegrations?.length || 0;

    if (count >= planLimits.max_integrations) {
      return {
        allowed: false,
        reason: 'integration_limit_reached',
        current_count: count,
        max_allowed: planLimits.max_integrations,
        plan: planRow.code,
      };
    }
  }

  // All checks passed
  return {
    allowed: true,
    reason: 'access_granted',
    user_role: user.role,
    plan: planRow.code,
    plan_limits: {
      max_integrations: planLimits.max_integrations,
      allowed_categories: planLimits.allowed_categories,
      allows_custom_integration: planLimits.allows_custom_integration,
      allows_api_access: planLimits.allows_api_access,
      allows_webhook_test: planLimits.allows_webhook_test,
      allows_production_mode: planLimits.allows_production_mode,
    },
  };
}

serve(async (req: Request) => {
  try {
    const payload = await req.json() as AccessCheckRequest;

    // SECURITY: strict identity verification — same fix/rationale as
    // stripe-payments and the other functions fixed in this audit. This
    // function used to trust payload.user_id and payload.tenant_id at
    // face value with no check that the actual caller (via their Bearer
    // token) really was that user — so anyone could pass, say, a
    // super_admin's user_id from a different tenant and get back
    // 'allowed: true' / 'super_admin_or_admin_access', bypassing every
    // marketplace permission check (connect, view credentials, delete,
    // webhooks...) for a tenant they don't belong to. Found during a
    // follow-up security audit of every edge function after the
    // stripe-payments fix. The frontend (MarketplacePage.tsx) already
    // sends the real user's Bearer token, so this only needed reading.
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearerToken = authHeader.replace('Bearer ', '');
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
    );
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData.user || callerData.user.id !== payload.user_id) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated as the requested user', allowed: false }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await checkMarketplaceAccess(payload);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message, allowed: false }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
