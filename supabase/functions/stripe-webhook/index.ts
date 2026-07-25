import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    // Verify webhook signature
    const verifyRes = await fetch('https://api.stripe.com/v1/webhooks/endpoints/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: body, signature, secret: webhookSecret }),
    });

    if (!verifyRes.ok) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(body);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const tenantId = session.client_reference_id ?? session.metadata?.tenant_id;
      const planCode = session.metadata?.plan_code;
      const billing = session.metadata?.billing ?? 'monthly';
      const stripeCustomerId = session.customer;
      const stripeSubId = session.subscription;

      if (tenantId) {
        // Find plan
        const planRes = await fetch(`${supabaseUrl}/rest/v1/plans?code=eq.${planCode}&select=id,price_usd`, {
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` },
        });
        const planData = await planRes.json();
        const planId = planData[0]?.id;

        // Upsert subscription
        await fetch(`${supabaseUrl}/rest/v1/subscriptions?tenant_id=eq.${tenantId}`, {
          method: 'POST',
          headers: {
            'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json', 'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            plan_id: planId,
            status: 'active',
            billing_cycle: billing,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubId,
            current_period_start: new Date().toISOString(),
            current_period_end: billing === 'annual'
              ? new Date(Date.now() + 365 * 86400000).toISOString()
              : new Date(Date.now() + 30 * 86400000).toISOString(),
          }),
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const stripeSubId = sub.id;
      await fetch(`${supabaseUrl}/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubId}`, {
        method: 'PATCH',
        headers: {
          'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ status: 'canceled', canceled_at: new Date().toISOString() }),
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
