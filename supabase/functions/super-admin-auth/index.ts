import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': serviceRoleKey },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ authorized: false, reason: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = await userRes.json();
    const email = (user.email ?? '').toLowerCase();
    const userId = user.id;

    const adminRes = await fetch(`${supabaseUrl}/rest/v1/platform_admins?email=eq.${encodeURIComponent(email)}&select=email,label`, {
      headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` },
    });
    const adminData = await adminRes.json();
    const isAuthorized = Array.isArray(adminData) && adminData.length > 0;

    const memberRes = await fetch(
      `${supabaseUrl}/rest/v1/tenant_members?user_id=eq.${userId}&role=eq.super_admin&select=id`,
      { headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` } },
    );
    const memberData = await memberRes.json();
    const isSuperAdminRole = Array.isArray(memberData) && memberData.length > 0;

    const fullyAuthorized = isAuthorized && isSuperAdminRole;

    await fetch(`${supabaseUrl}/rest/v1/super_admin_access_log`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        actor_email: email,
        actor_user_id: userId,
        authorized: fullyAuthorized,
        reason: fullyAuthorized
          ? 'Access granted'
          : !isAuthorized
            ? 'Email not in platform_admins allowlist'
            : 'User does not have super_admin role',
      }),
    });

    if (!fullyAuthorized) {
      return new Response(JSON.stringify({
        authorized: false,
        reason: !isAuthorized
          ? 'Email non autorise. Acces reserve aux administrateurs de la plateforme.'
          : 'Role super_admin requis.',
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      authorized: true,
      email,
      label: adminData[0]?.label ?? 'Admin',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
