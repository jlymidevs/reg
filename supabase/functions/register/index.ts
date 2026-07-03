// Public registration endpoint: verifies Cloudflare Turnstile, then calls the
// register_for_event RPC with the service role, then sends a confirmation
// email via Resend when the registrant provided an email address.
//
// Deploy:   supabase functions deploy register --no-verify-jwt
// Secrets:  supabase secrets set TURNSTILE_SECRET_KEY=... RESEND_API_KEY=... EMAIL_FROM="JLYCC Events <events@jlycc.ph>"
//
// TURNSTILE_SECRET_KEY unset -> Turnstile check is skipped (rollout mode).
// RESEND_API_KEY unset       -> email step is skipped; registration still succeeds.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return true; // not configured yet — allow through
  if (!token) return false;

  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  return data.success === true;
}

async function sendConfirmationEmail(to: string, firstName: string, event: {
  title: string;
  starts_at: string;
  ends_at: string;
  venue: string | null;
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!apiKey || !from) return; // email not configured — skip silently

  const starts = new Date(event.starts_at);
  const dateStr = starts.toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila',
  });
  const timeStr = starts.toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
  });

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `You're registered: ${event.title}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
          <h2 style="color:#1e3a8a;margin-bottom:4px">Registration Confirmed</h2>
          <p>Hi ${firstName},</p>
          <p>You're registered for <strong>${event.title}</strong>. Here are the details:</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:8px 0;color:#6b7280;width:90px">Date</td><td style="padding:8px 0;font-weight:bold">${dateStr}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Time</td><td style="padding:8px 0;font-weight:bold">${timeStr}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Venue</td><td style="padding:8px 0;font-weight:bold">${event.venue ?? 'To be announced'}</td></tr>
          </table>
          <p>See you there! If you can't make it, please let us know so we can free up your spot.</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:32px">JLYCC Events — this is an automated confirmation, no reply needed.</p>
        </div>
      `,
    }),
  }).catch((err) => console.error('Resend send failed:', err));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for');
  const turnstileOk = await verifyTurnstile(body.turnstile_token as string | undefined, ip);
  if (!turnstileOk) {
    return json({ error: 'Verification failed. Please refresh and try again.' }, 403);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('register_for_event', {
    p_event_id: body.event_id,
    p_first_name: body.first_name,
    p_surname: body.surname,
    p_phone: body.phone,
    p_address: body.address ?? null,
    p_notes: body.notes ?? null,
    p_email: body.email ?? null,
  });

  if (error) {
    // Postgres RAISE EXCEPTION messages are user-facing validation errors
    return json({ error: error.message }, 400);
  }

  if (data?.email && data?.event) {
    await sendConfirmationEmail(data.email, String(body.first_name ?? ''), data.event);
  }

  return json({ ok: true, emailSent: Boolean(data?.email) });
});
