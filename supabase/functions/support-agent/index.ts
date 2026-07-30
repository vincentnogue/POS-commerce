import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sb(supabaseUrl: string, key: string, path: string, init: RequestInit = {}) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
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
    // --- Authorization: platform admin OR scoped platform staff with the
    // 'comms' (or 'support') section — same double-check pattern as every
    // other Super Admin function. ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: serviceRoleKey } });
    if (!userRes.ok) return json({ error: 'Unauthorized' }, 401);
    const callerUser = await userRes.json();
    const callerEmail = (callerUser.email ?? '').toLowerCase();

    const memberCheck = await (await sb(supabaseUrl, serviceRoleKey, `tenant_members?user_id=eq.${callerUser.id}&role=eq.super_admin&select=id`)).json();
    if (!(Array.isArray(memberCheck) && memberCheck.length > 0)) {
      return json({ error: 'Forbidden: super admin access required' }, 403);
    }
    const adminCheck = await (await sb(supabaseUrl, serviceRoleKey, `platform_admins?email=eq.${encodeURIComponent(callerEmail)}&select=email`)).json();
    const isFullAdmin = Array.isArray(adminCheck) && adminCheck.length > 0;
    if (!isFullAdmin) {
      const staffCheck = await (await sb(supabaseUrl, serviceRoleKey, `platform_staff?email=eq.${encodeURIComponent(callerEmail)}&select=permissions`)).json();
      const staff = staffCheck?.[0];
      const allowed = staff?.permissions == null || staff.permissions?.support !== false;
      if (!staff || !allowed) return json({ error: 'Forbidden: no support access' }, 403);
    }

    const { action } = await req.json().then((b) => ({ ...b })).catch(() => ({}));
    const body = await req.clone().json().catch(() => ({}));

    if (action === 'list') {
      const res = await sb(supabaseUrl, serviceRoleKey, `support_conversations?select=*,tenants(name)&order=last_message_at.desc&limit=100`);
      return json({ conversations: await res.json() });
    }

    if (action === 'messages') {
      const res = await sb(supabaseUrl, serviceRoleKey, `support_messages?conversation_id=eq.${body.conversation_id}&select=*&order=created_at.asc`);
      return json({ messages: await res.json() });
    }

    if (action === 'reply') {
      if (!body.conversation_id || !body.message?.trim()) return json({ error: 'conversation_id et message requis' }, 400);
      const insertRes = await sb(supabaseUrl, serviceRoleKey, 'support_messages', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: body.conversation_id, sender: 'agent', content: body.message.trim() }),
      });
      if (!insertRes.ok) return json({ error: await insertRes.text() }, 500);
      await sb(supabaseUrl, serviceRoleKey, `support_conversations?id=eq.${body.conversation_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active', assigned_admin_email: callerEmail, last_message_at: new Date().toISOString() }),
      });
      return json({ success: true });
    }

    if (action === 'close') {
      if (!body.conversation_id) return json({ error: 'conversation_id requis' }, 400);
      await sb(supabaseUrl, serviceRoleKey, `support_conversations?id=eq.${body.conversation_id}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'closed' }),
      });
      return json({ success: true });
    }

    return json({ error: 'Action inconnue' }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
