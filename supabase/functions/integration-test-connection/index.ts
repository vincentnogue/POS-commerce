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

// Router: dispatch test based on provider
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

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: `Server error: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
