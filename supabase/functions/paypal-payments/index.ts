import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PayPalPaymentRequest {
  tenant_id: string;
  connection_id: string;
  amount: number;
  currency: string;
  description?: string;
  customer_email?: string;
  return_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  sale_id?: string;
  invoice_id?: string;
}

interface PayPalRefundRequest {
  tenant_id: string;
  connection_id: string;
  capture_id: string;
  amount?: number;
  reason?: string;
}

/**
 * Get OAuth token from PayPal
 */
async function getPayPalAccessToken(
  clientId: string,
  clientSecret: string,
  sandbox: boolean = false
): Promise<{ accessToken: string; error?: string }> {
  try {
    const auth = btoa(`${clientId}:${clientSecret}`);
    const baseUrl = sandbox ? "https://api.sandbox.paypal.com" : "https://api.paypal.com";

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const error = await response.json();
      return { accessToken: "", error: error.error_description || error.error };
    }

    const data = await response.json();
    return { accessToken: data.access_token };
  } catch (err) {
    return { accessToken: "", error: err.message };
  }
}

/**
 * Create a PayPal order
 */
async function createPayPalOrder(
  accessToken: string,
  request: PayPalPaymentRequest,
  sandbox: boolean = false
): Promise<{ orderId: string; approvalUrl?: string; error?: string }> {
  try {
    const baseUrl = sandbox ? "https://api.sandbox.paypal.com" : "https://api.paypal.com";

    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: request.currency,
              value: request.amount.toString(),
            },
            description: request.description || "POS Flow Payment",
            custom_id: request.sale_id || request.invoice_id || "posflow-payment",
            invoice_id: request.invoice_id,
          },
        ],
        payer: {
          email_address: request.customer_email,
        },
        application_context: {
          return_url: request.return_url,
          cancel_url: request.cancel_url,
          brand_name: "POS Flow",
          user_action: "PAY_NOW",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        orderId: "",
        error: error.details?.[0]?.issue || error.message || "Order creation failed",
      };
    }

    const order = await response.json();
    const approvalLink = order.links?.find((link: any) => link.rel === "approve");

    return {
      orderId: order.id,
      approvalUrl: approvalLink?.href,
    };
  } catch (err) {
    return { orderId: "", error: err.message };
  }
}

/**
 * Capture PayPal order (after user approves)
 */
async function capturePayPalOrder(
  accessToken: string,
  orderId: string,
  sandbox: boolean = false
): Promise<{ captureId: string; status: string; amount: number; error?: string }> {
  try {
    const baseUrl = sandbox ? "https://api.sandbox.paypal.com" : "https://api.paypal.com";

    const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment_source: {
          paypal: {},
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        captureId: "",
        status: "error",
        amount: 0,
        error: error.details?.[0]?.issue || error.message || "Capture failed",
      };
    }

    const order = await response.json();
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];

    if (!capture) {
      return {
        captureId: "",
        status: "error",
        amount: 0,
        error: "No capture found in response",
      };
    }

    return {
      captureId: capture.id,
      status: capture.status,
      amount: parseFloat(order.purchase_units[0].amount.value),
    };
  } catch (err) {
    return {
      captureId: "",
      status: "error",
      amount: 0,
      error: err.message,
    };
  }
}

/**
 * Refund PayPal capture
 */
async function refundPayPalCapture(
  accessToken: string,
  captureId: string,
  amount?: number,
  reason?: string,
  sandbox: boolean = false
): Promise<{ refundId: string; status: string; error?: string }> {
  try {
    const baseUrl = sandbox ? "https://api.sandbox.paypal.com" : "https://api.paypal.com";

    const body: Record<string, unknown> = {
      note_to_payer: reason || "Refund from POS Flow",
    };

    if (amount) {
      body.amount = {
        currency_code: "USD", // Should come from original transaction
        value: amount.toString(),
      };
    }

    const response = await fetch(`${baseUrl}/v2/payments/captures/${captureId}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        refundId: "",
        status: "error",
        error: error.details?.[0]?.issue || error.message || "Refund failed",
      };
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
 * Get PayPal credentials from database
 */
async function getPayPalCredentials(
  supabaseUrl: string,
  serviceRoleKey: string,
  connectionId: string,
  tenantId: string
): Promise<{ clientId?: string; clientSecret?: string; sandbox?: boolean; error?: string }> {
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
      return {
        clientId: parsed.client_id,
        clientSecret: parsed.secret,
        sandbox: parsed.sandbox !== false, // Default to sandbox
      };
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
    const action = url.searchParams.get("action") || "create_order";

    if (req.method === "POST") {
      const body = (await req.json()) as PayPalPaymentRequest | PayPalRefundRequest;

      if (!("connection_id" in body) || !("tenant_id" in body)) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get PayPal credentials
      const { clientId, clientSecret, sandbox, error: credError } =
        await getPayPalCredentials(supabaseUrl, serviceRoleKey, body.connection_id, body.tenant_id);

      if (credError || !clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ success: false, message: credError || "No PayPal credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get access token
      const { accessToken, error: tokenError } = await getPayPalAccessToken(
        clientId,
        clientSecret,
        sandbox
      );

      if (tokenError || !accessToken) {
        return new Response(
          JSON.stringify({ success: false, message: tokenError || "Failed to get access token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "create_order") {
        const paymentReq = body as PayPalPaymentRequest;
        const result = await createPayPalOrder(accessToken, paymentReq, sandbox);

        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            orderId: result.orderId,
            approvalUrl: result.approvalUrl,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "capture_order") {
        const orderId = url.searchParams.get("order_id");
        if (!orderId) {
          return new Response(
            JSON.stringify({ success: false, message: "Missing order_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await capturePayPalOrder(accessToken, orderId, sandbox);

        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            captureId: result.captureId,
            status: result.status,
            amount: result.amount,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "refund") {
        const refundReq = body as PayPalRefundRequest;
        const result = await refundPayPalCapture(
          accessToken,
          refundReq.capture_id,
          refundReq.amount,
          refundReq.reason,
          sandbox
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
    console.error("PayPal error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
