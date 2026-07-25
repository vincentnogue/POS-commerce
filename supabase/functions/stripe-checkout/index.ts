import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CheckoutRequest {
  plan_code: string;
  billing: 'monthly' | 'annual';
  tenant_id: string;
  success_url: string;
  cancel_url: string;
}

const PLAN_PRICES: Record<string, { monthly: string; annual: string }> = {
  starter: { monthly: 'price_1Tx76oRhcVRS1qEcwt7F4RSF', annual: 'price_1Tx76oRhcVRS1qEcYbfeqVmb' },
  pro: { monthly: 'price_1Tx76pRhcVRS1qEcvsxmVnsg', annual: 'price_1Tx76pRhcVRS1qEcT465gctn' },
  premium: { monthly: 'price_1Tx76qRhcVRS1qEckBhi5j55', annual: 'price_1Tx76qRhcVRS1qEcdI6q1J7F' },
  entreprise: { monthly: 'price_1Tx76rRhcVRS1qEcTywcmgel', annual: 'price_1Tx76rRhcVRS1qEcd8zOItdT' },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { plan_code, billing, tenant_id, success_url, cancel_url } = await req.json() as CheckoutRequest;

    if (!plan_code || !tenant_id) {
      return new Response(JSON.stringify({ error: 'Missing plan_code or tenant_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Payment system not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceMap = PLAN_PRICES[plan_code];
    if (!priceMap) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceId = billing === 'annual' ? priceMap.annual : priceMap.monthly;

    const session = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'subscription',
        'line_items[0][price]': priceId,
        'success_url': success_url,
        'cancel_url': cancel_url,
        'client_reference_id': tenant_id,
        'metadata[tenant_id]': tenant_id,
        'metadata[plan_code]': plan_code,
        'metadata[billing]': billing,
      }),
    });

    const sessionData = await session.json();

    if (!session.ok) {
      return new Response(JSON.stringify({ error: sessionData.error?.message ?? 'Stripe error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ url: sessionData.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
