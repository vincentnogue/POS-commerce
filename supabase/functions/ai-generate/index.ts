import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Makes the "ChatGPT (OpenAI)" Marketplace integration actually do
// something. Before this function existed, a merchant could connect
// their OpenAI API key (the generic integration-save-connection flow
// already handled storing it), but nothing in the app ever read it back
// or called OpenAI with it — the integration's promised capabilities
// ("Generate product descriptions, draft customer replies, and
// summarize sales/reports data") were pure marketing copy with no real
// feature behind them. This is the first real one: generating a product
// description from its name/category, called from the "Generate with
// AI" button in ProductsPage.tsx.
interface GenerateRequest {
  tenant_id: string;
  connection_id: string;
  action: "product_description";
  product_name: string;
  category?: string;
}

async function getOpenAiKey(
  supabaseUrl: string,
  serviceRoleKey: string,
  connectionId: string,
  tenantId: string
): Promise<{ apiKey?: string; error?: string }> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/integration_credentials?connection_id=eq.${connectionId}&tenant_id=eq.${tenantId}`,
    {
      method: "GET",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    }
  );
  if (!res.ok) return { error: "Failed to retrieve credentials" };
  const creds = await res.json();
  if (!creds[0]) return { error: "Credentials not found" };

  const credentialData = creds[0].credential_data;
  // Same base64 "enc_" obfuscation scheme every other integration
  // function here uses (see integration-save-connection/index.ts for the
  // real-encryption caveat already documented there — unchanged here).
  if (typeof credentialData === "string" && credentialData.startsWith("enc_")) {
    const decoded = atob(credentialData.replace("enc_", ""));
    const parsed = JSON.parse(decoded);
    return { apiKey: parsed.api_key };
  }
  return { error: "Invalid credential format" };
}

async function generateProductDescription(apiKey: string, productName: string, category?: string): Promise<{ text?: string; error?: string }> {
  try {
    const prompt = category
      ? `Write a concise, appealing product description (max 2 sentences, no markdown) for a retail product called "${productName}" in the "${category}" category.`
      : `Write a concise, appealing product description (max 2 sentences, no markdown) for a retail product called "${productName}".`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return { error: errBody?.error?.message || `OpenAI error (${response.status})` };
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return { error: "OpenAI returned an empty response" };
    return { text };
  } catch (err) {
    return { error: err.message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Server not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, message: "Only POST allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as GenerateRequest;
    if (!body.tenant_id || !body.connection_id || !body.action) {
      // BUG FIX: same masking issue fixed in integration-test-connection —
      // supabase.functions.invoke() replaces this message with a generic
      // "non-2xx status code" string on the frontend for ANY non-2xx
      // response (confirmed here too: ProductsPage.tsx's error handling
      // falls through to the generic SDK message whenever this returned
      // 400/401/502). A failed generation attempt is valid response data,
      // not an HTTP-level error — the business-logic responses below now
      // return 200, success:false carries the outcome.
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: strict multi-tenant isolation — same fix/rationale as
    // stripe-payments, flutterwave-payments, paystack-payments,
    // payunit-payments. Without this, any authenticated user of ANY
    // tenant could pass a different tenant's connection_id and burn
    // THAT tenant's paid OpenAI quota generating text for themselves.
    // Found during a follow-up security audit of every edge function
    // after the stripe-payments fix, since this function (and several
    // others below) had exactly the same missing check.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearerToken = authHeader.replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData.user) {
      return new Response(
        JSON.stringify({ success: false, message: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerMember } = await adminClient
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", body.tenant_id)
      .eq("user_id", callerData.user.id)
      .maybeSingle();
    if (!callerMember) {
      return new Response(
        JSON.stringify({ success: false, message: "Access denied for this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiKey, error: credError } = await getOpenAiKey(supabaseUrl, serviceRoleKey, body.connection_id, body.tenant_id);
    if (credError || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, message: credError || "No OpenAI API key connected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "product_description") {
      if (!body.product_name) {
        return new Response(
          JSON.stringify({ success: false, message: "product_name is required" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { text, error } = await generateProductDescription(apiKey, body.product_name, body.category);
      if (error || !text) {
        return new Response(
          JSON.stringify({ success: false, message: error || "Generation failed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, text }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: `Unknown action: ${body.action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-generate error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
