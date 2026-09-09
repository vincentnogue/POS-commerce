import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// BUG FIX (real, confirmed): Stripe and Flutterwave both finalize a
// subscription via a real webhook (stripe-webhook, flutterwave-webhook).
// Paystack and PayUnit have no dedicated webhook function in this repo —
// their checkout functions redirect back to
// `${origin}/dashboard?upgraded=1`, but nothing anywhere ever read that
// query param to verify the payment and actually activate the
// subscription. A customer paying via Paystack or PayUnit would land on
// the dashboard having paid, with their plan never upgraded — the exact
// opposite of what was asked ("assure-toi que le client peut payer").
//
// This is the missing finalization step, triggered client-side right
// after the redirect (see DashboardPage.tsx), rather than a provider
// webhook — reasonable given neither provider has a webhook endpoint
// registered for this project. Re-verifies directly against each
// provider's own API using the platform's own credentials (mirroring
// exactly how flutterwave-webhook re-verifies rather than trusting the
// client), and applies the exact same amount-matching guard before
// writing anything.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FinalizeRequest {
  tenant_id: string;
  provider: "paystack" | "payunit" | "paddle";
  reference: string;
  plan_code: string;
  billing: "monthly" | "annual";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ success: false, message: "Server not configured" });

    const { tenant_id, provider, reference, plan_code, billing } = (await req.json()) as FinalizeRequest;
    if (!tenant_id || !provider || !reference || !plan_code || !billing) {
      return json({ success: false, message: "Missing required fields" });
    }

    // Same tenant-membership check as every other payment-adjacent
    // function fixed this session — the caller must actually belong to
    // the tenant they're finalizing a subscription for.
    const bearerToken = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${bearerToken}` } } });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData.user) return json({ success: false, message: "Non authentifié" });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerMember } = await adminClient
      .from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", callerData.user.id).maybeSingle();
    if (!callerMember) return json({ success: false, message: "Accès refusé pour ce tenant" });

    let paidAmount: number;
    let currency: string;

    // plan_code/billing are trusted from the frontend only for *routing*
    // (which plan row to compare against) — the actual authorization to
    // activate anything still comes from re-verifying the payment amount
    // against that plan's real price below. A caller passing a mismatched
    // plan_code just fails the amount check; they can't get a plan they
    // didn't pay for by lying about which one they claim to have bought.
    if (provider === "paystack") {
      const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (!paystackKey) return json({ success: false, message: "Paystack not configured" });

      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${paystackKey}` },
      });
      const verified = await verifyRes.json();
      if (!verifyRes.ok || verified?.data?.status !== "success") {
        return json({ success: false, message: "Paiement non confirmé par Paystack" });
      }
      paidAmount = Number(verified.data.amount) / 100; // Paystack uses the smallest currency unit
      currency = verified.data.currency;
    } else if (provider === "paddle") {
      // BUG FIX: paddle-checkout opens a Paddle.js overlay and there is no
      // Paddle webhook configured for this project — without this branch,
      // a Paddle payment was never actually confirmed server-side at all,
      // same class of bug as the Paystack/PayUnit gap above but for a
      // third provider. Re-verify directly against Paddle's own API.
      const paddleApiKey = Deno.env.get("PADDLE_API_KEY");
      if (!paddleApiKey) return json({ success: false, message: "Paddle not configured" });
      const paddleApiBase = Deno.env.get("PADDLE_SANDBOX") === "true"
        ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

      const verifyRes = await fetch(`${paddleApiBase}/transactions/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${paddleApiKey}` },
      });
      const verified = await verifyRes.json();
      const txData = verified?.data;
      if (!verifyRes.ok || txData?.status !== "completed") {
        return json({ success: false, message: "Paiement non confirmé par Paddle" });
      }
      // Defense in depth: this transaction's custom_data should match what
      // the frontend is now claiming — it was set server-side in
      // paddle-checkout, not by the client making this request.
      if (txData.custom_data?.tenant_id !== tenant_id || txData.custom_data?.plan_code !== plan_code) {
        return json({ success: false, message: "Transaction Paddle ne correspond pas à cette demande" });
      }
      // Unlike Paystack/PayUnit, the amount was never client-supplied at
      // any point — paddle-checkout resolved a fixed catalog price_id
      // server-side from our own PLAN_PRICES map, so there's no amount to
      // have tampered with. Still read the real charged total back from
      // Paddle (minor units, e.g. cents) rather than trusting anything
      // client-side, and let it flow through the same USD comparison below.
      const totalMinor = txData.details?.totals?.total ?? txData.details?.totals?.grand_total;
      if (!totalMinor) return json({ success: false, message: "Montant introuvable sur la transaction Paddle" });
      paidAmount = Number(totalMinor) / 100;
      currency = txData.currency_code ?? "USD";
    } else {
      const apiKey = Deno.env.get("PAYUNIT_API_KEY");
      const apiUsername = Deno.env.get("PAYUNIT_API_USERNAME");
      const apiPassword = Deno.env.get("PAYUNIT_API_PASSWORD");
      if (!apiKey || !apiUsername || !apiPassword) return json({ success: false, message: "PayUnit not configured" });
      const testMode = Deno.env.get("PAYUNIT_TEST_MODE") === "true";
      const basicAuth = btoa(`${apiUsername}:${apiPassword}`);

      // BUG FIX: same wrong-domain issue as payunit-checkout
      // ('api.payunit.net' doesn't resolve — real API is at
      // gateway.payunit.net), plus the wrong endpoint/auth scheme. Per
      // developer.payunit.net/rest-api/get-payment-status:
      //   GET {base}/api/gateway/paymentstatus/{transactionID}
      //   headers: x-api-key, mode, Authorization: Basic base64(user:pass)
      const verifyRes = await fetch(`https://gateway.payunit.net/api/gateway/paymentstatus/${encodeURIComponent(reference)}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'mode': testMode ? 'test' : 'live',
          'Authorization': `Basic ${basicAuth}`,
        },
      });
      const verified = await verifyRes.json();
      const txData = verified?.data;
      if (!verifyRes.ok || txData?.transaction_status !== "SUCCESS") {
        return json({ success: false, message: "Paiement non confirmé par PayUnit" });
      }
      // PayUnit's status response returns the amount as a plain number in
      // the transaction's own currency (unlike Paystack's smallest-unit
      // convention) — no /100 division here.
      paidAmount = Number(txData.transaction_amount);
      currency = txData.transaction_currency ?? "XAF";
    }

    const planRes = await fetch(`${supabaseUrl}/rest/v1/plans?code=eq.${plan_code}&select=id,price_usd`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const planData = await planRes.json();
    const plan = planData?.[0];
    if (!plan) return json({ success: false, message: "Plan inconnu" });

    // Same anti-tamper guard as flutterwave-webhook: refuse to activate if
    // the amount actually paid doesn't match what that plan+cycle costs.
    // PayUnit charges in XAF (it doesn't accept USD) while plans are priced
    // in USD, so the expected amount must be converted the same way
    // payunit-checkout converted it when creating the charge — comparing
    // raw USD to raw XAF would always mismatch and block every legitimate
    // PayUnit payment.
    const USD_TO_XAF_APPROX = 600;
    const expectedAmount = currency === "XAF"
      ? Math.round((billing === "annual" ? plan.price_usd * 10 : plan.price_usd) * USD_TO_XAF_APPROX)
      : (billing === "annual" ? plan.price_usd * 10 : plan.price_usd);
    const tolerance = currency === "XAF" ? expectedAmount * 0.05 : 1; // FX rate is approximate, allow 5% slack for XAF
    if (Math.abs(paidAmount - expectedAmount) > tolerance) {
      return json({ success: false, message: `Montant payé (${paidAmount} ${currency}) ne correspond pas au plan attendu` });
    }

    const periodMs = billing === "annual" ? 365 * 86400000 : 30 * 86400000;

    await fetch(`${supabaseUrl}/rest/v1/subscriptions?on_conflict=tenant_id`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        tenant_id, plan_id: plan.id, status: "active", billing_cycle: billing,
        payment_provider: provider,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + periodMs).toISOString(),
      }),
    });

    await fetch(`${supabaseUrl}/rest/v1/tenants?id=eq.${tenant_id}`, {
      method: "PATCH",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: plan.id }),
    });

    return json({ success: true });
  } catch (err) {
    return json({ success: false, message: `Server error: ${err.message}` });
  }
});
