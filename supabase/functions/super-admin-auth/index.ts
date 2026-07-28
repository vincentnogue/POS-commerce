import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Sections that can NEVER be delegated to platform_staff, regardless of
// what's in their `permissions` — managing other Super Admins is always
// restricted to full platform_admins.
const STAFF_NON_GRANTABLE = ['admins'];

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

  const sbGet = (path: string) => fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });

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

    const [adminData, staffData, memberData] = await Promise.all([
      sbGet(`platform_admins?email=eq.${encodeURIComponent(email)}&select=email,label`).then((r) => r.json()),
      sbGet(`platform_staff?email=eq.${encodeURIComponent(email)}&select=email,label,permissions`).then((r) => r.json()),
      sbGet(`tenant_members?user_id=eq.${userId}&role=eq.super_admin&select=id`).then((r) => r.json()),
    ]);

    const isFullAdmin = Array.isArray(adminData) && adminData.length > 0;
    const staffRecord = Array.isArray(staffData) && staffData.length > 0 ? staffData[0] : null;
    const isStaff = !!staffRecord;
    const isSuperAdminRole = Array.isArray(memberData) && memberData.length > 0;

    // Full admins get everything. Staff get only what's in their permissions
    // object, minus the never-grantable sections, and only if they also
    // carry the super_admin tenant role (needed for the underlying reads).
    const fullyAuthorized = (isFullAdmin || isStaff) && isSuperAdminRole;

    let permissions: Record<string, boolean> | null = null;
    if (fullyAuthorized && !isFullAdmin && isStaff) {
      permissions = { ...staffRecord.permissions };
      for (const key of STAFF_NON_GRANTABLE) delete permissions[key];
    }

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
          ? (isFullAdmin ? 'Access granted (full admin)' : 'Access granted (staff, scoped)')
          : !(isFullAdmin || isStaff)
            ? 'Email not in platform_admins/platform_staff allowlist'
            : 'User does not have super_admin role',
      }),
    });

    if (!fullyAuthorized) {
      return new Response(JSON.stringify({
        authorized: false,
        reason: !(isFullAdmin || isStaff)
          ? 'Email non autorise. Acces reserve au personnel de la plateforme.'
          : 'Role super_admin requis.',
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      authorized: true,
      email,
      label: isFullAdmin ? (adminData[0]?.label ?? 'Admin') : (staffRecord?.label ?? 'Staff'),
      isFullAdmin,
      permissions, // null for full admins (no restriction); object for staff
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
