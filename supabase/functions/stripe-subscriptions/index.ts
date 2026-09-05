import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SubscriptionRequest {
  tenant_id: string;
  plan_id: string; // basic, pro, premium, enterprise
  billing_cycle: "monthly" | "annual";
  payment_method_id?: string; // Stripe PaymentMethod ID
}

interface CancelSubscriptionRequest {
  tenant_id: string;
  cancel_at_period_end?: boolean; // false = immediate, true = at end of billing period
}

/**
 * Create Stripe subscription from trial
 */
async function createStripeSubscription(
  stripeSecretKey: string,
  customerId: string,
  priceId: string,
  paymentMethodId?: string
): Promise<{ subscriptionId?: string; clientSecret?: string; error?: string }> {
  try {
    // If customer doesn't exist, create it first
    if (!customerId) {
      const customerRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          metadata: { source: "pos-flow" },
        }).toString(),
      });

      if (!customerRes.ok) {
        return { error: "Failed to create Stripe customer" };
      }

      const customerData = await customerRes.json();
      customerId = customerData.id;
    }

    // Create subscription
    const subscriptionBody: Record<string, any> = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
        default_mandate: null,
      },
      expand: ["latest_invoice.payment_intent"],
    };

    if (paymentMethodId) {
      subscriptionBody.default_payment_method = paymentMethodId;
    }

    const subscriptionRes = await fetch("https://api.stripe.com/v1/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(subscriptionBody).toString(),
    });

    if (!subscriptionRes.ok) {
      const error = await subscriptionRes.json();
      return { error: error.error?.message || "Subscription creation failed" };
    }

    const subscriptionData = await subscriptionRes.json();
    const paymentIntent = subscriptionData.latest_invoice?.payment_intent;

    return {
      subscriptionId: subscriptionData.id,
      clientSecret: paymentIntent?.client_secret,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Cancel subscription
 */
async function cancelStripeSubscription(
  stripeSecretKey: string,
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = false
): Promise<{ canceled?: boolean; error?: string }> {
  try {
    const body: Record<string, any> = {};
    if (cancelAtPeriodEnd) {
      body.cancel_at_period_end = true;
    }

    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(body).toString(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error?.message || "Cancellation failed" };
    }

    const data = await response.json();
    return { canceled: data.status === "canceled" || cancelAtPeriodEnd };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Get subscription status
 */
async function getSubscriptionStatus(
  stripeSecretKey: string,
  subscriptionId: string
): Promise<{ status?: string; currentPeriodEnd?: number; error?: string }> {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error?.message || "Subscription fetch failed" };
    }

    const data = await response.json();
    return {
      status: data.status,
      currentPeriodEnd: data.current_period_end,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Get Stripe credentials
 */
async function getStripeCredentials(
  _supabaseUrl: string,
  _serviceRoleKey: string
): Promise<{ secretKey?: string; publishableKey?: string; error?: string }> {
  try {
    // For SaaS subscriptions, use environment variables
    const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY");

    if (!secretKey || !publishableKey) {
      return { error: "Stripe keys not configured" };
    }

    return { secretKey, publishableKey };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Update tenant subscription in database
 */
async function updateTenantSubscription(
  supabaseUrl: string,
  serviceRoleKey: string,
  tenantId: string,
  subscriptionId: string,
  status: string,
  planId: string,
  trialEndsAt: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/tenants?id=eq.${tenantId}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          plan_id: planId,
          trial_ends_at: trialEndsAt, // Clear trial when subscribed
          status: status === "active" ? "active" : "pending",
        }),
      }
    );

    if (!response.ok) {
      return { success: false, error: "Failed to update tenant" };
    }

    // Also create payment verification record
    await fetch(`${supabaseUrl}/rest/v1/payment_verification`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        verification_type: "subscription",
        status: status === "active" ? "verified" : "pending",
        payment_method: "stripe_subscription",
        payment_reference: subscriptionId,
        verified_at: status === "active" ? new Date().toISOString() : null,
      }),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
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

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "create_subscription";

    if (req.method === "POST") {
      const body = (await req.json()) as SubscriptionRequest | CancelSubscriptionRequest;

      if (!body.tenant_id) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing tenant_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: strict multi-tenant isolation — same fix/rationale as
      // stripe-payments and the other functions fixed in this audit.
      // Without this, any authenticated user of ANY tenant could pass a
      // different tenant's tenant_id and cancel THAT tenant's paid
      // subscription — a real denial-of-service against another
      // business, locking them out of their own POS system. Found
      // during a follow-up security audit of every edge function after
      // the stripe-payments fix.
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
      if (action === "cancel_subscription" && !["admin", "manager", "super_admin"].includes(callerMember.role)) {
        return new Response(
          JSON.stringify({ success: false, message: "Insufficient permission to cancel the subscription" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get Stripe credentials
      const { secretKey, publishableKey, error: credError } = await getStripeCredentials(
        supabaseUrl,
        serviceRoleKey
      );

      if (credError || !secretKey || !publishableKey) {
        return new Response(
          JSON.stringify({ success: false, message: credError || "Stripe not configured" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "create_subscription") {
        const subReq = body as SubscriptionRequest;
        
        // Map plan to Stripe price ID
        const priceMap: Record<string, Record<string, string>> = {
          basic: { monthly: "price_basic_monthly", annual: "price_basic_annual" },
          pro: { monthly: "price_pro_monthly", annual: "price_pro_annual" },
          premium: { monthly: "price_premium_monthly", annual: "price_premium_annual" },
          enterprise: { monthly: "price_enterprise_monthly", annual: "price_enterprise_annual" },
        };

        const priceId = priceMap[subReq.plan_id]?.[subReq.billing_cycle];
        if (!priceId) {
          return new Response(
            JSON.stringify({ success: false, message: "Invalid plan or billing cycle" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await createStripeSubscription(
          secretKey,
          "", // Will create new customer
          priceId,
          subReq.payment_method_id
        );

        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update tenant
        await updateTenantSubscription(
          supabaseUrl,
          serviceRoleKey,
          subReq.tenant_id,
          result.subscriptionId!,
          "active",
          subReq.plan_id,
          null // Clear trial end date
        );

        return new Response(
          JSON.stringify({
            success: true,
            subscriptionId: result.subscriptionId,
            clientSecret: result.clientSecret,
            publishableKey,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "cancel_subscription") {
        const cancelReq = body as CancelSubscriptionRequest;
        const subscriptionId = url.searchParams.get("subscription_id");

        if (!subscriptionId) {
          return new Response(
            JSON.stringify({ success: false, message: "Missing subscription_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await cancelStripeSubscription(
          secretKey,
          subscriptionId,
          cancelReq.cancel_at_period_end || false
        );

        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            canceled: result.canceled,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "get_status") {
        const subscriptionId = url.searchParams.get("subscription_id");

        if (!subscriptionId) {
          return new Response(
            JSON.stringify({ success: false, message: "Missing subscription_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await getSubscriptionStatus(secretKey, subscriptionId);

        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: result.status,
            currentPeriodEnd: result.currentPeriodEnd,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, message: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Subscription error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
