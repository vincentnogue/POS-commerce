import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// REAL exchange-rate backend for the pricing/currency matrix.
//
// BUG FIX: src/lib/currency.ts has always called `fetch('/api/exchange-rates')`,
// but that route was never implemented anywhere in this repo (no Cloudflare
// Pages Function, no Supabase Edge Function) — the app runs on Cloudflare
// Pages (see wrangler.toml) with only a SPA redirect in public/_redirects.
// The call has therefore always failed and silently fallen back to the
// hardcoded, stale rates in getFallbackRates(). This function is the real
// backend: it fetches live rates from a free, keyless provider
// (open.er-api.com, updated daily) covering all currencies the app needs,
// including AED/NGN/KES/GHS/EGP/ZAR for the African/Gulf market — unlike
// ECB-only providers (e.g. Frankfurter) which don't cover most of these.
//
// Response shape matches the ExchangeRate interface in src/lib/currency.ts:
// { USD: 1, EUR: 0.92, ... }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UPSTREAM_URL = "https://open.er-api.com/v6/latest/USD";

// In-memory cache local to this isolate. Supabase Edge Functions can spin up
// fresh isolates, so this is a best-effort speedup, not a correctness
// guarantee — the real dedupe/expiry already happens client-side in
// src/lib/currency.ts (1 hour localStorage cache). This just avoids hammering
// the upstream provider if this isolate serves several requests in a row.
let cache: { rates: Record<string, number>; fetchedAt: number; lastUpdateUtc: string } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const now = Date.now();
    if (!cache || now - cache.fetchedAt > CACHE_TTL_MS) {
      const upstream = await fetch(UPSTREAM_URL);
      if (!upstream.ok) {
        throw new Error(`Upstream exchange rate provider returned ${upstream.status}`);
      }
      const data = await upstream.json();
      if (data.result !== "success" || !data.rates) {
        throw new Error("Upstream exchange rate provider returned an unexpected payload");
      }
      cache = {
        rates: data.rates as Record<string, number>,
        fetchedAt: now,
        lastUpdateUtc: data.time_last_update_utc ?? new Date().toISOString(),
      };
    }

    return new Response(
      JSON.stringify({
        rates: cache.rates,
        base: "USD",
        updatedAt: cache.lastUpdateUtc,
        source: "open.er-api.com",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error fetching exchange rates" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
