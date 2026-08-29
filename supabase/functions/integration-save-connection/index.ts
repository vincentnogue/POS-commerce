import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SaveConnectionRequest {
  tenant_id: string;
  provider_id: string; // actually a provider_key (e.g. "paystack"), see lookup below
  credentials: Record<string, string>;
  config?: Record<string, unknown>;
}

/**
 * Simple encryption helper using base64 for obfuscation.
 *
 * NOTE: This is NOT strong encryption — it's the same placeholder scheme
 * already used by every payment integration function that reads
 * integration_credentials (paystack-payments, flutterwave-payments,
 * payunit-payments, stripe-payments, etc). Upgrading it to real
 * authenticated encryption (e.g. AES-GCM via Web Crypto with a secret held
 * in Supabase project secrets) is a deliberate follow-up: it requires
 * provisioning a new encryption key in the live project and re-encrypting
 * every already-stored credential, which isn't safe to do blindly from
 * here without breaking currently-connected merchant accounts. Flagging
 * this explicitly rather than leaving it unspoken.
 */
function encryptCredentials(data: Record<string, string>): string {
  const json = JSON.stringify(data);
  const base64 = btoa(json);
  return `enc_${base64}`;
}

/**
 * Save integration connection with credentials
 *
 * Flow:
 * 1. Verify the caller is authenticated AND is an admin/manager/super_admin
 *    of tenant_id (BUG FIX: this used to just check "is there an
 *    Authorization header", never who it belonged to or which tenant they
 *    could act on — any authenticated user could save PSP credentials
 *    under ANY tenant_id).
 * 2. Resolve provider_key -> the provider's real UUID (BUG FIX: this used
 *    to insert the provider_key string, e.g. "paystack", directly into the
 *    provider_id UUID column, which always failed).
 * 3. Encrypt credentials
 * 4. Save connection to DB (service role)
 * 5. Return connection_id
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Server not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized", error: "NO_AUTH" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tenant_id, provider_id: providerKey, credentials, config } =
      (await req.json()) as SaveConnectionRequest;

    if (!tenant_id || !providerKey || !credentials) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is authenticated
    const bearerToken = authHeader.replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData.user) {
      return new Response(
        JSON.stringify({ success: false, message: "Non authentifié", error: "NO_AUTH" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller actually belongs to tenant_id, with a role allowed
    // to manage integrations — strict tenant isolation.
    const { data: callerMember } = await adminClient
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", callerData.user.id)
      .maybeSingle();

    if (!callerMember || !["admin", "manager", "super_admin"].includes(callerMember.role)) {
      return new Response(
        JSON.stringify({ success: false, message: "Permission refusée pour ce tenant", error: "FORBIDDEN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve provider_key -> provider UUID
    const { data: provider, error: providerErr } = await adminClient
      .from("integration_providers")
      .select("id")
      .eq("provider_key", providerKey)
      .maybeSingle();

    if (providerErr || !provider) {
      return new Response(
        JSON.stringify({ success: false, message: `Fournisseur inconnu: ${providerKey}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Encrypt credentials
    const encryptedCredentials = encryptCredentials(credentials);

    // Create (or reconnect) the connection record — one connection per
    // provider per tenant (see UNIQUE(tenant_id, provider_id) constraint)
    const { data: connection, error: connectionErr } = await adminClient
      .from("integration_connections")
      .upsert(
        {
          tenant_id,
          provider_id: provider.id,
          status: "connected",
          connected_at: new Date().toISOString(),
          disconnected_at: null,
          error_message: null,
          config,
          account_name: credentials.account_name || "Connected account",
        },
        { onConflict: "tenant_id,provider_id" }
      )
      .select("id")
      .single();

    if (connectionErr || !connection) {
      console.error("Failed to create connection:", connectionErr);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to save connection",
          error: connectionErr?.message,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const connectionId = connection.id;

    // Save encrypted credentials (delete any previous row for this
    // connection first, since a reconnect should replace old credentials)
    await adminClient.from("integration_credentials").delete().eq("connection_id", connectionId);

    const { error: credError } = await adminClient.from("integration_credentials").insert({
      connection_id: connectionId,
      tenant_id,
      credential_data: encryptedCredentials,
      encryption_version: 1,
      created_by: callerData.user.id,
    });

    if (credError) {
      console.error("Failed to save credentials:", credError);
      // Connection created but credentials failed — mark connection as error
      await adminClient
        .from("integration_connections")
        .update({ status: "error", error_message: "Failed to encrypt credentials" })
        .eq("id", connectionId);

      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to save credentials",
          error: credError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        connection_id: connectionId,
        message: "Integration connected successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        message: `Server error: ${err.message}`,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
