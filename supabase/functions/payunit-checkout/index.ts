import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Platform-level subscription checkout via PayUnit — same pattern as
// paystack-checkout/flutterwave-checkout/stripe-checkout. Uses
// PAYUNIT_API_KEY / PAYUNIT_MERCHANT_ID (platform-level secrets, distinct
// from a tenant's own PayUnit connection used for their customer-facing
// POS payments in supabase/functions/payunit-payments).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const merchantId = Deno.env.get('PAYUNIT_MERCHANT_ID');
    const testMode = Deno.env.get('PAYUNIT_TEST_MODE') === 'true';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!apiKey || !merchantId || !supabaseUrl || !serviceRoleKey) return json({ error: 'Payment system not configured' }, 503);

    // SECURITY FIX: same audit/fix as stripe-checkout — zero
    // authentication before this meant anyone could pass any tenant_id
    // and have THAT tenant's subscription upgraded by paying with their
    // own card.
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

    const amount = billing === 'annual' ? monthlyPrice * 10 : monthlyPrice;
    const reference = `posflow_${tenant_id}_${Date.now()}`;
    const baseUrl = testMode ? 'https://api.sandbox.payunit.net/v1' : 'https://api.payunit.net/v1';

    const res = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: Math.round(amount * 100),
        currency: 'USD',
        email: customer_email,
        description: `POS Flow — abonnement ${plan_code} (${billing === 'annual' ? 'annuel' : 'mensuel'})`,
        reference,
        metadata: { tenant_id, plan_code, billing },
        redirect_url: success_url,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `PayUnit error: ${res.status} ${errText}` }, 502);
    }
    const data = await res.json();
    if (!data.payment_url) return json({ error: 'PayUnit did not return a payment URL' }, 502);

    return json({ url: data.payment_url });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
