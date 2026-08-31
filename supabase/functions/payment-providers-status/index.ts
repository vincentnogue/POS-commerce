import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// "quand le client clique sur pay, uniquement les méthodes de paiement
// actives s'affichent, et le laisse le choix de PSP, ou alors si une
// seule méthode existe qu'il fasse avec" — SubscribePage used to
// hardcode a fixed Stripe/Flutterwave toggle regardless of whether either
// was actually configured. This reports which of the platform's 4
// billing PSPs (Stripe, Flutterwave, Paystack, PayUnit) have their secret
// key(s) actually set — a boolean only, the keys themselves never leave
// the server — so the checkout UI can show exactly the real, working
// choices and skip the picker entirely when only one exists.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const status = {
    stripe: !!Deno.env.get('STRIPE_SECRET_KEY'),
    flutterwave: !!Deno.env.get('FLUTTERWAVE_SECRET_KEY'),
    paystack: !!Deno.env.get('PAYSTACK_SECRET_KEY'),
    payunit: !!(Deno.env.get('PAYUNIT_API_KEY') && Deno.env.get('PAYUNIT_MERCHANT_ID')),
  };

  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
