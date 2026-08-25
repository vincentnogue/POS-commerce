import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface StripePaymentRequest {
  tenant_id: string;
  connection_id: string;
  amount: number;
  currency: string;
  description?: string;
  customer_email?: string;
  metadata?: Record<string, string>;
  sale_id?: string;
  invoice_id?: string;
  return_url: string;
}

interface StripeRefundRequest {
  tenant_id: string;
  connection_id: string;
  charge_id: string;
  amount?: number;
  reason?: string;
}

/**
 * Create a Stripe payment intent
 * Used for online payments (POS Flow → Stripe → Customer)
 */
async function createPaymentIntent(
  secretKey: string,
  request: StripePaymentRequest
): Promise<{ clientSecret: string; paymentIntentId: string; error?: string }> {
  try {
    const response = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: Math.round(request.amount * 100).toString(), // Convert to cents
        currency: request.currency.toLowerCase(),
        description: request.description || "POS Flow Payment",
        "metadata[tenant_id]": request.tenant_id,
        "metadata[sale_id]": request.sale_id || "",
        "metadata[invoice_id]": request.invoice_id || "",
        ...(request.customer_email && { receipt_email: request.customer_email }),
        automatic_payment_methods: "allowed",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { clientSecret: "", paymentIntentId: "", error: error.error?.message };
    }

    const intent = await response.json();
    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    };
  } catch (err) {
    return { clientSecret: "", paymentIntentId: "", error: err.message };
  }
}

/**
 * Retrieve payment intent status
 */
async function getPaymentIntentStatus(
  secretKey: string,
  paymentIntentId: string
): Promise<{ status: string; amount: number; chargeId?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { status: "error", amount: 0, error: error.error?.message };
    }

    const intent = await response.json();
    return {
      status: intent.status, // 'succeeded', 'processing', 'requires_action', 'requires_payment_method', 'canceled'
      amount: intent.amount / 100,
      chargeId: intent.charges?.data?.[0]?.id,
    };
  } catch (err) {
    return { status: "error", amount: 0, error: err.message };
  }
}

/**
 * Create a refund for a Stripe charge
 */
async function createRefund(
  secretKey: string,
  chargeId: string,
  amount?: number,
  reason?: string
): Promise<{ refundId: string; status: string; error?: string }> {
  try {
    const response = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        charge: chargeId,
        ...(amount && { amount: Math.round(amount * 100).toString() }),
        ...(reason && { reason }),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { refundId: "", status: "error", error: error.error?.message };
    }

    const refund = await response.json();
    return {
      refundId: refund.id,
      status: refund.status,
    };
  } catch (err) {
    return { refundId: "", status: "error", error: err.message };
  }
}

/**
 * Get encrypted Stripe secret key from DB
 */
async function getStripeCredentials(
  supabaseUrl: string,
  serviceRoleKey: string,
  connectionId: string,
  tenantId: string
): Promise<{ secretKey?: string; error?: string }> {
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

    // Decrypt credentials (in production, use proper decryption)
    // For now, we're just parsing the simple obfuscation
    const credentialData = creds[0].credential_data;
    if (typeof credentialData === "string" && credentialData.startsWith("enc_")) {
      const decoded = atob(credentialData.replace("enc_", ""));
      const parsed = JSON.parse(decoded);
      return { secretKey: parsed.secret_key };
    }

    return { error: "Invalid credential format" };
  } catch (err) {
    return { error: err.message };
  }
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

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Server not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "create_payment_intent";

    if (req.method === "POST") {
      const body = (await req.json()) as StripePaymentRequest | StripeRefundRequest;

      if (!("connection_id" in body) || !("tenant_id" in body)) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get Stripe credentials
      const { secretKey, error: credError } = await getStripeCredentials(
        supabaseUrl,
        serviceRoleKey,
        body.connection_id,
        body.tenant_id
      );

      if (credError || !secretKey) {
        return new Response(
          JSON.stringify({ success: false, message: credError || "No Stripe credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "create_payment_intent") {
        const paymentReq = body as StripePaymentRequest;
        const result = await createPaymentIntent(secretKey, paymentReq);

        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            clientSecret: result.clientSecret,
            paymentIntentId: result.paymentIntentId,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "create_refund") {
        const refundReq = body as StripeRefundRequest;
        const result = await createRefund(
          secretKey,
          refundReq.charge_id,
          refundReq.amount,
          refundReq.reason
        );

        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            refundId: result.refundId,
            status: result.status,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (req.method === "GET") {
      const paymentIntentId = url.searchParams.get("payment_intent_id");
      const connectionId = url.searchParams.get("connection_id");
      const tenantId = url.searchParams.get("tenant_id");

      if (!paymentIntentId || !connectionId || !tenantId) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing required parameters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { secretKey, error: credError } = await getStripeCredentials(
        supabaseUrl,
        serviceRoleKey,
        connectionId,
        tenantId
      );

      if (credError || !secretKey) {
        return new Response(
          JSON.stringify({ success: false, message: credError || "No Stripe credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await getPaymentIntentStatus(secretKey, paymentIntentId);

      if (result.error) {
        return new Response(
          JSON.stringify({ success: false, message: result.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: result.status,
          amount: result.amount,
          chargeId: result.chargeId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Stripe error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
