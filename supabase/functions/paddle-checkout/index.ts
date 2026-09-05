import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Real Paddle Billing API integration (api.paddle.com/transactions), same
// posture as stripe-checkout/flutterwave-checkout: no fake data, no
// invented endpoint. Paddle positions itself as "Subscriptions, Payments &
// Tax Compliance for SaaS" — merchant-of-record billing that handles
// VAT/sales tax on our behalf, which is why it's being added specifically
// as a platform PSP (billing the tenant for THEIR POS Flow subscription),
// not as a tenant-facing checkout option for the tenant's own customers.
//
// Unlike Stripe here (which uses pre-created Stripe Price IDs — meaning a
// real Stripe account was already configured with those exact prices),
// there is no existing Paddle catalog to point at. Paddle's transactions
// API supports "non-catalog" items — an inline price object with its own
// unit_price and product info — specifically for cases like this where
// prices are computed dynamically rather than pre-created in a dashboard.
// See: https://developer.paddle.com/build/transactions/bill-create-custom-items-prices-products
//
// This creates a *draft* transaction only (no customer/address attached
// yet) and returns its id; the frontend passes that id to Paddle.js's
// overlay checkout (Paddle.Checkout.open({ transactionId })), which is
// how Paddle Billing checkouts work — there is no plain hosted-checkout
// URL to redirect to the way Stripe/Flutterwave provide one.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CheckoutRequest {
  plan_code: string;
  plan_name: string;
  billing: 'monthly' | 'annual';
  amount_usd: number;
  tenant_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { plan_code, plan_name, billing, amount_usd, tenant_id } = await req.json() as CheckoutRequest;

    if (!plan_code || !tenant_id || !amount_usd) {
      return new Response(JSON.stringify({ error: 'Missing plan_code, amount_usd or tenant_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paddleApiKey = Deno.env.get('PADDLE_API_KEY');
    const paddleApiBase = Deno.env.get('PADDLE_SANDBOX') === 'true'
      ? 'https://sandbox-api.paddle.com'
      : 'https://api.paddle.com';

    if (!paddleApiKey) {
      return new Response(JSON.stringify({ error: 'Payment system not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SECURITY FIX: found while auditing every checkout function for the
    // same missing-auth bug already fixed on stripe/flutterwave/paystack/
    // payunit-checkout — this function (which I wrote earlier this
    // session) had the exact same gap: zero authentication, so anyone
    // could pass any tenant_id and have that tenant's subscription
    // upgraded once they completed the Paddle checkout themselves.
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const bearerToken = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${bearerToken}` } } });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData.user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerMember } = await adminClient
      .from('tenant_members').select('id').eq('tenant_id', tenant_id).eq('user_id', callerData.user.id).maybeSingle();
    if (!callerMember) {
      return new Response(JSON.stringify({ error: 'Accès refusé pour ce tenant' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Paddle amounts are strings in the currency's lowest denomination
    // (cents for USD) — 24.99 -> "2499".
    const unitAmountMinor = String(Math.round(amount_usd * 100));

    const res = await fetch(`${paddleApiBase}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paddleApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            quantity: 1,
            price: {
              description: `POS Flow — ${plan_name} (${billing === 'annual' ? 'annual' : 'monthly'})`,
              name: `${plan_name} — ${billing === 'annual' ? 'Annual' : 'Monthly'}`,
              billing_cycle: { interval: billing === 'annual' ? 'year' : 'month', frequency: 1 },
              unit_price: { amount: unitAmountMinor, currency_code: 'USD' },
              product: {
                name: `POS Flow ${plan_name}`,
                tax_category: 'saas',
                description: 'POS Flow subscription',
              },
            },
          },
        ],
        currency_code: 'USD',
        custom_data: { tenant_id, plan_code, billing },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error?.detail ?? data.error?.type ?? 'Paddle error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ transaction_id: data.data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
