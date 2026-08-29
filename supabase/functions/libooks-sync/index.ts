import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface JournalEntry {
  date: string;
  reference: string;
  description: string;
  amount: number;
  currency: string;
  account_code: string;
  account_name: string;
  type: "income" | "expense" | "transfer";
  category: string;
}

interface LibooksSyncRequest {
  tenant_id: string;
  connection_id: string;
  action: "sync_sales" | "sync_expenses" | "sync_invoices" | "get_accounts";
  entries?: JournalEntry[];
}

/**
 * Sync sales to Libooks as income entries
 */
async function syncSalesToLibooks(
  apiKey: string,
  entries: JournalEntry[]
): Promise<{ synced: number; error?: string }> {
  try {
    const response = await fetch("https://api.libooks.io/v1/journal-entries/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entries: entries.map(e => ({
          date: e.date,
          reference: e.reference,
          description: e.description,
          debit_account: "1100", // Income account (configurable per tenant)
          debit_amount: e.amount,
          credit_account: "1200", // Sales revenue
          credit_amount: e.amount,
          currency: e.currency,
          tags: ["pos-flow", "pos-sync"],
          metadata: {
            source: "pos-flow",
            reference_id: e.reference,
          },
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { synced: 0, error: error.message || "Sales sync failed" };
    }

    const data = await response.json();
    return { synced: data.entries_created || 0 };
  } catch (err) {
    return { synced: 0, error: err.message };
  }
}

/**
 * Sync expenses to Libooks
 */
async function syncExpensesToLibooks(
  apiKey: string,
  entries: JournalEntry[]
): Promise<{ synced: number; error?: string }> {
  try {
    const response = await fetch("https://api.libooks.io/v1/journal-entries/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entries: entries.map(e => ({
          date: e.date,
          reference: e.reference,
          description: e.description,
          debit_account: e.account_code, // Expense account
          debit_amount: e.amount,
          credit_account: "1300", // Cash/Bank
          credit_amount: e.amount,
          currency: e.currency,
          category: e.category,
          tags: ["pos-flow", "expense"],
          metadata: {
            source: "pos-flow",
            reference_id: e.reference,
            category: e.category,
          },
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { synced: 0, error: error.message || "Expense sync failed" };
    }

    const data = await response.json();
    return { synced: data.entries_created || 0 };
  } catch (err) {
    return { synced: 0, error: err.message };
  }
}

/**
 * Sync invoices to Libooks
 */
async function syncInvoicesToLibooks(
  apiKey: string,
  entries: JournalEntry[]
): Promise<{ synced: number; error?: string }> {
  try {
    const response = await fetch("https://api.libooks.io/v1/invoices/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invoices: entries.map(e => ({
          invoice_number: e.reference,
          date: e.date,
          description: e.description,
          amount: e.amount,
          currency: e.currency,
          type: "sales", // From POS Flow
          tags: ["pos-flow"],
          metadata: {
            source: "pos-flow",
            reference_id: e.reference,
          },
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { synced: 0, error: error.message || "Invoice sync failed" };
    }

    const data = await response.json();
    return { synced: data.invoices_created || 0 };
  } catch (err) {
    return { synced: 0, error: err.message };
  }
}

/**
 * Get chart of accounts from Libooks
 */
async function getAccountsFromLibooks(
  apiKey: string
): Promise<{ accounts?: any[]; error?: string }> {
  try {
    const response = await fetch("https://api.libooks.io/v1/accounts", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || "Failed to fetch accounts" };
    }

    const data = await response.json();
    return { accounts: data.accounts };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Get Libooks credentials
 */
async function getLibooksCredentials(
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
  itemsProcessed: number,
  itemsCreated: number,
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
      direction: "push",
      status: error ? "failed" : "completed",
      items_processed: itemsProcessed,
      items_created: itemsCreated,
      error_message: error,
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

    const body = (await req.json()) as LibooksSyncRequest;

    if (!body.tenant_id || !body.connection_id || !body.action) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Libooks credentials
    const { apiKey, error: credError } = await getLibooksCredentials(
      supabaseUrl,
      serviceRoleKey,
      body.connection_id,
      body.tenant_id
    );

    if (credError || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, message: credError || "No Libooks credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: any = { success: false };

    switch (body.action) {
      case "sync_sales": {
        if (!body.entries || body.entries.length === 0) {
          return new Response(
            JSON.stringify({ success: false, message: "No sales to sync" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const salesResult = await syncSalesToLibooks(apiKey, body.entries);
        if (salesResult.error) {
          await logSyncOperation(
            supabaseUrl,
            serviceRoleKey,
            body.tenant_id,
            body.connection_id,
            "sales",
            0,
            0,
            salesResult.error
          );
          return new Response(
            JSON.stringify({ success: false, message: salesResult.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        await logSyncOperation(
          supabaseUrl,
          serviceRoleKey,
          body.tenant_id,
          body.connection_id,
          "sales",
          body.entries.length,
          salesResult.synced
        );
        result = { success: true, synced: salesResult.synced };
        break;
      }

      case "sync_expenses": {
        if (!body.entries || body.entries.length === 0) {
          return new Response(
            JSON.stringify({ success: false, message: "No expenses to sync" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const expenseResult = await syncExpensesToLibooks(apiKey, body.entries);
        if (expenseResult.error) {
          await logSyncOperation(
            supabaseUrl,
            serviceRoleKey,
            body.tenant_id,
            body.connection_id,
            "expenses",
            0,
            0,
            expenseResult.error
          );
          return new Response(
            JSON.stringify({ success: false, message: expenseResult.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        await logSyncOperation(
          supabaseUrl,
          serviceRoleKey,
          body.tenant_id,
          body.connection_id,
          "expenses",
          body.entries.length,
          expenseResult.synced
        );
        result = { success: true, synced: expenseResult.synced };
        break;
      }

      case "sync_invoices": {
        if (!body.entries || body.entries.length === 0) {
          return new Response(
            JSON.stringify({ success: false, message: "No invoices to sync" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const invoiceResult = await syncInvoicesToLibooks(apiKey, body.entries);
        if (invoiceResult.error) {
          await logSyncOperation(
            supabaseUrl,
            serviceRoleKey,
            body.tenant_id,
            body.connection_id,
            "invoices",
            0,
            0,
            invoiceResult.error
          );
          return new Response(
            JSON.stringify({ success: false, message: invoiceResult.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        await logSyncOperation(
          supabaseUrl,
          serviceRoleKey,
          body.tenant_id,
          body.connection_id,
          "invoices",
          body.entries.length,
          invoiceResult.synced
        );
        result = { success: true, synced: invoiceResult.synced };
        break;
      }

      case "get_accounts": {
        const accountsResult = await getAccountsFromLibooks(apiKey);
        if (accountsResult.error) {
          return new Response(
            JSON.stringify({ success: false, message: accountsResult.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = { success: true, accounts: accountsResult.accounts };
        break;
      }

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
    console.error("Libooks sync error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
