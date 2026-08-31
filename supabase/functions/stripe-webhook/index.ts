import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Stripe signs webhooks as: t=<timestamp>,v1=<hex hmac-sha256 of "<timestamp>.<body>">
// We must verify this locally — Stripe has no "verify signature" API endpoint.
// Tolerance window (in seconds) to reject replayed/old events, same default as Stripe's own libraries.
const TOLERANCE_SECONDS = 300;

async function verifyStripeSignature(payload: string, sigHeader: string | null, secret: string): Promise<boolean> {
  if (!sigHeader) return false;

  const parts = Object.fromEntries(
    sigHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k, v];
    })
  );
  const timestamp = parts['t'];
  const expectedSig = parts['v1'];
  if (!timestamp || !expectedSig) return false;

  // Reject events with a timestamp too far in the past (or future) — mitigates replay attacks.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const signedPayload = `${timestamp}.${payload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison to avoid timing attacks.
  if (computedSig.length !== expectedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computedSig.length; i++) {
    mismatch |= computedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return mismatch === 0;
}

async function supabaseRest(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  init: RequestInit = {}
) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(body);

    switch (event.type) {
      // Fired right after a successful checkout — activate the subscription.
      case 'checkout.session.completed': {
        const session = event.data.object;
        const tenantId = session.client_reference_id ?? session.metadata?.tenant_id;
        const planCode = session.metadata?.plan_code;
        const billing = session.metadata?.billing ?? 'monthly';
        const stripeCustomerId = session.customer;
        const stripeSubId = session.subscription;

        if (tenantId) {
          const planRes = await supabaseRest(
            supabaseUrl, serviceRoleKey,
            `plans?code=eq.${planCode}&select=id`
          );
          const planData = await planRes.json();
          const planId = planData[0]?.id;

          await supabaseRest(
            supabaseUrl, serviceRoleKey,
            `subscriptions?on_conflict=tenant_id`,
            {
              method: 'POST',
              headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
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
            }
          );

          // BUG FIX: this used to only write public.subscriptions. Plan-gated
          // UI (e.g. Marketplace's feature locking) reads tenants.plan_id,
          // which was never updated here — a customer completing checkout
          // for the first time via this Stripe Checkout flow would see their
          // subscription recorded as active, yet the Marketplace (and any
          // other tenants.plan_id-based gate) would still show them on
          // their old/default plan forever, since nothing ever synced this
          // column after initial tenant creation. supabase/functions/
          // stripe-subscriptions already does this correctly for its own
          // (separate) upgrade path — mirroring that here with the same
          // service-role write.
          if (planId) {
            await supabaseRest(
              supabaseUrl, serviceRoleKey,
              `tenants?id=eq.${tenantId}`,
              {
                method: 'PATCH',
                body: JSON.stringify({ plan_id: planId }),
              }
            );
          }
        }
        break;
      }

      // Fired on every successful renewal payment — extends the current period.
      case 'invoice.paid': {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;
        const periodEnd = invoice.lines?.data?.[0]?.period?.end;
        if (stripeSubId) {
          await supabaseRest(
            supabaseUrl, serviceRoleKey,
            `subscriptions?stripe_subscription_id=eq.${stripeSubId}`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                status: 'active',
                current_period_start: new Date().toISOString(),
                ...(periodEnd ? { current_period_end: new Date(periodEnd * 1000).toISOString() } : {}),
              }),
            }
          );
        }
        break;
      }

      // Card declined / renewal payment failed — mark past_due (grace period, still has access
      // per tenant_access_active()) instead of cutting access off immediately.
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;
        if (stripeSubId) {
          await supabaseRest(
            supabaseUrl, serviceRoleKey,
            `subscriptions?stripe_subscription_id=eq.${stripeSubId}`,
            { method: 'PATCH', body: JSON.stringify({ status: 'past_due' }) }
          );
        }
        break;
      }

      // Plan change, cancel-at-period-end toggle, etc.
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await supabaseRest(
          supabaseUrl, serviceRoleKey,
          `subscriptions?stripe_subscription_id=eq.${sub.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              status: sub.status === 'trialing' ? 'trialing' : sub.status,
              cancel_at_period_end: !!sub.cancel_at_period_end,
              current_period_end: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : undefined,
            }),
          }
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabaseRest(
          supabaseUrl, serviceRoleKey,
          `subscriptions?stripe_subscription_id=eq.${sub.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ status: 'canceled', canceled_at: new Date().toISOString() }),
          }
        );
        break;
      }

      default:
        // Unhandled event types are ignored but still acknowledged (200) so Stripe doesn't retry.
        break;
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
