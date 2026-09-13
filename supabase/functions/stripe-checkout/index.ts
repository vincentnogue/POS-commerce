import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

// BUG FIX: this used to point at 8 hardcoded Stripe Price IDs
// (price_1Tx76o...). Every other PSP in this project (Flutterwave,
// Paystack, PayUnit, Paddle) computes the charge dynamically from
// plans.price_usd — the single source of truth also used by plans.ts and
// updated by 0093_update_plan_pricing.sql. Stripe was the one exception,
// silently relying on Price objects that must exist, byte-for-byte, in
// the live Stripe account for these exact IDs — if they were never
// created there (or created in test mode while STRIPE_SECRET_KEY is a
// live key, or vice versa), Stripe checkout session creation fails with
// "No such price" and the customer never gets to pay. Stripe's Checkout
// Sessions API supports inline `price_data` for exactly this case, so we
// no longer need any pre-created Price object at all — mirrors the
// flutterwave-checkout/paystack-checkout/payunit-checkout pattern.
// (redeploy trigger: previous CI run failed at the setup-cli step, infra
// hiccup unrelated to this code — re-pushing to retrigger the workflow.)

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

    // SECURITY FIX: found while auditing every checkout function for the
    // same class of bug already fixed on stripe/mpesa/orange-money-
    // payments — this endpoint had ZERO authentication. Anyone (even
    // logged out) could pass any tenant_id, pay for a plan with their own
    // card, and have that OTHER tenant's subscription upgraded by
    // stripe-webhook reading metadata.tenant_id — nothing here ever
    // verified the caller actually belongs to that tenant.
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

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Payment system not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Amount comes from the `plans` table (single source of truth) rather
    // than a hardcoded copy — plans.ts, the plans DB table, and every
    // other checkout function all read the same numbers.
    const planRes = await fetch(`${supabaseUrl}/rest/v1/plans?code=eq.${plan_code}&select=price_usd,name`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const planRows = await planRes.json();
    const monthlyPrice = planRows?.[0]?.price_usd;
    const planName = planRows?.[0]?.name ?? plan_code;
    if (!monthlyPrice) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Annual = 10x monthly charged once a year (2 months free), same
    // convention as annualPrice() in src/lib/plans.ts and every other PSP.
    const unitAmountCents = Math.round((billing === 'annual' ? monthlyPrice * 10 : monthlyPrice) * 100);
    const recurringInterval = billing === 'annual' ? 'year' : 'month';

    const session = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'subscription',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(unitAmountCents),
        'line_items[0][price_data][recurring][interval]': recurringInterval,
        'line_items[0][price_data][product_data][name]': `POS Flow — ${planName} (${billing === 'annual' ? 'annuel' : 'mensuel'})`,
        'line_items[0][quantity]': '1',
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
