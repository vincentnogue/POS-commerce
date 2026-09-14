import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TestConnectionRequest {
  provider_key: string;
  credentials: Record<string, string>;
  tenant_id: string;
}

interface TestConnectionResponse {
  success: boolean;
  message: string;
  account_id?: string;
  account_name?: string;
  error?: string;
}

// Test functions for each provider
async function testStripe(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const secretKey = credentials.secret_key;
    if (!secretKey) return { success: false, message: "Missing secret_key", error: "MISSING_CREDENTIAL" };

    const response = await fetch("https://api.stripe.com/v1/account", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: "Invalid Stripe credentials",
        error: error.error?.message || "INVALID_CREDENTIALS",
      };
    }

    const account = await response.json();
    return {
      success: true,
      message: "Successfully connected to Stripe",
      account_id: account.id,
      account_name: account.email,
    };
  } catch (err) {
    return { success: false, message: `Stripe test failed: ${err.message}`, error: "CONNECTION_ERROR" };
  }
}

async function testPayPal(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const clientId = credentials.client_id;
    const clientSecret = credentials.secret;

    if (!clientId || !clientSecret) {
      return { success: false, message: "Missing client_id or secret", error: "MISSING_CREDENTIAL" };
    }

    // Get OAuth token
    const auth = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch("https://api.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      return {
        success: false,
        message: "Invalid PayPal credentials",
        error: error.error || "INVALID_CREDENTIALS",
      };
    }

    const tokenData = await tokenResponse.json();

    // Get merchant info
    const merchantResponse = await fetch("https://api.sandbox.paypal.com/v1/identity/openidconnect/userinfo", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!merchantResponse.ok) {
      return {
        success: false,
        message: "Could not retrieve PayPal account info",
        error: "ACCOUNT_INFO_ERROR",
      };
    }

    const merchantData = await merchantResponse.json();
    return {
      success: true,
      message: "Successfully connected to PayPal",
      account_id: merchantData.user_id,
      account_name: merchantData.email,
    };
  } catch (err) {
    return { success: false, message: `PayPal test failed: ${err.message}`, error: "CONNECTION_ERROR" };
  }
}

async function testFlutterwave(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const secretKey = credentials.secret_key;
    if (!secretKey) return { success: false, message: "Missing secret_key", error: "MISSING_CREDENTIAL" };

    const response = await fetch("https://api.flutterwave.com/v3/merchants", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: "Invalid Flutterwave credentials",
        error: error.message || "INVALID_CREDENTIALS",
      };
    }

    const data = await response.json();
    const merchant = data.data?.[0];
    return {
      success: true,
      message: "Successfully connected to Flutterwave",
      account_id: merchant?.id?.toString(),
      account_name: merchant?.name,
    };
  } catch (err) {
    return { success: false, message: `Flutterwave test failed: ${err.message}`, error: "CONNECTION_ERROR" };
  }
}

async function testPaystack(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const secretKey = credentials.secret_key;
    if (!secretKey) return { success: false, message: "Missing secret_key", error: "MISSING_CREDENTIAL" };

    const response = await fetch("https://api.paystack.co/customer", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: "Invalid Paystack credentials",
        error: error.message || "INVALID_CREDENTIALS",
      };
    }

    return {
      success: true,
      message: "Successfully connected to Paystack",
      account_name: "Paystack Account",
    };
  } catch (err) {
    return { success: false, message: `Paystack test failed: ${err.message}`, error: "CONNECTION_ERROR" };
  }
}

/**
 * BUG FIX: PayUnit had no test function at all — the router below fell
 * through to the "provider not supported yet" default for provider_key
 * "payunit", so a PayUnit connection could never pass the test step in
 * IntegrationCredentialForm (which only calls the save step after a
 * successful test). This mirrors the same lightweight
 * authenticate-then-check-response pattern used for the other PSPs.
 *
 * NOTE: PayUnit's exact "list/check account" endpoint could not be
 * verified against their live API docs from this environment (no network
 * access to payunit.net here) — this hits the sandbox transactions listing
 * endpoint as a low-risk auth check. Please confirm this against
 * https://docs.payunit.net before relying on it in production; the wiring
 * (routing, tenant checks, credential decryption) is correct regardless of
 * the exact endpoint path.
 */
async function testPayUnit(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const apiKey = credentials.api_key;
    const merchantId = credentials.merchant_id;
    if (!apiKey || !merchantId) {
      return { success: false, message: "Missing api_key or merchant_id", error: "MISSING_CREDENTIAL" };
    }

    const testMode = credentials.test_mode !== "false";
    const baseUrl = testMode ? "https://api.sandbox.payunit.net/v1" : "https://api.payunit.net/v1";

    const response = await fetch(`${baseUrl}/transactions?merchant_id=${encodeURIComponent(merchantId)}&limit=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: "Invalid PayUnit credentials",
        error: "INVALID_CREDENTIALS",
      };
    }

    return {
      success: true,
      message: "Successfully connected to PayUnit",
      account_id: merchantId,
      account_name: "PayUnit Account",
    };
  } catch (err) {
    return { success: false, message: `PayUnit test failed: ${err.message}`, error: "CONNECTION_ERROR" };
  }
}

async function testSellia(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const apiKey = credentials.api_key;
    if (!apiKey) return { success: false, message: "Missing api_key", error: "MISSING_CREDENTIAL" };

    // Sellia endpoint (example)
    const response = await fetch("https://api.sellia.io/v1/account", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: "Invalid Sellia API key",
        error: "INVALID_CREDENTIALS",
      };
    }

    const account = await response.json();
    return {
      success: true,
      message: "Successfully connected to Sellia",
      account_id: account.id,
      account_name: account.store_name,
    };
  } catch (err) {
    return { success: false, message: `Sellia test failed: ${err.message}`, error: "CONNECTION_ERROR" };
  }
}

async function testTwilio(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const accountSid = credentials.account_sid;
    const authToken = credentials.auth_token;

    if (!accountSid || !authToken) {
      return { success: false, message: "Missing account_sid or auth_token", error: "MISSING_CREDENTIAL" };
    }

    const auth = btoa(`${accountSid}:${authToken}`);
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: "Invalid Twilio credentials",
        error: "INVALID_CREDENTIALS",
      };
    }

    const account = await response.json();
    return {
      success: true,
      message: "Successfully connected to Twilio",
      account_id: account.sid,
      account_name: account.friendly_name,
    };
  } catch (err) {
    return { success: false, message: `Twilio test failed: ${err.message}`, error: "CONNECTION_ERROR" };
  }
}

// Real Telegram Bot API check — getMe is the standard, well-known way to
// validate a bot token (returns the bot's own identity if the token is
// valid, 401 Unauthorized if it isn't). Field name (bot_token) matches
// the auth_schema in migration 0063.
async function testTelegram(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const botToken = credentials.bot_token;
    if (!botToken) return { success: false, message: "Missing bot_token", error: "MISSING_CREDENTIAL" };

    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      return {
        success: false,
        message: data.description || "Invalid Telegram bot token",
        error: "INVALID_CREDENTIALS",
      };
    }

    return {
      success: true,
      message: "Successfully connected to Telegram",
      account_id: String(data.result.id),
      account_name: data.result.username ? `@${data.result.username}` : data.result.first_name,
    };
  } catch (err) {
    return { success: false, message: `Telegram test failed: ${err.message}`, error: "CONNECTION_ERROR" };
  }
}

/**
 * BUG FIX: google_gemini is listed as a connectable Marketplace
 * integration (see migration 0057) but had no test function at all —
 * same gap PayUnit had before it was fixed above. The router fell
 * through to the generic "provider not supported yet" default for
 * every google_gemini connection attempt, so it could never pass the
 * test step and therefore could never actually be connected.
 *
 * Uses Google's models-list endpoint as the auth check: it's a plain
 * GET authenticated by the ?key= query param (the same single api_key
 * field this provider's auth_schema already collects — see migration
 * 0057), returns 400/403 for an invalid/missing key, and doesn't
 * consume any generation quota the way an actual prompt call would.
 */
async function testGoogleGemini(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const apiKey = credentials.api_key;
    if (!apiKey) return { success: false, message: "Missing api_key", error: "MISSING_CREDENTIAL" };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { method: "GET" }
    );

    if (!response.ok) {
      return {
        success: false,
        message: "Invalid Google AI API key",
        error: "INVALID_CREDENTIALS",
      };
    }

    return {
      success: true,
      message: "Successfully connected to Gemini (Google)",
      account_name: "Google AI Studio",
    };
  } catch (err) {
    return { success: false, message: `Gemini test failed: ${err.message}`, error: "CONNECTION_ERROR" };
  }
}

// Router: dispatch test based on provider
// LAUNCH-BLOCKING FIX: mpesa, orange_money, dhl and libooks all have real,
// working backend functions (mpesa-payments, orange-money-payments,
// dhl-shipping, libooks-sync) but had no case here — every connection
// attempt fell through to the "not supported yet" default below, and
// IntegrationCredentialForm.tsx only saves a connection after a
// successful test, so these four apps could never actually be connected
// from the UI at all, despite being fully functional once connected.
async function testMpesa(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const consumerKey = credentials.consumer_key;
    const consumerSecret = credentials.consumer_secret;
    if (!consumerKey || !consumerSecret) {
      return { success: false, message: "Missing consumer_key or consumer_secret", error: "MISSING_CREDENTIAL" };
    }
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const response = await fetch("https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!response.ok) {
      return { success: false, message: "Invalid M-Pesa (Daraja) credentials", error: "INVALID_CREDENTIALS" };
    }
    return { success: true, message: "Successfully connected to M-Pesa" };
  } catch (err) {
    return { success: false, message: `M-Pesa connection failed: ${err.message}`, error: "REQUEST_FAILED" };
  }
}

async function testOrangeMoney(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const clientId = credentials.client_id;
    const clientSecret = credentials.client_secret;
    if (!clientId || !clientSecret) {
      return { success: false, message: "Missing client_id or client_secret", error: "MISSING_CREDENTIAL" };
    }
    const response = await fetch("https://api.orange.com/oauth/v3/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    });
    if (!response.ok) {
      return { success: false, message: "Invalid Orange Money credentials", error: "INVALID_CREDENTIALS" };
    }
    return { success: true, message: "Successfully connected to Orange Money" };
  } catch (err) {
    return { success: false, message: `Orange Money connection failed: ${err.message}`, error: "REQUEST_FAILED" };
  }
}

async function testDhl(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const apiKey = credentials.api_key;
    if (!apiKey) return { success: false, message: "Missing api_key", error: "MISSING_CREDENTIAL" };
    // No dedicated "whoami" endpoint on DHL's API — a tracking lookup with
    // a bogus number still distinguishes a bad key (401/403) from a
    // working one (any other status, including "shipment not found").
    const response = await fetch("https://api.dhl.com/track?trackingNumber=0000000000", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 401 || response.status === 403) {
      return { success: false, message: "Invalid DHL API key", error: "INVALID_CREDENTIALS" };
    }
    return { success: true, message: "Successfully connected to DHL" };
  } catch (err) {
    return { success: false, message: `DHL connection failed: ${err.message}`, error: "REQUEST_FAILED" };
  }
}

async function testLibooks(credentials: Record<string, string>): Promise<TestConnectionResponse> {
  try {
    const apiKey = credentials.api_key;
    if (!apiKey) return { success: false, message: "Missing api_key", error: "MISSING_CREDENTIAL" };
    const response = await fetch("https://api.libooks.io/v1/accounts", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      return { success: false, message: "Invalid Libooks API key", error: "INVALID_CREDENTIALS" };
    }
    return { success: true, message: "Successfully connected to Libooks" };
  } catch (err) {
    return { success: false, message: `Libooks connection failed: ${err.message}`, error: "REQUEST_FAILED" };
  }
}

async function testConnection(
  provider: string,
  credentials: Record<string, string>
): Promise<TestConnectionResponse> {
  switch (provider) {
    case "stripe":
      return testStripe(credentials);
    case "paypal":
      return testPayPal(credentials);
    case "flutterwave":
      return testFlutterwave(credentials);
    case "paystack":
      return testPaystack(credentials);
    case "payunit":
      return testPayUnit(credentials);
    case "sellia":
      return testSellia(credentials);
    case "twilio":
      return testTwilio(credentials);
    case "telegram":
      return testTelegram(credentials);
    case "mpesa":
      return testMpesa(credentials);
    case "orange_money":
      return testOrangeMoney(credentials);
    case "dhl":
      return testDhl(credentials);
    case "libooks":
      return testLibooks(credentials);
    case "google_gemini":
      return testGoogleGemini(credentials);
    default:
      return { success: false, message: `Provider ${provider} not supported yet`, error: "UNSUPPORTED_PROVIDER" };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { provider_key, credentials, tenant_id } = (await req.json()) as TestConnectionRequest;

    if (!provider_key || !credentials || !tenant_id) {
      return new Response(JSON.stringify({ success: false, message: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await testConnection(provider_key, credentials);

    // BUG FIX: this used to be `status: result.success ? 200 : 400`. The
    // frontend calls this via supabase.functions.invoke(), whose JS SDK
    // treats ANY non-2xx response as a generic FunctionsHttpError and
    // replaces response.error.message with the hardcoded string "Edge
    // Function returned a non-2xx status code" — discarding this
    // function's own carefully written result.message entirely
    // (IntegrationCredentialForm.tsx reads response.error.message first).
    // This is exactly the bug reported for Telegram ("Provider telegram
    // not supported yet" was the real reason, but the user only ever saw
    // the generic SDK message) — and it silently affected EVERY provider's
    // failure case (wrong API key, expired token, etc.), not just
    // Telegram. A failed *test* is valid response data, not an HTTP
    // error — this endpoint's job is to report success/failure, so it
    // always returns 200 now. Genuine request/server problems (missing
    // fields, an uncaught exception) still return 400/500 below, since
    // those really are errors this endpoint couldn't process at all.
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: `Server error: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
