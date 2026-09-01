import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * ai-generate-text
 *
 * This is the first real *consumer* of a tenant's own connected AI
 * integration (anthropic_claude / openai_chatgpt / google_gemini,
 * migration 0057). Before this function existed, "connecting" an AI
 * provider in the Marketplace only ever wrote a row to
 * integration_connections/integration_credentials — nothing in the app
 * ever read it back, so the provider card's own promised capabilities
 * ("Generate product descriptions, draft customer replies...") were not
 * actually deliverable. This function decrypts the tenant's stored key
 * (same enc_ + base64 placeholder scheme every other integration function
 * already uses — see the comment in integration-save-connection/index.ts)
 * and calls the real provider API server-side, so the merchant's key is
 * never sent to or exposed in the browser.
 *
 * Body: { tenant_id: string, prompt: string, max_tokens?: number }
 * Picks whichever AI provider the tenant has connected, in this
 * preference order, so a tenant only has to connect one to use this.
 */
const PROVIDER_PREFERENCE = ["anthropic_claude", "openai_chatgpt", "google_gemini"] as const;

interface GenerateRequest {
  tenant_id: string;
  prompt: string;
  max_tokens?: number;
}

function decryptCredentials(encoded: string): Record<string, string> | null {
  if (typeof encoded !== "string" || !encoded.startsWith("enc_")) return null;
  try {
    return JSON.parse(atob(encoded.replace("enc_", "")));
  } catch {
    return null;
  }
}

async function callAnthropic(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Anthropic API error (${res.status})`);
  }
  const data = await res.json();
  return (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
}

async function callOpenAI(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `OpenAI API error (${res.status})`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

async function callGemini(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Gemini API error (${res.status})`);
  }
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ success: false, message: "Server not configured" }, 503);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, message: "Unauthorized", error: "NO_AUTH" }, 401);

  try {
    const { tenant_id, prompt, max_tokens } = (await req.json()) as GenerateRequest;
    if (!tenant_id || !prompt?.trim()) return json({ success: false, message: "Missing tenant_id or prompt" }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const bearerToken = authHeader.replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${bearerToken}` } } });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData.user) return json({ success: false, message: "Unauthorized", error: "NO_AUTH" }, 401);

    // Any tenant member can USE an already-connected AI provider (setting
    // one up requires admin/manager, enforced by integration-save-connection
    // — using it for a product description is an ordinary staff task).
    const { data: callerMember } = await adminClient
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", callerData.user.id)
      .maybeSingle();
    if (!callerMember) return json({ success: false, message: "Permission refusée pour ce tenant", error: "FORBIDDEN" }, 403);

    const { data: providers } = await adminClient
      .from("integration_providers")
      .select("id, provider_key")
      .in("provider_key", PROVIDER_PREFERENCE as unknown as string[]);
    if (!providers || providers.length === 0) return json({ success: false, message: "No AI provider configured", error: "NO_PROVIDER" }, 500);

    const { data: connections } = await adminClient
      .from("integration_connections")
      .select("id, provider_id")
      .eq("tenant_id", tenant_id)
      .eq("status", "connected")
      .in("provider_id", providers.map((p) => p.id));
    if (!connections || connections.length === 0) {
      return json({ success: false, message: "No AI integration connected for this store", error: "NOT_CONNECTED" }, 404);
    }

    // Pick by PROVIDER_PREFERENCE order, not just "first connection found".
    let chosen: { connection_id: string; providerKey: string } | null = null;
    for (const key of PROVIDER_PREFERENCE) {
      const provider = providers.find((p) => p.provider_key === key);
      const connection = provider && connections.find((c) => c.provider_id === provider.id);
      if (connection) { chosen = { connection_id: connection.id, providerKey: key }; break; }
    }
    if (!chosen) return json({ success: false, message: "No AI integration connected for this store", error: "NOT_CONNECTED" }, 404);

    const { data: credRow } = await adminClient
      .from("integration_credentials")
      .select("credential_data")
      .eq("connection_id", chosen.connection_id)
      .maybeSingle();
    const creds = credRow ? decryptCredentials(credRow.credential_data as string) : null;
    const apiKey = creds?.api_key;
    if (!apiKey) return json({ success: false, message: "Stored credentials could not be read", error: "BAD_CREDENTIALS" }, 500);

    const maxTokens = Math.min(Math.max(max_tokens ?? 300, 16), 1000);
    let text: string;
    try {
      if (chosen.providerKey === "anthropic_claude") text = await callAnthropic(apiKey, prompt, maxTokens);
      else if (chosen.providerKey === "openai_chatgpt") text = await callOpenAI(apiKey, prompt, maxTokens);
      else text = await callGemini(apiKey, prompt, maxTokens);
    } catch (err) {
      return json({ success: false, message: err instanceof Error ? err.message : "Generation failed", error: "PROVIDER_ERROR" }, 502);
    }

    return json({ success: true, text, provider: chosen.providerKey });
  } catch (err) {
    return json({ success: false, message: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
