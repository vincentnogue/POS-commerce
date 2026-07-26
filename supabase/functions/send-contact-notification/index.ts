import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Uses Resend (https://resend.com) — simplest transactional email API to wire
// up with a Supabase edge function. Requires:
//   - RESEND_API_KEY secret
//   - The sending domain (liafrik.com) verified in the Resend dashboard
// Falls back to silently logging (not throwing) if not configured, so a
// missing key never blocks the contact form itself from working.

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const toAddress = Deno.env.get('CONTACT_NOTIFICATION_EMAIL') || 'cs@liafrik.com';
  const fromAddress = Deno.env.get('CONTACT_FROM_EMAIL') || 'noreply@liafrik.com';

  if (!resendKey) {
    // Not configured yet — the message is still safely stored in
    // contact_messages by the caller; we just can't email a copy yet.
    return json({ sent: false, reason: 'Email delivery not configured (RESEND_API_KEY missing)' }, 200);
  }

  try {
    const { name, email, subject, message } = await req.json();
    if (!name || !email || !message) return json({ error: 'name, email et message sont requis' }, 400);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `POS Flow <${fromAddress}>`,
        to: [toAddress],
        reply_to: email,
        subject: `[Contact] ${subject || 'Nouveau message'} — ${name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px">
            <h2 style="color:#1a365d">Nouveau message de contact</h2>
            <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
            <p><strong>Email :</strong> ${escapeHtml(email)}</p>
            ${subject ? `<p><strong>Sujet :</strong> ${escapeHtml(subject)}</p>` : ''}
            <p><strong>Message :</strong></p>
            <p style="white-space:pre-wrap;background:#f8f8f8;padding:12px;border-radius:8px">${escapeHtml(message)}</p>
            <p style="color:#888;font-size:12px;margin-top:24px">Répondre à ce mail répond directement à ${escapeHtml(email)}.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return json({ sent: false, error: errText }, 200); // don't fail the contact form over email issues
    }

    return json({ sent: true });
  } catch (err) {
    return json({ sent: false, error: err.message }, 200);
  }
});
