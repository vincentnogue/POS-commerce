import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PaystackPaymentRequest {
  tenant_id: string;
  connection_id: string;
  amount: number;
  currency?: string;
  email: string;
  metadata?: Record<string, unknown>;
  sale_id?: string;
  invoice_id?: string;
  customer_name?: string;
  customer_phone?: string;
}

interface PaystackRefundRequest {
  tenant_id: string;
  connection_id: string;
  reference: string;
  amount?: number;
}

/**
 * Initialize Paystack transaction
 * Returns a payment authorization URL for the customer
 */
async function initializePaystackTransaction(
  secretKey: string,
  request: PaystackPaymentRequest
): Promise<{ authorizationUrl?: string; accessCode?: string; reference?: string; error?: string }> {
  try {
    // Paystack accepts amounts in kobo (1 NGN = 100 kobo, but this varies by currency)
    // For most African currencies, we multiply by 100
    const amountInSubunits = Math.round(request.amount * 100);

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: request.email,
        amount: amountInSubunits,
        currency: request.currency || "NGN",
        metadata: {
          tenant_id: request.tenant_id,
          sale_id: request.sale_id,
          invoice_id: request.invoice_id,
          customer_name: request.customer_name,
          customer_phone: request.customer_phone,
          ...(request.metadata || {}),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        error: error.message || "Transaction initialization failed",
      };
    }

    const data = await response.json();
    if (!data.status) {
      return { error: data.message || "Initialization failed" };
    }

    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Verify Paystack transaction
 * Called with the reference returned after customer payment
 */
async function verifyPaystackTransaction(
  secretKey: string,
  reference: string
): Promise<{
  status: string;
  amount: number;
  currency: string;
  chargeId?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        status: "error",
        amount: 0,
        currency: "NGN",
        error: error.message || "Verification failed",
      };
    }

    const data = await response.json();
    if (!data.data) {
      return {
        status: "error",
        amount: 0,
        currency: "NGN",
        error: "No transaction data",
      };
    }

    const transaction = data.data;
    return {
      status: transaction.status === "success" ? "succeeded" : transaction.status,
      amount: transaction.amount / 100, // Convert from kobo
      currency: transaction.currency,
      chargeId: transaction.reference,
    };
  } catch (err) {
    return {
      status: "error",
      amount: 0,
      currency: "NGN",
      error: err.message,
    };
  }
}

/**
 * Refund Paystack transaction
 */
async function refundPaystackTransaction(
  secretKey: string,
  reference: string,
  amount?: number
): Promise<{ refundId?: string; status?: string; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      transaction: reference,
    };

    if (amount) {
      // Paystack refund also uses subunits
      body.amount = Math.round(amount * 100);
    }

    const response = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || "Refund failed" };
    }

    const data = await response.json();
    if (!data.status) {
      return { error: data.message || "Refund failed" };
    }

    return {
      refundId: data.data.reference,
      status: data.data.status,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Get Paystack credentials from database
 */
async function getPaystackCredentials(
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

    // Decrypt credentials
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
    const action = url.searchParams.get("action") || "initialize_transaction";

    if (req.method === "POST") {
      const body = (await req.json()) as
        | PaystackPaymentRequest
        | PaystackRefundRequest;

      if (!("connection_id" in body) || !("tenant_id" in body)) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get Paystack credentials
      const { secretKey, error: credError } = await getPaystackCredentials(
        supabaseUrl,
        serviceRoleKey,
        body.connection_id,
        body.tenant_id
      );

      if (credError || !secretKey) {
        return new Response(
          JSON.stringify({
            success: false,
            message: credError || "No Paystack credentials",
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "initialize_transaction") {
        const paymentReq = body as PaystackPaymentRequest;
        const result = await initializePaystackTransaction(secretKey, paymentReq);

        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            authorizationUrl: result.authorizationUrl,
            accessCode: result.accessCode,
            reference: result.reference,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "verify_transaction") {
        const reference = url.searchParams.get("reference");
        if (!reference) {
          return new Response(
            JSON.stringify({ success: false, message: "Missing reference" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await verifyPaystackTransaction(secretKey, reference);

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
            currency: result.currency,
            chargeId: result.chargeId,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "refund") {
        const refundReq = body as PaystackRefundRequest;
        const result = await refundPaystackTransaction(
          secretKey,
          refundReq.reference,
          refundReq.amount
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
    }

    return new Response(
      JSON.stringify({ success: false, message: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Paystack error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
