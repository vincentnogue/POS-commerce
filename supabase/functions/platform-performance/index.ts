import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sb(supabaseUrl: string, key: string, path: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  return res.json();
}

async function allAuthUsers(supabaseUrl: string, key: string) {
  // GoTrue admin API is paginated; walk through it to build a full id -> email map.
  const map: Record<string, string> = {};
  let page = 1;
  for (let i = 0; i < 50; i++) { // hard safety cap: 50 * 1000 = 50k users
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) break;
    const data = await res.json();
    const users = data.users ?? [];
    for (const u of users) map[u.id] = (u.email ?? '').toLowerCase();
    if (users.length < 1000) break;
    page += 1;
  }
  return map;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server not configured' }, 503);

  try {
    // --- Authorization: same double-check as super-admin-auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: serviceRoleKey } });
    if (!userRes.ok) return json({ error: 'Unauthorized' }, 401);
    const callerUser = await userRes.json();
    const callerEmail = (callerUser.email ?? '').toLowerCase();

    const adminCheck = await sb(supabaseUrl, serviceRoleKey, `platform_admins?email=eq.${encodeURIComponent(callerEmail)}&select=email`);
    const memberCheck = await sb(supabaseUrl, serviceRoleKey, `tenant_members?user_id=eq.${callerUser.id}&role=eq.super_admin&select=id`);
    if (!(Array.isArray(adminCheck) && adminCheck.length > 0) || !(Array.isArray(memberCheck) && memberCheck.length > 0)) {
      return json({ error: 'Forbidden: super admin access required' }, 403);
    }

    // --- Gather raw data ---
    const [members, sales, auditLogs, codes, tenants, usersByIdMap] = await Promise.all([
      sb(supabaseUrl, serviceRoleKey, 'tenant_members?select=id,user_id,display_name,role,tenant_id,tenants(name)'),
      sb(supabaseUrl, serviceRoleKey, 'sales?select=user_id,total,commercial_code_id,tenant_id,sale_status&sale_status=eq.completed'),
      sb(supabaseUrl, serviceRoleKey, 'audit_log?select=actor_email,tenant_id,created_at&order=created_at.desc&limit=20000'),
      sb(supabaseUrl, serviceRoleKey, 'commercial_codes?select=*&order=created_at.desc'),
      sb(supabaseUrl, serviceRoleKey, 'tenants?select=id,name,commercial_code_id,created_at,status'),
      allAuthUsers(supabaseUrl, serviceRoleKey),
    ]);

    // --- Aggregate sales per staff member (user_id) ---
    const salesByUser: Record<string, { count: number; revenue: number }> = {};
    for (const s of sales) {
      if (!s.user_id) continue;
      salesByUser[s.user_id] ??= { count: 0, revenue: 0 };
      salesByUser[s.user_id].count += 1;
      salesByUser[s.user_id].revenue += Number(s.total) || 0;
    }

    // --- Aggregate sales per commercial code ---
    const salesByCode: Record<string, { count: number; revenue: number }> = {};
    for (const s of sales) {
      if (!s.commercial_code_id) continue;
      salesByCode[s.commercial_code_id] ??= { count: 0, revenue: 0 };
      salesByCode[s.commercial_code_id].count += 1;
      salesByCode[s.commercial_code_id].revenue += Number(s.total) || 0;
    }

    // --- Aggregate activity per email (from audit_log) ---
    const activityByEmail: Record<string, { count: number; lastActivity: string | null }> = {};
    for (const a of auditLogs) {
      const email = (a.actor_email ?? '').toLowerCase();
      if (!email) continue;
      activityByEmail[email] ??= { count: 0, lastActivity: null };
      activityByEmail[email].count += 1;
      if (!activityByEmail[email].lastActivity || a.created_at > activityByEmail[email].lastActivity!) {
        activityByEmail[email].lastActivity = a.created_at;
      }
    }

    // --- Staff performance rows ---
    const staff = members.map((m: any) => {
      const email = usersByIdMap[m.user_id] ?? null;
      const sales = salesByUser[m.user_id] ?? { count: 0, revenue: 0 };
      const activity = email ? activityByEmail[email] : undefined;
      return {
        userId: m.user_id,
        displayName: m.display_name ?? email ?? 'Sans nom',
        email,
        role: m.role,
        tenantName: m.tenants?.name ?? '—',
        tenantId: m.tenant_id,
        salesCount: sales.count,
        salesRevenue: sales.revenue,
        activityCount: activity?.count ?? 0,
        lastActivity: activity?.lastActivity ?? null,
      };
    }).sort((a: any, b: any) => b.salesRevenue - a.salesRevenue);

    // --- Commercial code performance rows ---
    const tenantsByCode: Record<string, any[]> = {};
    for (const t of tenants) {
      if (!t.commercial_code_id) continue;
      tenantsByCode[t.commercial_code_id] ??= [];
      tenantsByCode[t.commercial_code_id].push({ id: t.id, name: t.name, signedUpAt: t.created_at, status: t.status });
    }
    const commercials = codes.map((c: any) => {
      const agg = salesByCode[c.id] ?? { count: 0, revenue: 0 };
      return {
        id: c.id,
        code: c.code,
        repName: c.rep_name,
        repEmail: c.rep_email,
        region: c.region,
        isActive: c.is_active,
        salesCount: agg.count,
        salesRevenue: agg.revenue,
        clients: tenantsByCode[c.id] ?? [],
      };
    }).sort((a: any, b: any) => b.salesRevenue - a.salesRevenue);

    return json({ staff, commercials });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
