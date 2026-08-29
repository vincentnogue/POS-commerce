import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Public, real, live platform stats for marketing pages (currently: total
// number of merchant tenants). This replaces a previous hardcoded "1850+"
// literal on the landing page, which was correctly flagged and removed
// twice as an unverifiable, fabricated-looking number — it was never
// actually queried from anywhere. This function makes the number real: it
// counts rows in `tenants` using the service role key server-side
// (tenants has no public SELECT policy, by design — regular clients can't
// read other tenants' existence), and returns ONLY a count, never any
// tenant details, so nothing sensitive is exposed publicly.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase service credentials");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Exclude the internal admin tenant ('POS Flow - Administration', see
    // migration 0037) from the public merchant count — it's not a customer.
    const { count, error } = await supabase
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .neq("name", "POS Flow - Administration");

    if (error) throw error;

    return new Response(
      JSON.stringify({ merchantCount: count ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
