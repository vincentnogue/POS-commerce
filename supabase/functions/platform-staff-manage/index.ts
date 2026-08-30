import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Mirrors the tab ids used in SuperAdminPage.tsx. 'admins' is intentionally
// excluded — that section can never be delegated to staff.
const GRANTABLE_SECTIONS = [
  'overview', 'tenants', 'employees', 'subscriptions', 'plans', 'codes',
  'performance', 'audit', 'monitoring', 'comms', 'cms',
];

async function sb(supabaseUrl: string, key: string, path: string, init: RequestInit = {}) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server not configured' }, 503);

  try {
    // --- Only FULL platform admins can manage staff — not staff themselves. ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: serviceRoleKey } });
    if (!userRes.ok) return json({ error: 'Unauthorized' }, 401);
    const callerUser = await userRes.json();
    const callerEmail = (callerUser.email ?? '').toLowerCase();

    const adminCheck = await (await sb(supabaseUrl, serviceRoleKey, `platform_admins?email=eq.${encodeURIComponent(callerEmail)}&select=email`)).json();
    const memberCheck = await (await sb(supabaseUrl, serviceRoleKey, `tenant_members?user_id=eq.${callerUser.id}&role=eq.super_admin&select=id`)).json();
    if (!(Array.isArray(adminCheck) && adminCheck.length > 0) || !(Array.isArray(memberCheck) && memberCheck.length > 0)) {
      return json({ error: 'Forbidden: full platform admin access required' }, 403);
    }

    const { action, email, label, permissions } = await req.json();
    const targetEmail = (email ?? '').toLowerCase().trim();

    if (action === 'list') {
      const res = await sb(supabaseUrl, serviceRoleKey, `platform_staff?select=*&order=created_at.desc`);
      return json({ staff: await res.json() });
    }

    // Sanitize permissions: only known, grantable sections, booleans only.
    const cleanPermissions = (raw: any) => {
      const out: Record<string, boolean> = {};
      for (const k of GRANTABLE_SECTIONS) out[k] = !!raw?.[k];
      return out;
    };

    if (action === 'add') {
      if (!targetEmail) return json({ error: 'Email requis' }, 400);
      const existingRes = await sb(supabaseUrl, serviceRoleKey, `platform_staff?email=eq.${encodeURIComponent(targetEmail)}&select=id`);
      const existing = await existingRes.json();
      if (Array.isArray(existing) && existing.length > 0) return json({ error: 'Ce membre du staff existe déjà.' }, 400);

      const insertRes = await sb(supabaseUrl, serviceRoleKey, 'platform_staff', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ email: targetEmail, label: label || 'Staff', permissions: cleanPermissions(permissions), created_by: callerEmail }),
      });
      if (!insertRes.ok) return json({ error: 'Échec insertion' }, 500);

      // Grant the underlying super_admin tenant role needed for reads (see
      // migration 0020 note). If the account doesn't exist yet, they'll get
      // access once they sign up AND this role is (re-)applied.
      const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(targetEmail)}`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
      const usersData = usersRes.ok ? await usersRes.json() : null;
      const users = Array.isArray(usersData) ? usersData : usersData?.users ?? [];
      const targetUser = users.find((u: any) => (u.email ?? '').toLowerCase() === targetEmail) ?? null;

      if (targetUser) {
        const memberRes = await sb(supabaseUrl, serviceRoleKey, `tenant_members?user_id=eq.${targetUser.id}&select=id&limit=1`);
        const members = await memberRes.json();
        if (Array.isArray(members) && members.length > 0) {
          await sb(supabaseUrl, serviceRoleKey, `tenant_members?user_id=eq.${targetUser.id}`, {
            method: 'PATCH', body: JSON.stringify({ role: 'super_admin' }),
          });
        } else {
          const tenantRes = await sb(supabaseUrl, serviceRoleKey, `tenants?select=id&order=created_at.asc&limit=1`);
          const tenants = await tenantRes.json();
          const firstTenantId = tenants?.[0]?.id;
          if (firstTenantId) {
            await sb(supabaseUrl, serviceRoleKey, 'tenant_members', {
              method: 'POST', body: JSON.stringify({ tenant_id: firstTenantId, user_id: targetUser.id, role: 'super_admin' }),
            });
          }
        }
      }

      return json({ success: true, accountExists: !!targetUser });
    }

    if (action === 'update') {
      if (!targetEmail) return json({ error: 'Email requis' }, 400);
      const res = await sb(supabaseUrl, serviceRoleKey, `platform_staff?email=eq.${encodeURIComponent(targetEmail)}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...(label !== undefined ? { label } : {}), ...(permissions !== undefined ? { permissions: cleanPermissions(permissions) } : {}) }),
      });
      if (!res.ok) return json({ error: 'Échec mise à jour' }, 500);
      return json({ success: true });
    }

    if (action === 'remove') {
      if (!targetEmail) return json({ error: 'Email requis' }, 400);
      const delRes = await sb(supabaseUrl, serviceRoleKey, `platform_staff?email=eq.${encodeURIComponent(targetEmail)}`, { method: 'DELETE' });
      if (!delRes.ok) return json({ error: 'Échec suppression' }, 500);

      // Revoke the underlying tenant role too, so removal is real (not just
      // hidden from the staff list while access silently continues).
      const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(targetEmail)}`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
      const usersData = usersRes.ok ? await usersRes.json() : null;
      const users = Array.isArray(usersData) ? usersData : usersData?.users ?? [];
      const targetUser = users.find((u: any) => (u.email ?? '').toLowerCase() === targetEmail) ?? null;
      if (targetUser) {
        await sb(supabaseUrl, serviceRoleKey, `tenant_members?user_id=eq.${targetUser.id}&role=eq.super_admin`, {
          method: 'PATCH', body: JSON.stringify({ role: 'admin' }),
        });
      }

      return json({ success: true });
    }

    return json({ error: 'Action inconnue' }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
