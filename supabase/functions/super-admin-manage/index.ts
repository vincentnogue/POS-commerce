import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MIN_PLATFORM_ADMINS = 2; // Never allow the allowlist to drop below this.

async function sb(supabaseUrl: string, serviceRoleKey: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return res;
}

async function findUserByEmail(supabaseUrl: string, serviceRoleKey: string, email: string) {
  const res = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const users = Array.isArray(data) ? data : data.users ?? [];
  return users.find((u: any) => (u.email ?? '').toLowerCase() === email.toLowerCase()) ?? null;
}

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

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    // --- Authorization: caller must themselves be a fully verified platform admin. ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: serviceRoleKey },
    });
    if (!userRes.ok) return json({ error: 'Unauthorized' }, 401);
    const callerUser = await userRes.json();
    const callerEmail = (callerUser.email ?? '').toLowerCase();

    const callerAdminRes = await sb(supabaseUrl, serviceRoleKey, `platform_admins?email=eq.${encodeURIComponent(callerEmail)}&select=email`);
    const callerAdminData = await callerAdminRes.json();
    const callerIsPlatformAdmin = Array.isArray(callerAdminData) && callerAdminData.length > 0;

    const callerMemberRes = await sb(supabaseUrl, serviceRoleKey, `tenant_members?user_id=eq.${callerUser.id}&role=eq.super_admin&select=id`);
    const callerMemberData = await callerMemberRes.json();
    const callerIsSuperAdmin = Array.isArray(callerMemberData) && callerMemberData.length > 0;

    if (!callerIsPlatformAdmin || !callerIsSuperAdmin) {
      return json({ error: 'Forbidden: super admin access required' }, 403);
    }

    const { action, email, label } = await req.json();
    const targetEmail = (email ?? '').toLowerCase().trim();

    if (action === 'list') {
      const res = await sb(supabaseUrl, serviceRoleKey, `platform_admins?select=*&order=created_at.asc`);
      return json({ admins: await res.json() });
    }

    if (action === 'add') {
      if (!targetEmail) return json({ error: 'Email requis' }, 400);

      const existingRes = await sb(supabaseUrl, serviceRoleKey, `platform_admins?email=eq.${encodeURIComponent(targetEmail)}&select=id`);
      const existing = await existingRes.json();
      if (Array.isArray(existing) && existing.length > 0) {
        return json({ error: 'Cet email est déjà administrateur.' }, 400);
      }

      const insertRes = await sb(supabaseUrl, serviceRoleKey, 'platform_admins', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ email: targetEmail, label: label || 'Admin plateforme' }),
      });
      if (!insertRes.ok) return json({ error: 'Échec insertion platform_admins' }, 500);

      // If a matching account already exists, also grant them the super_admin
      // tenant role so they pass BOTH checks immediately. If the account
      // doesn't exist yet, they'll only get access once they sign up AND
      // someone promotes their tenant_members role (they're on the allowlist
      // in the meantime, but the second check will still block them).
      const targetUser = await findUserByEmail(supabaseUrl, serviceRoleKey, targetEmail);
      if (targetUser) {
        const memberRes = await sb(supabaseUrl, serviceRoleKey, `tenant_members?user_id=eq.${targetUser.id}&select=id,role&limit=1`);
        const members = await memberRes.json();
        if (Array.isArray(members) && members.length > 0) {
          await sb(supabaseUrl, serviceRoleKey, `tenant_members?user_id=eq.${targetUser.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ role: 'super_admin' }),
          });
        } else {
          const tenantRes = await sb(supabaseUrl, serviceRoleKey, `tenants?select=id&order=created_at.asc&limit=1`);
          const tenants = await tenantRes.json();
          const firstTenantId = tenants?.[0]?.id;
          if (firstTenantId) {
            await sb(supabaseUrl, serviceRoleKey, 'tenant_members', {
              method: 'POST',
              body: JSON.stringify({ tenant_id: firstTenantId, user_id: targetUser.id, role: 'super_admin' }),
            });
          }
        }
      }

      return json({ success: true, accountExists: !!targetUser });
    }

    if (action === 'remove') {
      if (!targetEmail) return json({ error: 'Email requis' }, 400);

      const countRes = await sb(supabaseUrl, serviceRoleKey, `platform_admins?select=id`);
      const allAdmins = await countRes.json();
      if (!Array.isArray(allAdmins) || allAdmins.length <= MIN_PLATFORM_ADMINS) {
        return json({ error: `Impossible : il doit rester au moins ${MIN_PLATFORM_ADMINS} administrateurs de la plateforme.` }, 400);
      }

      const delRes = await sb(supabaseUrl, serviceRoleKey, `platform_admins?email=eq.${encodeURIComponent(targetEmail)}`, { method: 'DELETE' });
      if (!delRes.ok) return json({ error: 'Échec suppression' }, 500);

      // Demote (don't destroy) their tenant role so they keep normal access
      // to their own store, they just lose platform-wide super admin power.
      const targetUser = await findUserByEmail(supabaseUrl, serviceRoleKey, targetEmail);
      if (targetUser) {
        await sb(supabaseUrl, serviceRoleKey, `tenant_members?user_id=eq.${targetUser.id}&role=eq.super_admin`, {
          method: 'PATCH',
          body: JSON.stringify({ role: 'admin' }),
        });
      }

      return json({ success: true });
    }

    if (action === 'update_label') {
      if (!targetEmail) return json({ error: 'Email requis' }, 400);
      const res = await sb(supabaseUrl, serviceRoleKey, `platform_admins?email=eq.${encodeURIComponent(targetEmail)}`, {
        method: 'PATCH',
        body: JSON.stringify({ label }),
      });
      if (!res.ok) return json({ error: 'Échec mise à jour' }, 500);
      return json({ success: true });
    }

    return json({ error: 'Action inconnue' }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
