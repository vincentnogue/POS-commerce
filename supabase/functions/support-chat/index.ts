import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `Tu es l'assistant virtuel officiel de POS Flow, une plateforme de gestion commerciale (point de vente, stock, facturation, multi-magasins, multi-devises, Mobile Money) née des réalités du terrain africain et conçue pour le monde entier.

Ton rôle : informer les visiteurs et clients sur la plateforme, les guider dans son utilisation, et répondre à leurs questions avec précision, professionnalisme et chaleur.

INFORMATIONS DE RÉFÉRENCE (utilise UNIQUEMENT ces chiffres, ne les invente jamais) :
- Essai gratuit : 7 jours, aucune carte bancaire requise.
- Starter (9$/mois) : 1 magasin, 2 utilisateurs, 50 produits, Point de Vente, Stock, Fichier clients, support communautaire.
- Pro (19$/mois, le plus populaire) : 2 magasins, 5 utilisateurs, 500 produits, tout Starter + Factures & devis, Livraisons, Fournisseurs & achats, Rapports avancés, support email.
- Premium (49$/mois) : 5 magasins, 15 utilisateurs, 10 000 produits, tout Pro + Comptabilité complète, rôles personnalisés, tracking commerciaux, journal d'audit, support prioritaire.
- Entreprise (119$/mois) : 20 magasins, 50 utilisateurs, produits illimités, tout Premium + automatisations avancées, API, gestionnaire de compte dédié, support 24/7.
- Facturation annuelle = 2 mois offerts (10x le prix mensuel au lieu de 12x).
- Paiement : carte bancaire (Stripe) ou Mobile Money (Flutterwave).
- Fonctionnalités : POS, gestion de stock multi-magasins avec transferts, facturation PDF professionnelle avec logo/cachet, devis, achats fournisseurs avec réception/rejet, livraisons, comptabilité, rapports, rôles et permissions personnalisés par employé.
- L'application est installable comme une app (PWA) sur mobile et ordinateur.

RÈGLES STRICTES :
- Réponds TOUJOURS dans la langue du visiteur (français ou anglais selon comment il t'écrit).
- Sois concis (3-5 phrases maximum par réponse, sauf si on te demande un détail précis).
- Si tu ne sais pas répondre avec certitude, ou si le visiteur demande explicitement à parler à un humain / au support / à un conseiller, réponds EXACTEMENT avec ce marqueur au début de ta réponse : [HANDOFF_HUMAN] suivi d'un message chaleureux confirmant que tu transmets sa demande à un membre de l'équipe.
- Ne donne jamais d'informations sur d'autres produits ou entreprises.
- Ne promets jamais de remise ou de fonctionnalité qui n'existe pas dans la liste ci-dessus.`;

async function sb(supabaseUrl: string, key: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  return res;
}

async function callGemini(apiKey: string, history: { role: string; content: string }[]): Promise<string> {
  const contents = history.map((m) => ({
    role: m.role === 'ai' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error: ${errText}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Désolé, je n'ai pas pu générer de réponse. Voulez-vous parler à un membre de l'équipe ?";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server not configured' }, 503);

  try {
    const body = await req.json();
    const { action, visitor_token } = body;
    if (!visitor_token) return json({ error: 'visitor_token requis' }, 400);

    if (action === 'start_or_get') {
      const existingRes = await sb(supabaseUrl, serviceRoleKey, `support_conversations?visitor_token=eq.${visitor_token}&select=*`);
      const existing = await existingRes.json();
      let conversation = existing?.[0];

      if (!conversation) {
        const createRes = await sb(supabaseUrl, serviceRoleKey, 'support_conversations', {
          method: 'POST',
          body: JSON.stringify({
            visitor_token,
            tenant_id: body.tenant_id ?? null,
            user_id: body.user_id ?? null,
            visitor_name: body.visitor_name ?? null,
            visitor_email: body.visitor_email ?? null,
          }),
        });
        const created = await createRes.json();
        conversation = created?.[0];
      }

      const msgsRes = await sb(supabaseUrl, serviceRoleKey, `support_messages?conversation_id=eq.${conversation.id}&select=*&order=created_at.asc`);
      const messages = await msgsRes.json();
      return json({ conversation, messages });
    }

    if (action === 'poll') {
      const convRes = await sb(supabaseUrl, serviceRoleKey, `support_conversations?visitor_token=eq.${visitor_token}&select=*`);
      const conv = (await convRes.json())?.[0];
      if (!conv) return json({ error: 'Conversation introuvable' }, 404);
      const since = body.since ?? '1970-01-01';
      const msgsRes = await sb(supabaseUrl, serviceRoleKey, `support_messages?conversation_id=eq.${conv.id}&created_at=gt.${encodeURIComponent(since)}&select=*&order=created_at.asc`);
      const messages = await msgsRes.json();
      return json({ status: conv.status, messages });
    }

    if (action === 'send') {
      const { message } = body;
      if (!message?.trim()) return json({ error: 'message requis' }, 400);

      const convRes = await sb(supabaseUrl, serviceRoleKey, `support_conversations?visitor_token=eq.${visitor_token}&select=*`);
      const conv = (await convRes.json())?.[0];
      if (!conv) return json({ error: 'Conversation introuvable' }, 404);

      await sb(supabaseUrl, serviceRoleKey, 'support_messages', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: conv.id, sender: 'visitor', content: message.trim() }),
      });
      await sb(supabaseUrl, serviceRoleKey, `support_conversations?id=eq.${conv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ last_message_at: new Date().toISOString() }),
      });

      // Once a human has taken over (or it's queued for one), the AI stays
      // silent — replying automatically over a real agent would be
      // confusing and unprofessional.
      if (conv.status === 'pending_human' || conv.status === 'active') {
        return json({ handedOff: true });
      }

      if (!geminiKey) {
        // No AI configured — go straight to human handoff rather than a
        // broken/silent chat widget.
        await sb(supabaseUrl, serviceRoleKey, `support_conversations?id=eq.${conv.id}`, {
          method: 'PATCH', body: JSON.stringify({ status: 'pending_human' }),
        });
        const fallbackMsg = "Merci pour votre message ! Un membre de notre équipe va vous répondre très prochainement.";
        await sb(supabaseUrl, serviceRoleKey, 'support_messages', {
          method: 'POST', body: JSON.stringify({ conversation_id: conv.id, sender: 'agent', content: fallbackMsg }),
        });
        return json({ handedOff: true, reply: fallbackMsg });
      }

      const historyRes = await sb(supabaseUrl, serviceRoleKey, `support_messages?conversation_id=eq.${conv.id}&select=sender,content&order=created_at.asc`);
      const history = (await historyRes.json()).map((m: any) => ({ role: m.sender, content: m.content }));

      let aiText = await callGemini(geminiKey, history);
      let handedOff = false;

      if (aiText.startsWith('[HANDOFF_HUMAN]')) {
        handedOff = true;
        aiText = aiText.replace('[HANDOFF_HUMAN]', '').trim();
        await sb(supabaseUrl, serviceRoleKey, `support_conversations?id=eq.${conv.id}`, {
          method: 'PATCH', body: JSON.stringify({ status: 'pending_human' }),
        });
      }

      await sb(supabaseUrl, serviceRoleKey, 'support_messages', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: conv.id, sender: 'ai', content: aiText }),
      });

      return json({ reply: aiText, handedOff });
    }

    if (action === 'request_human') {
      const convRes = await sb(supabaseUrl, serviceRoleKey, `support_conversations?visitor_token=eq.${visitor_token}&select=*`);
      const conv = (await convRes.json())?.[0];
      if (!conv) return json({ error: 'Conversation introuvable' }, 404);
      await sb(supabaseUrl, serviceRoleKey, `support_conversations?id=eq.${conv.id}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'pending_human' }),
      });
      const msg = "Votre demande a été transmise à un membre de notre équipe. Vous recevrez une réponse très prochainement.";
      await sb(supabaseUrl, serviceRoleKey, 'support_messages', {
        method: 'POST', body: JSON.stringify({ conversation_id: conv.id, sender: 'agent', content: msg }),
      });
      return json({ reply: msg });
    }

    return json({ error: 'Action inconnue' }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
