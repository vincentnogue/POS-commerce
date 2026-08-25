import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface MpesaPaymentRequest {
  tenant_id: string;
  connection_id: string;
  amount: number;
  phone_number: string; // Customer phone (e.g., 254712345678)
  account_reference: string; // Bill reference/description
  metadata?: Record<string, string>;
  sale_id?: string;
  invoice_id?: string;
}

interface MpesaQueryRequest {
  tenant_id: string;
  connection_id: string;
  checkout_request_id: string;
}

/**
 * Initiate M-Pesa STK Push (Lipa Na M-Pesa Online)
 * Sends payment prompt to customer's phone
 */
async function initiateMpesaStkPush(
  consumerKey: string,
  consumerSecret: string,
  shortCode: string,
  passkey: string,
  timestamp: string,
  request: MpesaPaymentRequest
): Promise<{ checkoutRequestId?: string; responseCode?: string; error?: string }> {
  try {
    // Generate password (base64 encoded: shortCode + passkey + timestamp)
    const password = btoa(`${shortCode}${passkey}${timestamp}`);

    // Generate access token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenResponse = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!tokenResponse.ok) {
      return { error: "Failed to generate access token" };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Initiate STK Push
    const stkResponse = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: Math.round(request.amount),
          PartyA: request.phone_number,
          PartyB: shortCode,
          PhoneNumber: request.phone_number,
          CallBackURL: "https://api.posflow.io/v1/integrations/mpesa/callback",
          AccountReference: request.account_reference,
          TransactionDesc: `POS Flow Payment - ${request.account_reference}`,
        }),
      }
    );

    if (!stkResponse.ok) {
      const error = await stkResponse.json();
      return { error: error.errorMessage || "STK Push failed" };
    }

    const stkData = await stkResponse.json();
    return {
      checkoutRequestId: stkData.CheckoutRequestID,
      responseCode: stkData.ResponseCode,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Query M-Pesa transaction status
 */
async function queryMpesaTransaction(
  consumerKey: string,
  consumerSecret: string,
  shortCode: string,
  checkoutRequestId: string,
  timestamp: string
): Promise<{ status: string; amount: number; resultCode?: string; error?: string }> {
  try {
    // Generate access token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenResponse = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!tokenResponse.ok) {
      return { status: "error", amount: 0, error: "Failed to generate access token" };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Query transaction
    const queryResponse = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortCode,
          CheckoutRequestID: checkoutRequestId,
          Timestamp: timestamp,
          Password: btoa(`${shortCode}${checkoutRequestId}${timestamp}`),
        }),
      }
    );

    if (!queryResponse.ok) {
      const error = await queryResponse.json();
      return { status: "error", amount: 0, error: error.errorMessage };
    }

    const queryData = await queryResponse.json();
    return {
      status: queryData.ResultCode === "0" ? "succeeded" : "pending",
      amount: queryData.CallbackMetadata?.Amount || 0,
      resultCode: queryData.ResultCode,
    };
  } catch (err) {
    return { status: "error", amount: 0, error: err.message };
  }
}

/**
 * Get M-Pesa credentials from database
 */
async function getMpesaCredentials(
  supabaseUrl: string,
  serviceRoleKey: string,
  connectionId: string,
  tenantId: string
): Promise<{ consumerKey?: string; consumerSecret?: string; shortCode?: string; passkey?: string; error?: string }> {
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
        consumerKey: parsed.consumer_key,
        consumerSecret: parsed.consumer_secret,
        shortCode: parsed.short_code,
        passkey: parsed.passkey,
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
    const action = url.searchParams.get("action") || "initiate_stk_push";

    if (req.method === "POST") {
      const body = (await req.json()) as MpesaPaymentRequest | MpesaQueryRequest;

      if (!("connection_id" in body) || !("tenant_id" in body)) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get M-Pesa credentials
      const { consumerKey, consumerSecret, shortCode, passkey, error: credError } =
        await getMpesaCredentials(supabaseUrl, serviceRoleKey, body.connection_id, body.tenant_id);

      if (credError || !consumerKey || !consumerSecret || !shortCode || !passkey) {
        return new Response(
          JSON.stringify({
            success: false,
            message: credError || "No M-Pesa credentials",
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const timestamp = new Date().toISOString().replace(/[:-]/g, "").split(".")[0];

      if (action === "initiate_stk_push") {
        const paymentReq = body as MpesaPaymentRequest;
        const result = await initiateMpesaStkPush(
          consumerKey,
          consumerSecret,
          shortCode,
          passkey,
          timestamp,
          paymentReq
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
            checkoutRequestId: result.checkoutRequestId,
            responseCode: result.responseCode,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "query_transaction") {
        const queryReq = body as MpesaQueryRequest;
        const result = await queryMpesaTransaction(
          consumerKey,
          consumerSecret,
          shortCode,
          queryReq.checkout_request_id,
          timestamp
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
            status: result.status,
            amount: result.amount,
            resultCode: result.resultCode,
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
    console.error("M-Pesa error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
