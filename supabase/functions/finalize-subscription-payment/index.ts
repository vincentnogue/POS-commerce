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
  provider: "paystack" | "payunit";
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
    } else {
      const apiKey = Deno.env.get("PAYUNIT_API_KEY");
      if (!apiKey) return json({ success: false, message: "PayUnit not configured" });
      const testMode = Deno.env.get("PAYUNIT_TEST_MODE") === "true";
      const baseUrl = testMode ? "https://api.sandbox.payunit.net/v1" : "https://api.payunit.net/v1";

      const verifyRes = await fetch(`${baseUrl}/transactions/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const verified = await verifyRes.json();
      if (!verifyRes.ok || !["completed", "success", "successful"].includes(verified?.status)) {
        return json({ success: false, message: "Paiement non confirmé par PayUnit" });
      }
      // Same convention as payunit-payments' own verifyPayment: PayUnit
      // returns the amount in the smallest currency unit.
      paidAmount = Number(verified.amount) / 100;
      currency = verified.currency ?? "XAF";
    }

    const planRes = await fetch(`${supabaseUrl}/rest/v1/plans?code=eq.${plan_code}&select=id,price_usd`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const planData = await planRes.json();
    const plan = planData?.[0];
    if (!plan) return json({ success: false, message: "Plan inconnu" });

    // Same anti-tamper guard as flutterwave-webhook: refuse to activate if
    // the amount actually paid doesn't match what that plan+cycle costs.
    const expectedAmount = billing === "annual" ? plan.price_usd * 10 : plan.price_usd;
    if (Math.abs(paidAmount - expectedAmount) > 1) {
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
