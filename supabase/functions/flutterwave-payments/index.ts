import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface FlutterwavePaymentRequest {
  tenant_id: string;
  connection_id: string;
  amount: number;
  currency: string;
  description?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  metadata?: Record<string, string>;
  sale_id?: string;
  invoice_id?: string;
}

interface FlutterwaveRefundRequest {
  tenant_id: string;
  connection_id: string;
  transaction_id: string;
  amount?: number;
  reason?: string;
}

/**
 * Create Flutterwave payment link
 * Flutterwave returns a payment link that customer visits
 */
async function createFlutterwavePaymentLink(
  secretKey: string,
  request: FlutterwavePaymentRequest
): Promise<{ paymentLink?: string; transactionReference?: string; error?: string }> {
  try {
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: `${request.sale_id || request.invoice_id || Math.random()}_${Date.now()}`,
        amount: request.amount,
        currency: request.currency,
        redirect_url: "", // Will be set by client
        payment_options: "card,mobilemoneyghana,mobilemoneyrwanda,mobilemoneyuganda,mobilemoneytanzania,mobilemoneykenya,qrcode,banktransfer",
        customer: {
          email: request.customer_email || "customer@unknown.com",
          phonenumber: request.customer_phone,
          name: request.customer_name,
        },
        customizations: {
          title: "POS Flow",
          description: request.description || "Payment",
          logo: "https://posflow.app/logo.png",
        },
        meta: {
          tenant_id: request.tenant_id,
          sale_id: request.sale_id,
          invoice_id: request.invoice_id,
          ...request.metadata,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || "Payment link creation failed" };
    }

    const data = await response.json();
    if (!data.status || data.status !== "success") {
      return { error: data.message || "Failed to create payment" };
    }

    return {
      paymentLink: data.data.link,
      transactionReference: data.data.tx_ref,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Verify Flutterwave transaction
 * Called after customer returns from payment page
 */
async function verifyFlutterwaveTransaction(
  secretKey: string,
  transactionId: string
): Promise<{ status: string; amount: number; currency: string; chargeId?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { status: "error", amount: 0, currency: "USD", error: error.message };
    }

    const data = await response.json();
    if (!data.data) {
      return { status: "error", amount: 0, currency: "USD", error: "No transaction data" };
    }

    const transaction = data.data;
    return {
      status: transaction.status === "successful" ? "succeeded" : transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      chargeId: transaction.id?.toString(),
    };
  } catch (err) {
    return { status: "error", amount: 0, currency: "USD", error: err.message };
  }
}

/**
 * Refund Flutterwave transaction
 */
async function refundFlutterwaveTransaction(
  secretKey: string,
  transactionId: string,
  amount?: number,
  reason?: string
): Promise<{ refundId?: string; status?: string; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      action: "refund",
    };

    if (amount) {
      body.amount = amount;
    }

    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || "Refund failed" };
    }

    const data = await response.json();
    return {
      refundId: data.data?.id?.toString(),
      status: data.data?.status,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Get Flutterwave credentials from database
 */
async function getFlutterwaveCredentials(
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
    const action = url.searchParams.get("action") || "create_payment_link";

    if (req.method === "POST") {
      const body = (await req.json()) as
        | FlutterwavePaymentRequest
        | FlutterwaveRefundRequest;

      if (!("connection_id" in body) || !("tenant_id" in body)) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get Flutterwave credentials
      const { secretKey, error: credError } = await getFlutterwaveCredentials(
        supabaseUrl,
        serviceRoleKey,
        body.connection_id,
        body.tenant_id
      );

      if (credError || !secretKey) {
        return new Response(
          JSON.stringify({
            success: false,
            message: credError || "No Flutterwave credentials",
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "create_payment_link") {
        const paymentReq = body as FlutterwavePaymentRequest;
        const result = await createFlutterwavePaymentLink(secretKey, paymentReq);

        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            paymentLink: result.paymentLink,
            transactionReference: result.transactionReference,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "verify_transaction") {
        const transactionId = url.searchParams.get("transaction_id");
        if (!transactionId) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Missing transaction_id",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await verifyFlutterwaveTransaction(secretKey, transactionId);

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
        const refundReq = body as FlutterwaveRefundRequest;
        const result = await refundFlutterwaveTransaction(
          secretKey,
          refundReq.transaction_id,
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
    }

    return new Response(
      JSON.stringify({ success: false, message: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Flutterwave error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
