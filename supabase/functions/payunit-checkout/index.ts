import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Platform-level subscription checkout via PayUnit — same pattern as
// paystack-checkout/flutterwave-checkout/stripe-checkout. Uses
// PAYUNIT_API_KEY / PAYUNIT_API_USERNAME / PAYUNIT_API_PASSWORD
// (platform-level secrets, distinct from a tenant's own PayUnit connection
// used for their customer-facing POS payments in payunit-payments).
//
// BUG FIX (found via developer.payunit.net/rest-api/initialize-payment,
// the official reference — the previous version invented both the domain
// and the auth scheme):
//   - Base URL was 'https://api.payunit.net' (doesn't resolve — DNS
//     failure). The real API lives at 'https://gateway.payunit.net'.
//   - Endpoint was '/v1/transactions' with a Bearer token and a
//     'merchant_id' field. The real endpoint is '/api/gateway/initialize',
//     authenticated with an 'x-api-key' header AND HTTP Basic auth
//     (api_username:api_password) — PayUnit has no separate merchant_id
//     concept for this call at all.
//   - PayUnit's sample payloads are all in XAF (it's a Cameroon/CEMAC-
//     focused gateway) — USD is very unlikely to be accepted. We convert
//     the plan's USD price to XAF using a fixed approximate rate since we
//     have no live FX source here; this is noted to the merchant as a
//     known limitation, not a precise conversion.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Approximate, non-live USD -> XAF rate. Real-world rate fluctuates around
// 580-620; if precision matters, replace with a live FX lookup.
const USD_TO_XAF_APPROX = 600;

interface CheckoutRequest {
  plan_code: string;
  billing: 'monthly' | 'annual';
  tenant_id: string;
  customer_email: string;
  customer_name: string;
  success_url: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { plan_code, billing, tenant_id, customer_email, success_url } = await req.json() as CheckoutRequest;
    if (!plan_code || !tenant_id || !customer_email) return json({ error: 'Missing plan_code, tenant_id or customer_email' }, 400);

    const apiKey = Deno.env.get('PAYUNIT_API_KEY');
    const apiUsername = Deno.env.get('PAYUNIT_API_USERNAME');
    const apiPassword = Deno.env.get('PAYUNIT_API_PASSWORD');
    const testMode = Deno.env.get('PAYUNIT_TEST_MODE') === 'true';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!apiKey || !apiUsername || !apiPassword || !supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Payment system not configured (missing PAYUNIT_API_KEY / PAYUNIT_API_USERNAME / PAYUNIT_API_PASSWORD)' }, 503);
    }

    // Same auth/tenant-ownership check as stripe-checkout: never trust a
    // caller-supplied tenant_id without verifying they actually belong to it.
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!anonKey) return json({ error: 'Server not configured' }, 503);
    const bearerToken = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${bearerToken}` } } });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData.user) return json({ error: 'Non authentifié' }, 401);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerMember } = await adminClient
      .from('tenant_members').select('id').eq('tenant_id', tenant_id).eq('user_id', callerData.user.id).maybeSingle();
    if (!callerMember) return json({ error: 'Accès refusé pour ce tenant' }, 403);

    const planRes = await fetch(`${supabaseUrl}/rest/v1/plans?code=eq.${plan_code}&select=price_usd`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const planRows = await planRes.json();
    const monthlyPrice = planRows?.[0]?.price_usd;
    if (!monthlyPrice) return json({ error: 'Invalid plan' }, 400);

    const amountUsd = billing === 'annual' ? monthlyPrice * 10 : monthlyPrice;
    const amountXaf = Math.round(amountUsd * USD_TO_XAF_APPROX);
    const transactionId = `posflow${Date.now()}`.slice(0, 20);

    const basicAuth = btoa(`${apiUsername}:${apiPassword}`);
    const baseUrl = 'https://gateway.payunit.net'; // same for test/live — the "mode" header controls the environment

    const res = await fetch(`${baseUrl}/api/gateway/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'mode': testMode ? 'test' : 'live',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        total_amount: amountXaf,
        currency: 'XAF',
        transaction_id: transactionId,
        return_url: success_url,
        notify_url: success_url,
        payment_country: 'CM',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `PayUnit error: ${res.status} ${errText}` }, 502);
    }
    const data = await res.json();
    // PayUnit's own SDK/docs are inconsistent about the exact field name for
    // the redirect link across their products — check the ones actually
    // observed (transaction_url, payment_url) at both top level and nested
    // under "data".
    const redirectUrl = data?.data?.transaction_url ?? data?.transaction_url ?? data?.data?.payment_url ?? data?.payment_url;
    if (!redirectUrl) return json({ error: 'PayUnit did not return a payment URL', raw: data }, 502);

    return json({ url: redirectUrl, reference: transactionId });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
