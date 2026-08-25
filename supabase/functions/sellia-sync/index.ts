import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SelliaProduct {
  id: string;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  sku: string;
  description?: string;
  images?: string[];
  category?: string;
}

interface SelliaSyncRequest {
  tenant_id: string;
  connection_id: string;
  action: "sync_products_push" | "sync_products_pull" | "sync_inventory" | "sync_orders";
  products?: SelliaProduct[];
}

/**
 * Push products to Sellia
 */
async function pushProductsToSellia(
  apiKey: string,
  products: SelliaProduct[]
): Promise<{ synced: number; error?: string }> {
  try {
    const response = await fetch("https://api.sellia.io/v1/products/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "upsert",
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          cost: p.cost,
          sku: p.sku,
          quantity: p.quantity,
          description: p.description,
          images: p.images,
          category: p.category,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { synced: 0, error: error.message || "Batch sync failed" };
    }

    const data = await response.json();
    return { synced: data.synced_count || 0 };
  } catch (err) {
    return { synced: 0, error: err.message };
  }
}

/**
 * Pull products from Sellia
 */
async function pullProductsFromSellia(
  apiKey: string
): Promise<{ products?: SelliaProduct[]; error?: string }> {
  try {
    const response = await fetch("https://api.sellia.io/v1/products", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || "Failed to pull products" };
    }

    const data = await response.json();
    return {
      products: data.products.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        cost: p.cost,
        quantity: p.quantity,
        sku: p.sku,
        description: p.description,
        images: p.images,
        category: p.category,
      })),
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Sync inventory levels
 */
async function syncInventoryToSellia(
  apiKey: string,
  products: SelliaProduct[]
): Promise<{ updated: number; error?: string }> {
  try {
    const response = await fetch("https://api.sellia.io/v1/inventory/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        updates: products.map(p => ({
          sku: p.sku,
          quantity: p.quantity,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { updated: 0, error: error.message || "Inventory sync failed" };
    }

    const data = await response.json();
    return { updated: data.updated_count || 0 };
  } catch (err) {
    return { updated: 0, error: err.message };
  }
}

/**
 * Get Sellia credentials
 */
async function getSelliaCredentials(
  supabaseUrl: string,
  serviceRoleKey: string,
  connectionId: string,
  tenantId: string
): Promise<{ apiKey?: string; error?: string }> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/integration_credentials?connection_id=eq.${connectionId}&tenant_id=eq.${tenantId}`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!res.ok) {
      return { error: "Failed to retrieve credentials" };
    }

    const creds = await res.json();
    if (!creds[0]) {
      return { error: "Credentials not found" };
    }

    const credentialData = creds[0].credential_data;
    if (typeof credentialData === "string" && credentialData.startsWith("enc_")) {
      const decoded = atob(credentialData.replace("enc_", ""));
      const parsed = JSON.parse(decoded);
      return { apiKey: parsed.api_key };
    }

    return { error: "Invalid credential format" };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Log sync operation
 */
async function logSyncOperation(
  supabaseUrl: string,
  serviceRoleKey: string,
  tenantId: string,
  connectionId: string,
  syncType: string,
  direction: string,
  itemsProcessed: number,
  itemsCreated: number,
  itemsUpdated: number,
  error?: string
): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/integration_sync_logs`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      connection_id: connectionId,
      sync_type: syncType,
      direction,
      status: error ? "failed" : "completed",
      items_processed: itemsProcessed,
      items_created: itemsCreated,
      items_updated: itemsUpdated,
      error_message: error,
      duration_ms: 0, // Should calculate in production
    }),
  });
}

/**
 * Main handler
 */
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

    const body = (await req.json()) as SelliaSyncRequest;

    if (!body.tenant_id || !body.connection_id || !body.action) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Sellia credentials
    const { apiKey, error: credError } = await getSelliaCredentials(
      supabaseUrl,
      serviceRoleKey,
      body.connection_id,
      body.tenant_id
    );

    if (credError || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, message: credError || "No Sellia credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: any = { success: false };

    switch (body.action) {
      case "sync_products_push":
        if (!body.products || body.products.length === 0) {
          return new Response(
            JSON.stringify({ success: false, message: "No products to sync" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const pushResult = await pushProductsToSellia(apiKey, body.products);
        if (pushResult.error) {
          await logSyncOperation(
            supabaseUrl,
            serviceRoleKey,
            body.tenant_id,
            body.connection_id,
            "products",
            "push",
            0,
            0,
            0,
            pushResult.error
          );
          return new Response(
            JSON.stringify({ success: false, message: pushResult.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        await logSyncOperation(
          supabaseUrl,
          serviceRoleKey,
          body.tenant_id,
          body.connection_id,
          "products",
          "push",
          body.products.length,
          0,
          pushResult.synced
        );
        result = { success: true, synced: pushResult.synced };
        break;

      case "sync_products_pull":
        const pullResult = await pullProductsFromSellia(apiKey);
        if (pullResult.error) {
          await logSyncOperation(
            supabaseUrl,
            serviceRoleKey,
            body.tenant_id,
            body.connection_id,
            "products",
            "pull",
            0,
            0,
            0,
            pullResult.error
          );
          return new Response(
            JSON.stringify({ success: false, message: pullResult.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        await logSyncOperation(
          supabaseUrl,
          serviceRoleKey,
          body.tenant_id,
          body.connection_id,
          "products",
          "pull",
          pullResult.products?.length || 0,
          pullResult.products?.length || 0,
          0
        );
        result = { success: true, products: pullResult.products, count: pullResult.products?.length || 0 };
        break;

      case "sync_inventory":
        if (!body.products || body.products.length === 0) {
          return new Response(
            JSON.stringify({ success: false, message: "No inventory to sync" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const inventoryResult = await syncInventoryToSellia(apiKey, body.products);
        if (inventoryResult.error) {
          await logSyncOperation(
            supabaseUrl,
            serviceRoleKey,
            body.tenant_id,
            body.connection_id,
            "inventory",
            "push",
            0,
            0,
            0,
            inventoryResult.error
          );
          return new Response(
            JSON.stringify({ success: false, message: inventoryResult.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        await logSyncOperation(
          supabaseUrl,
          serviceRoleKey,
          body.tenant_id,
          body.connection_id,
          "inventory",
          "push",
          body.products.length,
          0,
          inventoryResult.updated
        );
        result = { success: true, updated: inventoryResult.updated };
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, message: `Unknown action: ${body.action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Sellia sync error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
