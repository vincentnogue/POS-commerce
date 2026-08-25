import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ShipmentData {
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  recipient_address: string;
  recipient_city: string;
  recipient_postcode: string;
  recipient_country: string;
  weight_kg: number;
  contents: string;
  value: number;
  currency: string;
}

interface DhlShipmentRequest {
  tenant_id: string;
  connection_id: string;
  action: "create_shipment" | "get_label" | "track_shipment";
  shipment?: ShipmentData;
  shipment_id?: string;
  tracking_number?: string;
}

/**
 * Create DHL shipment
 */
async function createDhlShipment(
  apiKey: string,
  shipment: ShipmentData
): Promise<{ shipmentId?: string; trackingNumber?: string; labelUrl?: string; error?: string }> {
  try {
    const response = await fetch("https://api.dhl.com/shipments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plannedShippingDateAndTime: new Date().toISOString(),
        inshipments: [
          {
            inshipmentType: "STANDARD_SHIPMENT",
            shipmentInfo: {
              isCustomsDeclarable: true,
              weight: {
                volumetricWeight: shipment.weight_kg,
                unitOfMeasurement: "KG",
              },
              totalWeight: shipment.weight_kg,
              unitOfMeasurement: "KG",
            },
          },
        ],
        customerDetails: {
          shipperDetails: {
            postalAddress: {
              postalCode: "10001",
              cityName: "New York",
              countryCode: "US",
              addressLine1: "123 Business Ave",
            },
          },
          receiverDetails: {
            postalAddress: {
              postalCode: shipment.recipient_postcode,
              cityName: shipment.recipient_city,
              countryCode: shipment.recipient_country.substring(0, 2),
              addressLine1: shipment.recipient_address,
            },
            contactInformation: {
              email: shipment.recipient_email,
              phone: shipment.recipient_phone,
              fullName: shipment.recipient_name,
            },
          },
        },
        content: {
          isCustomsDeclarable: true,
          itemTypeCode: "DOCUMENTS",
          declaredValue: shipment.value,
          declaredValueCurrency: shipment.currency,
          exportDeclaration: {
            lineItems: [
              {
                number: 1,
                description: shipment.contents,
                quantity: 1,
                quantityUnitOfMeasurement: "PCS",
                weight: shipment.weight_kg,
                weightUnitOfMeasurement: "KG",
                value: shipment.value,
              },
            ],
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || "Shipment creation failed" };
    }

    const data = await response.json();
    return {
      shipmentId: data.shipmentTrackingNumber,
      trackingNumber: data.shipmentTrackingNumber,
      labelUrl: data.documents?.[0]?.content || "",
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Get DHL shipping label
 */
async function getDhlLabel(
  apiKey: string,
  shipmentId: string
): Promise<{ labelUrl?: string; labelBase64?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://api.dhl.com/shipments/${shipmentId}/documents`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || "Label retrieval failed" };
    }

    const data = await response.json();
    return {
      labelUrl: data.documents?.[0]?.url,
      labelBase64: data.documents?.[0]?.content,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Track DHL shipment
 */
async function trackDhlShipment(
  apiKey: string,
  trackingNumber: string
): Promise<{ status: string; lastLocation?: string; estimatedDelivery?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://api.dhl.com/track?trackingNumber=${trackingNumber}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { status: "error", error: error.message || "Tracking failed" };
    }

    const data = await response.json();
    const shipment = data.shipments?.[0];
    return {
      status: shipment?.status?.statusCode || "unknown",
      lastLocation: shipment?.lastEvent?.location?.name,
      estimatedDelivery: shipment?.estimatedTimeOfDelivery,
    };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

/**
 * Get DHL credentials
 */
async function getDhlCredentials(
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
    const action = url.searchParams.get("action") || "create_shipment";

    if (req.method === "POST") {
      const body = (await req.json()) as DhlShipmentRequest;

      if (!body.tenant_id || !body.connection_id) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get DHL credentials
      const { apiKey, error: credError } = await getDhlCredentials(
        supabaseUrl,
        serviceRoleKey,
        body.connection_id,
        body.tenant_id
      );

      if (credError || !apiKey) {
        return new Response(
          JSON.stringify({ success: false, message: credError || "No DHL credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (body.action === "create_shipment") {
        if (!body.shipment) {
          return new Response(
            JSON.stringify({ success: false, message: "Missing shipment data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await createDhlShipment(apiKey, body.shipment);
        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            shipmentId: result.shipmentId,
            trackingNumber: result.trackingNumber,
            labelUrl: result.labelUrl,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (body.action === "get_label") {
        if (!body.shipment_id) {
          return new Response(
            JSON.stringify({ success: false, message: "Missing shipment_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await getDhlLabel(apiKey, body.shipment_id);
        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, message: result.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            labelUrl: result.labelUrl,
            labelBase64: result.labelBase64,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (body.action === "track_shipment") {
        if (!body.tracking_number) {
          return new Response(
            JSON.stringify({ success: false, message: "Missing tracking_number" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await trackDhlShipment(apiKey, body.tracking_number);
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
            lastLocation: result.lastLocation,
            estimatedDelivery: result.estimatedDelivery,
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
    console.error("DHL error:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
