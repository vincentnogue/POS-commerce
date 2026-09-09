import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// "quand le client clique sur pay, uniquement les méthodes de paiement
// actives s'affichent, et le laisse le choix de PSP, ou alors si une
// seule méthode existe qu'il fasse avec" — SubscribePage used to
// hardcode a fixed Stripe/Flutterwave toggle regardless of whether either
// was actually configured. This reports which of the platform's 5
// billing PSPs (Stripe, Flutterwave, Paystack, PayUnit, Paddle) have their
// secret key(s) actually set — a boolean only, the keys themselves never
// leave the server — so the checkout UI can show exactly the real, working
// choices and skip the picker entirely when only one exists.
//
// Paddle also needs its *client-side* token (a publishable identifier,
// not a secret — this is the "Client-side Token" from Paddle's dashboard,
// distinct from PADDLE_API_KEY) so Paddle.js can open the overlay
// checkout in the browser. Safe to return in this same response.
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
    payunit: !!(Deno.env.get('PAYUNIT_API_KEY') && Deno.env.get('PAYUNIT_API_USERNAME') && Deno.env.get('PAYUNIT_API_PASSWORD')),
    paddle: !!(Deno.env.get('PADDLE_API_KEY') && Deno.env.get('PADDLE_CLIENT_TOKEN')),
    paddle_client_token: Deno.env.get('PADDLE_CLIENT_TOKEN') ?? null,
    paddle_sandbox: Deno.env.get('PADDLE_SANDBOX') === 'true',
  };

  return new Response(JSON.stringify(status), {
    status: 200,
    // BUG FIX: this endpoint's entire purpose is to reflect the *current*
    // state of the platform's payment secrets — without an explicit
    // no-store directive, a browser (or any CDN/proxy in front of the
    // function) can legitimately cache a GET response and keep serving
    // it after a merchant adds a missing secret (e.g. PAYUNIT_MERCHANT_ID)
    // in the Supabase dashboard, making the "no payment method
    // configured" message persist even though the backend is now
    // correctly configured — indistinguishable, from the merchant's
    // side, from the secret never having taken effect at all.
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
