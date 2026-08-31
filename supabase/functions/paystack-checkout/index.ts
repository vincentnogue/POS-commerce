import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Platform-level subscription checkout via Paystack — mirrors
// flutterwave-checkout/stripe-checkout exactly (same request shape, same
// "plans table is the single source of truth for price" pattern, same
// 503 "not configured" response when PAYSTACK_SECRET_KEY isn't set, which
// is also how payment-providers-status decides whether to offer this PSP
// as a choice at all).
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

    const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!paystackKey || !supabaseUrl || !serviceRoleKey) return json({ error: 'Payment system not configured' }, 503);

    const planRes = await fetch(`${supabaseUrl}/rest/v1/plans?code=eq.${plan_code}&select=price_usd`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const planRows = await planRes.json();
    const monthlyPrice = planRows?.[0]?.price_usd;
    if (!monthlyPrice) return json({ error: 'Invalid plan' }, 400);

    const amount = billing === 'annual' ? monthlyPrice * 10 : monthlyPrice;
    const reference = `posflow-${tenant_id}-${Date.now()}`;

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: customer_email,
        // Paystack expects the smallest currency unit; platform billing is
        // USD, so cents.
        amount: Math.round(amount * 100),
        currency: 'USD',
        reference,
        callback_url: success_url,
        metadata: { tenant_id, plan_code, billing },
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.status) {
      return json({ error: data.message ?? 'Paystack error' }, 502);
    }

    return json({ url: data.data.authorization_url });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
