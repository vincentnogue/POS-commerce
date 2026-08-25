import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface AccessCheckRequest {
  tenant_id: string;
  module: string;
  action: string;
}

/**
 * Verify tenant access based on trial status and payment
 * Prevents users from bypassing payment requirements
 */
async function verifyTenantAccess(
  supabaseUrl: string,
  serviceRoleKey: string,
  tenantId: string,
  module: string
): Promise<{ allowed: boolean; reason?: string; trial?: boolean; requiresPayment?: boolean }> {
  try {
    // Check tenant trial status
    const tenantRes = await fetch(
      `${supabaseUrl}/rest/v1/tenants?id=eq.${tenantId}`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!tenantRes.ok) {
      return { allowed: false, reason: "Tenant not found" };
    }

    const tenants = await tenantRes.json();
    if (!tenants[0]) {
      return { allowed: false, reason: "Tenant not found" };
    }

    const tenant = tenants[0];
    const now = new Date();
    const trialEndsAt = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
    const isInTrial = trialEndsAt && trialEndsAt > now;

    // Check payment verification
    const paymentRes = await fetch(
      `${supabaseUrl}/rest/v1/payment_verification?tenant_id=eq.${tenantId}&verification_type=eq.subscription`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    const payments = await paymentRes.json();
    const paymentVerified = payments.length > 0 && payments[0].status === "verified";

    // Determine access
    if (isInTrial) {
      // In trial period - full access to all modules (premium features too)
      return { allowed: true, trial: true };
    }

    if (paymentVerified) {
      // Payment verified - full access
      return { allowed: true, trial: false };
    }

    // No trial, no payment - deny access
    return {
      allowed: false,
      reason: "Trial period expired. Payment required.",
      trial: false,
      requiresPayment: true,
    };
  } catch (err) {
    console.error("Access check error:", err);
    return { allowed: false, reason: `Error: ${err.message}` };
  }
}

/**
 * Log super admin activity for audit trail
 */
async function logSuperAdminActivity(
  supabaseUrl: string,
  serviceRoleKey: string,
  superAdminId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/super_admin_audit_logs`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      super_admin_id: superAdminId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ipAddress,
      user_agent: userAgent,
    }),
  });
}

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Server not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, message: "Only POST allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as AccessCheckRequest;

    if (!body.tenant_id || !body.module) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify access
    const accessResult = await verifyTenantAccess(supabaseUrl, serviceRoleKey, body.tenant_id, body.module);

    if (!accessResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          ...accessResult,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        allowed: true,
        trial: accessResult.trial,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Access verification error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
