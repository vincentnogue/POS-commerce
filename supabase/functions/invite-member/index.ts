import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    // Verify the caller is authenticated
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData.user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = callerData.user.id;

    const body = await req.json();
    const { email, tenant_id, role, display_name, avatar_color, password } = body;
    if (!email || !tenant_id || !role) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password !== undefined && password !== null && String(password).length < 6) {
      return new Response(JSON.stringify({ error: "Le mot de passe doit contenir au moins 6 caractères." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is an admin/manager of this tenant
    const { data: callerMember } = await adminClient
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", callerId)
      .maybeSingle();

    const callerRole = callerMember?.role;
    const isSuperAdmin = callerRole === "super_admin";
    if (!callerRole || !["admin", "super_admin", "manager"].includes(callerRole)) {
      return new Response(JSON.stringify({ error: "Permission refusée" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the target user by email
    const { data: existingId } = await adminClient.rpc("get_user_id_by_email", { p_email: email });
    let targetUserId: string | null = existingId ?? null;
    let createdWithPassword = false;

    // If the user doesn't exist yet: either the admin set an initial password
    // directly (staff who won't check email — counter/shop-floor accounts),
    // or fall back to the existing email-invite flow.
    if (!targetUserId) {
      if (password) {
        const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createErr || !createData.user) {
          return new Response(JSON.stringify({ error: createErr?.message ?? "Impossible de créer le compte." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        targetUserId = createData.user.id;
        createdWithPassword = true;
      } else {
        const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email);
        if (inviteErr || !inviteData.user) {
          return new Response(JSON.stringify({ error: inviteErr?.message ?? "Impossible d'inviter l'utilisateur" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        targetUserId = inviteData.user.id;
      }
    }

    // Prevent duplicate membership
    const { data: existingMembership } = await adminClient
      .from("tenant_members")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (existingMembership) {
      return new Response(JSON.stringify({ error: "Cet utilisateur est déjà membre." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the membership
    const { data: newMember, error: insertErr } = await adminClient
      .from("tenant_members")
      .insert({
        tenant_id,
        user_id: targetUserId,
        role,
        display_name: display_name || email.split("@")[0],
        avatar_color: avatar_color || "brand",
        invited_at: new Date().toISOString(),
      })
      .select("staff_code")
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = createdWithPassword
      ? "Compte créé avec le mot de passe défini"
      : existingId
        ? "Membre ajouté"
        : "Invitation envoyée par email";

    return new Response(
      JSON.stringify({
        message,
        user_id: targetUserId,
        invited: !existingId && !createdWithPassword,
        created_with_password: createdWithPassword,
        staff_code: newMember?.staff_code ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
