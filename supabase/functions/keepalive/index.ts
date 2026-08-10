// Supabase Edge Function: keepalive
// Lightweight health-check ping that touches the database so the Supabase
// project is never considered "idle" and auto-paused on the free tier.
// Designed to be invoked by a GitHub Actions cron (see .github/workflows/keepalive.yml).
// It runs a trivial SELECT against the database — minimal load, no side effects.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const startedAt = Date.now();
  let status: "ok" | "error" = "ok";

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/tenants?select=id&limit=1`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (!res.ok) {
      status = "error";
    }
  } catch (_e) {
    status = "error";
  }

  const body = {
    ok: status === "ok",
    status,
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status === "ok" ? 200 : 503,
  });
});
