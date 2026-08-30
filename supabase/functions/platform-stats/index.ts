import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Public, real, live platform stats for marketing pages (currently: total
// number of merchants). Two earlier attempts at a merchant-count stat
// (hardcoded "1850+", then a raw in-app tenant count that only showed "3+")
// were each wrong in their own way: the first was an unbacked literal, the
// second undercounted badly because most of this business's ~529 real
// merchants (as of Aug 2026, confirmed directly by the product owner) were
// onboarded before/outside this specific `tenants` table and aren't rows in
// it yet. EXTERNAL_MERCHANT_BASELINE captures that known-real count; the
// live `tenants` row count is added on top so the number both reflects
// today's true total AND keeps growing live as new tenants sign up here —
// update the baseline if/when the business does a full historical import.
const EXTERNAL_MERCHANT_BASELINE = 529;

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
      JSON.stringify({ merchantCount: EXTERNAL_MERCHANT_BASELINE + (count ?? 0) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
