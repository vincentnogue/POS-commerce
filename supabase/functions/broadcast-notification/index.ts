import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sb(supabaseUrl: string, key: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(init.headers ?? {}),
    },
  });
  return res;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server not configured' }, 503);

  try {
    // --- Authorization: caller must be a verified platform super admin. ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: serviceRoleKey } });
    if (!userRes.ok) return json({ error: 'Unauthorized' }, 401);
    const callerUser = await userRes.json();
    const callerEmail = (callerUser.email ?? '').toLowerCase();

    const adminCheck = await (await sb(supabaseUrl, serviceRoleKey, `platform_admins?email=eq.${encodeURIComponent(callerEmail)}&select=email`)).json();
    const memberCheck = await (await sb(supabaseUrl, serviceRoleKey, `tenant_members?user_id=eq.${callerUser.id}&role=eq.super_admin&select=id`)).json();
    if (!(Array.isArray(adminCheck) && adminCheck.length > 0) || !(Array.isArray(memberCheck) && memberCheck.length > 0)) {
      return json({ error: 'Forbidden: super admin access required' }, 403);
    }

    const { subject, body, segment } = await req.json();
    if (!subject || !body) return json({ error: 'subject et body requis' }, 400);

    // --- Resolve target tenants for the segment ---
    const tenantsRes = await sb(supabaseUrl, serviceRoleKey, 'tenants?select=id,status,created_at');
    const tenants = await tenantsRes.json();
    const now = Date.now();
    const targetTenants = (Array.isArray(tenants) ? tenants : []).filter((t: any) => {
      if (segment === 'active') return t.status === 'active';
      if (segment === 'suspended') return t.status === 'suspended';
      if (segment === 'trial') return now < new Date(t.created_at).getTime() + 7 * 86400000;
      return true; // 'all'
    });

    if (targetTenants.length === 0) {
      return json({ sent: 0, message: 'Aucune entreprise dans ce segment.' });
    }

    const tenantIds = targetTenants.map((t: any) => t.id);
    // --- Resolve every member (not just admins) across those tenants ---
    const membersRes = await sb(
      supabaseUrl, serviceRoleKey,
      `tenant_members?tenant_id=in.(${tenantIds.join(',')})&select=user_id`
    );
    const members = await membersRes.json();
    const userIds = Array.from(new Set((Array.isArray(members) ? members : []).map((m: any) => m.user_id)));

    if (userIds.length === 0) {
      return json({ sent: 0, message: 'Aucun destinataire trouvé pour ce segment.' });
    }

    // --- Insert one notification per recipient (service role bypasses the
    // 'insert own notifications only' RLS policy, legitimately here). ---
    const rows = userIds.map((uid) => ({
      user_id: uid,
      title: subject,
      body,
      type: 'announcement',
    }));
    const insertRes = await sb(supabaseUrl, serviceRoleKey, 'notifications', {
      method: 'POST',
      body: JSON.stringify(rows),
    });
    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return json({ error: `Échec de l'envoi : ${errText}` }, 500);
    }

    // --- Audit trail ---
    await sb(supabaseUrl, serviceRoleKey, 'audit_log', {
      method: 'POST',
      body: JSON.stringify({
        action: 'platform_communication',
        entity: `Segment: ${segment}, Entreprises: ${targetTenants.length}, Destinataires: ${userIds.length}`,
        actor_email: callerEmail,
      }),
    });

    return json({ sent: userIds.length, tenants: targetTenants.length });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
