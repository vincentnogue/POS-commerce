import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// CORS FIX: same bug already fixed in flutterwave-payments,
// paystack-payments, stripe-payments, mpesa-payments and
// orange-money-payments — supabase.functions.invoke() always sends an
// "apikey" header alongside Authorization, but this function's preflight
// response didn't allow it. The browser blocks the real request after a
// rejected CORS preflight, which surfaces to the user as an opaque
// "Failed to send a request to the Edge Function", not a readable error
// from this function (it never even runs). Missed when this function was
// first written, after the others were already fixed.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Makes both the "ChatGPT (OpenAI)" AND "Claude (Anthropic)" Marketplace
// integrations actually do something. Before this function existed, a
// merchant could connect either provider's API key (the generic
// integration-save-connection flow already handled storing it), but
// nothing in the app ever read it back or called either provider with
// it — both integrations' promised capabilities ("Generate product
// descriptions, draft customer replies, and summarize sales/reports
// data") were pure marketing copy with no real feature behind them.
// This is the first real one: generating a product description from its
// name/category, called from the "Generate with AI" button in
// ProductsPage.tsx. The provider actually used is whichever the tenant
// has connected — provider_key is looked up server-side from
// connection_id rather than trusted from the client, same reasoning as
// every credential lookup in this file.
interface GenerateRequest {
  tenant_id: string;
  connection_id?: string;
  action: "product_description";
  product_name: string;
  category?: string;
}

async function getProviderCredential(
  supabaseUrl: string,
  serviceRoleKey: string,
  connectionId: string,
  tenantId: string
): Promise<{ apiKey?: string; providerKey?: "openai_chatgpt" | "anthropic_claude" | "google_gemini"; error?: string }> {
  const connRes = await fetch(
    `${supabaseUrl}/rest/v1/integration_connections?id=eq.${connectionId}&tenant_id=eq.${tenantId}&select=provider_id`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  if (!connRes.ok) return { error: "Failed to retrieve connection" };
  const conns = await connRes.json();
  if (!conns[0]) return { error: "Connection not found" };

  const provRes = await fetch(
    `${supabaseUrl}/rest/v1/integration_providers?id=eq.${conns[0].provider_id}&select=provider_key`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  const provs = await provRes.json();
  const providerKey = provs[0]?.provider_key;
  if (providerKey !== "openai_chatgpt" && providerKey !== "anthropic_claude" && providerKey !== "google_gemini") {
    return { error: "Connection is not an AI provider" };
  }

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
    return { apiKey: parsed.api_key, providerKey };
  }
  return { error: "Invalid credential format" };
}

function buildPrompt(productName: string, category?: string): string {
  return category
    ? `Write a concise, appealing product description (max 2 sentences, no markdown) for a retail product called "${productName}" in the "${category}" category.`
    : `Write a concise, appealing product description (max 2 sentences, no markdown) for a retail product called "${productName}".`;
}

async function generateWithOpenAi(apiKey: string, productName: string, category?: string): Promise<{ text?: string; error?: string }> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: buildPrompt(productName, category) }],
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

async function generateWithAnthropic(apiKey: string, productName: string, category?: string): Promise<{ text?: string; error?: string }> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        messages: [{ role: "user", content: buildPrompt(productName, category) }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return { error: errBody?.error?.message || `Anthropic error (${response.status})` };
    }
    const data = await response.json();
    const text = data?.content?.[0]?.text?.trim();
    if (!text) return { error: "Anthropic returned an empty response" };
    return { text };
  } catch (err) {
    return { error: err.message };
  }
}

async function generateWithGemini(apiKey: string, productName: string, category?: string): Promise<{ text?: string; error?: string }> {
  try {
    // Gemini's request/response shape is unlike OpenAI's and Anthropic's
    // (both used above) — contents/parts instead of messages, and the key
    // goes in a query param rather than an Authorization header.
    // Model name per Google's own API error when the previous one
    // (gemini-2.0-flash) was retired: "no longer available... use
    // models/gemini-3.6-flash". Taking that at face value since it's live
    // information straight from the provider, more current than anything
    // in training data.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(productName, category) }] }],
          // Gemini 3 models "think" (internal reasoning) by default at
          // thinkingLevel "medium", and those reasoning tokens are drawn
          // from the same output budget. With only 120 max output tokens,
          // thinking could eat most or all of that budget before any
          // visible text was written, producing the empty/truncated,
          // low-quality answers reported live. A 2-sentence product
          // description doesn't need reasoning, so it's turned off
          // (thinkingLevel "minimal", the lowest Flash supports), and the
          // budget is raised as a safety margin regardless.
          generationConfig: { maxOutputTokens: 300, temperature: 0.7, thinkingConfig: { thinkingLevel: "minimal" } },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return { error: errBody?.error?.message || `Gemini error (${response.status})` };
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return { error: "Gemini returned an empty response" };
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
    if (!body.tenant_id || !body.action) {
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

    // RATE LIMIT: each call costs the tenant real OpenAI usage. Without
    // this, a bug, a compromised session, or a malicious staff member
    // could burn through a merchant's OpenAI quota in seconds by looping
    // this endpoint. 30 generations/hour is generous for actively
    // editing a product catalog, well below anything a real cashier/
    // manager workflow would hit, but stops a runaway loop.
    const rlRes = await fetch(`${supabaseUrl}/rest/v1/rpc/check_rate_limit`, {
      method: "POST",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_tenant_id: body.tenant_id, p_function_name: "ai-generate", p_max_calls: 30, p_window_minutes: 60 }),
    });
    const allowed = await rlRes.json().catch(() => true); // fail-open if the RPC itself errors
    if (allowed === false) {
      return new Response(
        // BUG FIX: same masking issue as below — a rate-limit rejection is
        // a valid outcome of an otherwise-legitimate request, not an
        // infrastructure failure, so it gets the same 200 + success:false
        // treatment rather than a status the frontend SDK would mask.
        JSON.stringify({ success: false, message: "Rate limit reached — try again in a bit" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let apiKey: string | undefined;
    let providerKey: "openai_chatgpt" | "anthropic_claude" | "google_gemini" | undefined;
    if (body.connection_id) {
      const cred = await getProviderCredential(supabaseUrl, serviceRoleKey, body.connection_id, body.tenant_id);
      apiKey = cred.apiKey;
      providerKey = cred.providerKey;
      if (cred.error) {
        return new Response(
          JSON.stringify({ success: false, message: cred.error }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // PLATFORM FALLBACK: no tenant needs to bring their own AI key to get
    // this feature. If the tenant hasn't connected (or didn't pass) a
    // provider, and a platform-level Gemini key is configured, use it —
    // funded by POS Flow rather than the tenant. The per-tenant rate
    // limit above (30/hour) already caps how much any single tenant can
    // draw from this shared, platform-funded key.
    if (!apiKey) {
      const platformKey = Deno.env.get("GEMINI_API_KEY");
      if (platformKey) {
        apiKey = platformKey;
        providerKey = "google_gemini";
      }
    }
    if (!apiKey || !providerKey) {
      return new Response(
        JSON.stringify({ success: false, message: "No AI provider connected" }),
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
      const { text, error } = providerKey === "anthropic_claude"
        ? await generateWithAnthropic(apiKey, body.product_name, body.category)
        : providerKey === "google_gemini"
        ? await generateWithGemini(apiKey, body.product_name, body.category)
        : await generateWithOpenAi(apiKey, body.product_name, body.category);
      if (error || !text) {
        return new Response(
          JSON.stringify({ success: false, message: error || "Generation failed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, text, provider: providerKey }),
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
