import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface OrangeMoneyPaymentRequest {
  tenant_id: string;
  connection_id: string;
  customer_phone: string; // Format: 2250700000000 (Ivory Coast example)
  amount: number;
  currency: string; // XOF, XAF, etc
  description: string;
  merchant_reference: string;
  country_code: string; // CI, SN, ML, BJ, TG, etc
  sale_id?: string;
  invoice_id?: string;
}

interface OrangeMoneyRefundRequest {
  tenant_id: string;
  connection_id: string;
  transaction_id: string;
  amount?: number;
}

/**
 * Initiate Orange Money payment
 */
async function initiateOrangeMoneyPayment(
  apiKey: string,
  clientId: string,
  clientSecret: string,
  request: OrangeMoneyPaymentRequest
): Promise<{ paymentId?: string; status?: string; error?: string }> {
  try {
    // Get OAuth token
    const tokenResponse = await fetch("https://api.orange.com/oauth/v3/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      return { error: "Failed to get access token" };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Create payment request
    const paymentResponse = await fetch(
      "https://api.orange.com/orange-money-webpay/cm/v1/payment/request",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          merchant_key: clientId,
          currency: request.currency,
          order_id: request.merchant_reference,
          amount: request.amount,
          return_url: "https://posflow.app/payment/callback",
          notif_url: "https://api.posflow.io/webhooks/orange-money",
          lang: "fr",
          customer_phone: request.customer_phone,
          description: request.description,
        }),
      }
    );

    if (!paymentResponse.ok) {
      const error = await paymentResponse.json();
      return { error: error.message || "Payment request failed" };
    }

    const paymentData = await paymentResponse.json();
    return {
      paymentId: paymentData.id,
      status: paymentData.status,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Check Orange Money payment status
 */
async function checkOrangeMoneyStatus(
  apiKey: string,
  clientId: string,
  clientSecret: string,
  paymentId: string
): Promise<{ status: string; amount: number; error?: string }> {
  try {
    // Get OAuth token
    const tokenResponse = await fetch("https://api.orange.com/oauth/v3/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      return { status: "error", amount: 0, error: "Failed to get access token" };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Check payment status
    const statusResponse = await fetch(
      `https://api.orange.com/orange-money-webpay/cm/v1/payment/status/${paymentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-API-Key": apiKey,
        },
      }
    );

    if (!statusResponse.ok) {
      const error = await statusResponse.json();
      return { status: "error", amount: 0, error: error.message };
    }

    const statusData = await statusResponse.json();
    return {
      status: statusData.status === "ACCEPTED" ? "succeeded" : "pending",
      amount: statusData.amount || 0,
    };
  } catch (err) {
    return { status: "error", amount: 0, error: err.message };
  }
}

/**
 * Refund Orange Money payment
 */
async function refundOrangeMoneyPayment(
  apiKey: string,
  clientId: string,
  clientSecret: string,
  transactionId: string,
  amount?: number
): Promise<{ refundId?: string; status?: string; error?: string }> {
  try {
    // Get OAuth token
    const tokenResponse = await fetch("https://api.orange.com/oauth/v3/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      return { error: "Failed to get access token" };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Initiate refund
    const refundResponse = await fetch(
      "https://api.orange.com/orange-money-webpay/cm/v1/payment/refund",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          order_id: transactionId,
          amount: amount || undefined,
        }),
      }
    );

    if (!refundResponse.ok) {
      const error = await refundResponse.json();
      return { error: error.message || "Refund failed" };
    }

    const refundData = await refundResponse.json();
    return {
      refundId: refundData.id,
      status: refundData.status,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Get Orange Money credentials
 */
async function getOrangeMoneyCredentials(
  supabaseUrl: string,
  serviceRoleKey: string,
  connectionId: string,
  tenantId: string
): Promise<{ apiKey?: string; clientId?: string; clientSecret?: string; error?: string }> {
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
        clientId: parsed.client_id,
        clientSecret: parsed.client_secret,
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
    const action = url.searchParams.get("action") || "initiate_payment";

    if (req.method === "POST") {
      const body = (await req.json()) as OrangeMoneyPaymentRequest | OrangeMoneyRefundRequest;

      if (!("connection_id" in body) || !("tenant_id" in body)) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY FIX: same pattern as stripe-payments/flutterwave-payments/
      // paystack-payments/payunit-payments/mpesa-payments — zero
      // authentication check before this, meaning any authenticated
      // caller could pass ANY tenant_id and initiate a payment (or issue
      // a refund) against a different tenant's Orange Money account.
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const bearerToken = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
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
        .eq("tenant_id", body.tenant_id)
        .eq("user_id", callerData.user.id)
        .maybeSingle();
      if (!callerMember) {
        return new Response(
          JSON.stringify({ success: false, message: "Accès refusé pour ce tenant" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (action === "refund" && !["admin", "manager", "super_admin"].includes(callerMember.role)) {
        return new Response(
          JSON.stringify({ success: false, message: "Permission insuffisante pour un remboursement" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get Orange Money credentials
      const { apiKey, clientId, clientSecret, error: credError } =
        await getOrangeMoneyCredentials(supabaseUrl, serviceRoleKey, body.connection_id, body.tenant_id);

      if (credError || !apiKey || !clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ success: false, message: credError || "No Orange Money credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "initiate_payment") {
        const paymentReq = body as OrangeMoneyPaymentRequest;
        const result = await initiateOrangeMoneyPayment(apiKey, clientId, clientSecret, paymentReq);

        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            paymentId: result.paymentId,
            status: result.status,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "check_status") {
        const paymentId = url.searchParams.get("payment_id");
        if (!paymentId) {
          return new Response(
            JSON.stringify({ success: false, message: "Missing payment_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await checkOrangeMoneyStatus(apiKey, clientId, clientSecret, paymentId);

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
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "refund") {
        const refundReq = body as OrangeMoneyRefundRequest;
        const result = await refundOrangeMoneyPayment(
          apiKey,
          clientId,
          clientSecret,
          refundReq.transaction_id,
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
    console.error("Orange Money error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
