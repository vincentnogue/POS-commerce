import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface NotificationRequest {
  tenant_id: string;
  connection_id: string;
  action: "send_sms" | "send_whatsapp" | "send_bulk";
  channel: "sms" | "whatsapp";
  recipients: Array<{
    phone: string;
    name?: string;
  }>;
  template: string;
  variables?: Record<string, string>;
  media_url?: string;
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  toNumber: string,
  message: string
): Promise<{ messageSid?: string; error?: string }> {
  try {
    const formData = new URLSearchParams();
    formData.append("From", fromNumber);
    formData.append("To", toNumber);
    formData.append("Body", message);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || "SMS sending failed" };
    }

    const data = await response.json();
    return { messageSid: data.sid };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Send WhatsApp via Twilio
 */
async function sendWhatsApp(
  accountSid: string,
  authToken: string,
  fromWhatsAppNumber: string,
  toPhoneNumber: string,
  message: string,
  mediaUrl?: string
): Promise<{ messageSid?: string; error?: string }> {
  try {
    const formData = new URLSearchParams();
    formData.append("From", `whatsapp:${fromWhatsAppNumber}`);
    formData.append("To", `whatsapp:${toPhoneNumber}`);
    formData.append("Body", message);

    if (mediaUrl) {
      formData.append("MediaUrl", mediaUrl);
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || "WhatsApp sending failed" };
    }

    const data = await response.json();
    return { messageSid: data.sid };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Render template with variables
 */
function renderTemplate(template: string, variables?: Record<string, string>): string {
  if (!variables) return template;

  let rendered = template;
  Object.entries(variables).forEach(([key, value]) => {
    rendered = rendered.replace(new RegExp(`\\$\\{${key}\\}`, "g"), value);
  });
  return rendered;
}

/**
 * Get Twilio credentials
 */
async function getTwilioCredentials(
  supabaseUrl: string,
  serviceRoleKey: string,
  connectionId: string,
  tenantId: string
): Promise<{
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  fromWhatsApp?: string;
  error?: string;
}> {
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
      return {
        accountSid: parsed.account_sid,
        authToken: parsed.auth_token,
        fromNumber: parsed.from_number,
        fromWhatsApp: parsed.from_whatsapp,
      };
    }

    return { error: "Invalid credential format" };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Log notification
 */
async function logNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  tenantId: string,
  connectionId: string,
  channel: string,
  recipientCount: number,
  successCount: number,
  failureCount: number
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
      sync_type: "notification",
      direction: "push",
      status: failureCount === 0 ? "completed" : "partial",
      items_processed: recipientCount,
      items_created: successCount,
      items_updated: failureCount,
      error_message: failureCount > 0 ? `${failureCount} notifications failed` : null,
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

    const body = (await req.json()) as NotificationRequest;

    if (!body.tenant_id || !body.connection_id || !body.recipients?.length) {
      // BUG FIX: same masking issue fixed in integration-test-connection/
      // ai-generate — supabase.functions.invoke() (used by MessagesPage.tsx
      // and the auto-WhatsApp-receipt call in POSPage.tsx) replaces this
      // message with a generic "non-2xx status code" string for ANY
      // non-2xx response. A failed send attempt is valid response data,
      // not an HTTP-level error.
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: strict multi-tenant isolation — same fix/rationale as
    // stripe-payments and the other payment functions. Without this, any
    // authenticated user of ANY tenant could pass a different tenant's
    // connection_id and send SMS/WhatsApp — including a bulk blast to an
    // entire customer list via the Messages feature — on THAT tenant's
    // Twilio bill, to arbitrary phone numbers. Found during a follow-up
    // security audit of every edge function after the stripe-payments fix.
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
    // A bulk blast to many recipients costs more and carries more
    // reputational risk than a single transactional receipt — same
    // manager+ restriction as the Messages page itself already enforces
    // client-side (module permission), now also enforced server-side so
    // it can't be bypassed by calling the function directly.
    if (body.recipients.length > 1 && !["admin", "manager", "super_admin"].includes(callerMember.role)) {
      return new Response(
        JSON.stringify({ success: false, message: "Insufficient permission for a bulk send" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // RATE LIMIT: each message costs the tenant real Twilio usage, and a
    // bulk send reaches real customers — a runaway loop here means real
    // money spent and real people spammed. Single transactional sends
    // (POS receipts) are rate-limited separately and generously from
    // bulk campaigns, since a busy store can legitimately ring up many
    // sales per hour but has no reason to launch dozens of broadcast
    // campaigns in that time.
    const isBulk = body.recipients.length > 1;
    const rlRes = await fetch(`${supabaseUrl}/rest/v1/rpc/check_rate_limit`, {
      method: "POST",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_tenant_id: body.tenant_id,
        p_function_name: isBulk ? "notifications-twilio:bulk" : "notifications-twilio:single",
        p_max_calls: isBulk ? 10 : 200,
        p_window_minutes: isBulk ? 1440 : 60,
      }),
    });
    const allowed = await rlRes.json().catch(() => true);
    if (allowed === false) {
      return new Response(
        // BUG FIX: same masking issue fixed elsewhere in this function's
        // other responses — a rate-limit rejection is a valid outcome of
        // an otherwise-legitimate request, not an infrastructure
        // failure, so it gets 200 + success:false rather than a status
        // the frontend SDK would mask with a generic message.
        JSON.stringify({ success: false, message: isBulk ? "Daily campaign limit reached — try again tomorrow" : "Rate limit reached — try again in a bit" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Twilio credentials
    const { accountSid, authToken, fromNumber, fromWhatsApp, error: credError } =
      await getTwilioCredentials(supabaseUrl, serviceRoleKey, body.connection_id, body.tenant_id);

    if (credError || !accountSid || !authToken) {
      return new Response(
        JSON.stringify({ success: false, message: credError || "No Twilio credentials" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const renderedMessage = renderTemplate(body.template, body.variables);
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Send to all recipients
    for (const recipient of body.recipients) {
      try {
        let result;
        if (body.channel === "sms") {
          if (!fromNumber) {
            throw new Error("SMS not configured");
          }
          result = await sendSMS(accountSid, authToken, fromNumber, recipient.phone, renderedMessage);
        } else if (body.channel === "whatsapp") {
          if (!fromWhatsApp) {
            throw new Error("WhatsApp not configured");
          }
          result = await sendWhatsApp(
            accountSid,
            authToken,
            fromWhatsApp,
            recipient.phone,
            renderedMessage,
            body.media_url
          );
        }

        if (result?.error) {
          failureCount++;
          results.push({
            phone: recipient.phone,
            status: "failed",
            error: result.error,
          });
        } else {
          successCount++;
          results.push({
            phone: recipient.phone,
            status: "sent",
            messageSid: result?.messageSid,
          });
        }
      } catch (err) {
        failureCount++;
        results.push({
          phone: recipient.phone,
          status: "failed",
          error: err.message,
        });
      }
    }

    await logNotification(
      supabaseUrl,
      serviceRoleKey,
      body.tenant_id,
      body.connection_id,
      body.channel,
      body.recipients.length,
      successCount,
      failureCount
    );

    return new Response(
      JSON.stringify({
        success: failureCount === 0,
        sent: successCount,
        failed: failureCount,
        total: body.recipients.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Notification error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
