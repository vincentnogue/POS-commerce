import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, verif-hash",
};

async function sb(supabaseUrl: string, key: string, path: string, init: RequestInit = {}) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const webhookSecretHash = Deno.env.get('FLUTTERWAVE_WEBHOOK_SECRET_HASH');
  const flwKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!webhookSecretHash || !flwKey || !supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Webhook not configured' }, 503);
  }

  try {
    // Unlike Stripe's HMAC signature, Flutterwave sends back the exact
    // secret hash you configured in their dashboard as a plain header —
    // a direct string comparison is what their own docs specify.
    const receivedHash = req.headers.get('verif-hash');
    if (!receivedHash || receivedHash !== webhookSecretHash) {
      return json({ error: 'Invalid signature' }, 401);
    }

    const event = await req.json();
    if (event.event !== 'charge.completed') {
      return json({ received: true }); // ignore anything else, acknowledged so FLW doesn't retry
    }

    const txId = event.data?.id;
    if (!txId) return json({ error: 'Missing transaction id' }, 400);

    // Never trust the webhook payload's own "status" field for something
    // this consequential — re-verify directly against Flutterwave's API
    // using our secret key, exactly as their integration guide requires.
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${txId}/verify`, {
      headers: { Authorization: `Bearer ${flwKey}` },
    });
    const verified = await verifyRes.json();
    const tx = verified?.data;

    if (!verifyRes.ok || tx?.status !== 'successful') {
      return json({ received: true, ignored: 'not successful on re-verification' });
    }

    const tenantId = tx.meta?.tenant_id;
    const planCode = tx.meta?.plan_code;
    const billing = tx.meta?.billing ?? 'monthly';
    if (!tenantId || !planCode) return json({ error: 'Missing tenant_id/plan_code in transaction meta' }, 400);

    const planRes = await sb(supabaseUrl, serviceRoleKey, `plans?code=eq.${planCode}&select=id,price_usd`);
    const planData = await planRes.json();
    const plan = planData?.[0];
    if (!plan) return json({ error: 'Unknown plan_code' }, 400);

    // Sanity check: paid amount should roughly match what that plan costs,
    // so a tampered/old tx_ref can't be replayed to activate a different
    // (cheaper) plan than what was actually paid for.
    const expectedAmount = billing === 'annual' ? plan.price_usd * 10 : plan.price_usd;
    if (Math.abs(Number(tx.amount) - expectedAmount) > 1) {
      return json({ error: 'Amount mismatch — refusing to activate subscription' }, 400);
    }

    const periodMs = billing === 'annual' ? 365 * 86400000 : 30 * 86400000;

    const upsertRes = await sb(supabaseUrl, serviceRoleKey, 'subscriptions?on_conflict=tenant_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        tenant_id: tenantId,
        plan_id: plan.id,
        status: 'active',
        billing_cycle: billing,
        payment_provider: 'flutterwave',
        flutterwave_tx_ref: tx.tx_ref,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + periodMs).toISOString(),
      }),
    });
    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      return json({ error: `Failed to activate subscription: ${errText}` }, 500);
    }

    // BUG FIX: same gap as the Stripe webhook — Marketplace and other
    // tenants.plan_id-based gates never saw a Flutterwave-paid upgrade,
    // since only public.subscriptions was written here. Sync it too, via
    // the service-role key this function already authenticates with.
    const tenantPatchRes = await sb(supabaseUrl, serviceRoleKey, `tenants?id=eq.${tenantId}`, {
      method: 'PATCH',
      body: JSON.stringify({ plan_id: plan.id }),
    });
    if (!tenantPatchRes.ok) {
      console.error('Failed to sync tenants.plan_id after Flutterwave payment:', await tenantPatchRes.text());
      // Non-fatal: the subscription itself is active and correctly
      // recorded; only the (already-being-phased-out) tenants.plan_id
      // mirror failed to sync. Don't fail the whole webhook over it.
    }

    return json({ received: true, activated: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
