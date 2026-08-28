import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PayUnitPaymentRequest {
  tenant_id: string;
  connection_id: string;
  amount: number;
  currency: string;
  phone?: string;
  email?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sale_id?: string;
  invoice_id?: string;
}

interface PayUnitRefundRequest {
  tenant_id: string;
  connection_id: string;
  transaction_reference: string;
  amount?: number;
}

/**
 * Get PayUnit credentials from database
 *
 * BUG FIX: this used to do
 *   supabase.from('integration_connections')
 *     .select('integration_credentials(credentials)')
 * which references a column ("credentials") that has never existed on
 * integration_credentials (the real column is "credential_data", and it's
 * stored base64-encoded behind an "enc_" prefix — see
 * integration-save-connection). That query always failed, so a PayUnit
 * connection could never actually be used. This now reads credentials the
 * same way paystack-payments / flutterwave-payments do.
 */
async function getPayUnitCredentials(
  supabaseUrl: string,
  serviceRoleKey: string,
  connectionId: string,
  tenantId: string
): Promise<{ apiKey?: string; merchantId?: string; testMode?: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/integration_credentials?connection_id=eq.${connectionId}&tenant_id=eq.${tenantId}`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!res.ok) {
      return { error: "Failed to retrieve credentials" };
    }

    const creds = await res.json();
    if (!creds[0]) {
      return { error: "Credentials not found" };
    }

    const credentialData = creds[0].credential_data;
    if (typeof credentialData === "string" && credentialData.startsWith("enc_")) {
      const decoded = atob(credentialData.replace("enc_", ""));
      const parsed = JSON.parse(decoded);
      return {
        apiKey: parsed.api_key,
        merchantId: parsed.merchant_id,
        testMode: parsed.test_mode ?? true,
      };
    }

    return { error: "Invalid credential format" };
  } catch (err) {
    return { error: err.message };
  }
}

async function initializePayment(
  supabaseUrl: string,
  serviceRoleKey: string,
  req: PayUnitPaymentRequest
) {
  const creds = await getPayUnitCredentials(supabaseUrl, serviceRoleKey, req.connection_id, req.tenant_id);
  if (creds.error || !creds.apiKey || !creds.merchantId) {
    return { success: false, error: creds.error || "No PayUnit credentials" };
  }

  const baseUrl = creds.testMode
    ? "https://api.sandbox.payunit.net/v1"
    : "https://api.payunit.net/v1";

  const payload = {
    merchant_id: creds.merchantId,
    amount: Math.round(req.amount * 100), // Convert to cents
    currency: req.currency,
    phone: req.phone,
    email: req.email,
    description: req.description || "Payment via POS Flow",
    reference: `posflow_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    metadata: req.metadata,
    redirect_url: `${Deno.env.get("PUBLIC_SITE_URL") || ""}/payment/callback`,
  };

  const response = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error: `PayUnit API error: ${response.status} - ${error}` };
  }

  const result = await response.json();

  return {
    success: true,
    reference: payload.reference,
    transaction_id: result.transaction_id,
    payment_url: result.payment_url,
    amount: req.amount,
    currency: req.currency,
  };
}

async function verifyPayment(
  supabaseUrl: string,
  serviceRoleKey: string,
  tenantId: string,
  connectionId: string,
  transactionReference: string
) {
  const creds = await getPayUnitCredentials(supabaseUrl, serviceRoleKey, connectionId, tenantId);
  if (creds.error || !creds.apiKey) {
    return { success: false, error: creds.error || "No PayUnit credentials" };
  }

  const baseUrl = creds.testMode
    ? "https://api.sandbox.payunit.net/v1"
    : "https://api.payunit.net/v1";

  const response = await fetch(`${baseUrl}/transactions/${transactionReference}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return { success: false, error: `PayUnit verification failed: ${response.status}` };
  }

  const transaction = await response.json();

  return {
    success: true,
    status: transaction.status,
    amount: transaction.amount / 100,
    currency: transaction.currency,
    reference: transaction.reference,
    completed_at: transaction.completed_at,
  };
}

async function refundPayment(
  supabaseUrl: string,
  serviceRoleKey: string,
  req: PayUnitRefundRequest
) {
  // BUG FIX: this used to call getPayUnitCredentials(req.tenant_id, '')
  // with a hardcoded empty connection_id, so the credential lookup always
  // failed and every refund attempt errored out with
  // "PayUnit connection not found". connection_id is now a required field
  // on the refund request, exactly like the other PSP refund endpoints.
  const creds = await getPayUnitCredentials(supabaseUrl, serviceRoleKey, req.connection_id, req.tenant_id);
  if (creds.error || !creds.apiKey) {
    return { success: false, error: creds.error || "No PayUnit credentials" };
  }

  const baseUrl = creds.testMode
    ? "https://api.sandbox.payunit.net/v1"
    : "https://api.payunit.net/v1";

  const payload = {
    transaction_reference: req.transaction_reference,
    amount: req.amount ? Math.round(req.amount * 100) : undefined,
  };

  const response = await fetch(`${baseUrl}/transactions/${req.transaction_reference}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error: `PayUnit refund failed: ${response.status} - ${error}` };
  }

  const result = await response.json();

  return {
    success: true,
    refund_id: result.refund_id,
    status: result.status,
    reference: req.transaction_reference,
  };
}

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
  // BUG FIX: this function never handled CORS at all (no headers, no
  // OPTIONS branch), so any call made directly from the browser was
  // rejected by the preflight before ever reaching this code.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Server not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, ...payload } = await req.json();

    if (!payload.tenant_id || !payload.connection_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // BUG FIX / SECURITY: strict multi-tenant isolation — same fix as
    // paystack-payments / flutterwave-payments. This function had zero
    // authentication or tenant-membership checks: any caller could pass
    // any tenant_id and act on that tenant's PayUnit connection.
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearerToken = authHeader.replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData.user) {
      return new Response(
        JSON.stringify({ success: false, message: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerMember } = await adminClient
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", payload.tenant_id)
      .eq("user_id", callerData.user.id)
      .maybeSingle();

    if (!callerMember) {
      return new Response(
        JSON.stringify({ success: false, message: "Accès refusé pour ce tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (action === "refund_payment" && !["admin", "manager", "super_admin"].includes(callerMember.role)) {
      return new Response(
        JSON.stringify({ success: false, message: "Permission insuffisante pour un remboursement" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    switch (action) {
      case "initialize_payment":
        result = await initializePayment(supabaseUrl, serviceRoleKey, payload as PayUnitPaymentRequest);
        break;

      case "verify_payment":
        result = await verifyPayment(
          supabaseUrl,
          serviceRoleKey,
          payload.tenant_id,
          payload.connection_id,
          payload.transaction_reference
        );
        break;

      case "refund_payment":
        result = await refundPayment(supabaseUrl, serviceRoleKey, payload as PayUnitRefundRequest);
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, message: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
