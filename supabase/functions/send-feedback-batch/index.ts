// Sends the feedback request emails for an already-generated, admin-approved
// batch. Caller must be an authenticated admin (checked via is_reg_admin()
// using the CALLER's own JWT, not the service role) — this endpoint must
// never be reachable by a non-admin, since it emails real church members.
//
// Deploy: supabase functions deploy send-feedback-batch
// (no --no-verify-jwt — this one requires a valid Supabase session)
//
// Reuses the same RESEND_API_KEY / EMAIL_FROM secrets as the register
// function. Add APP_BASE_URL if the production domain isn't reg.jlycc.org.

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

async function sendFeedbackEmail(to: string, eventTitle: string, feedbackUrl: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!apiKey || !from) return { ok: false, error: 'Email not configured' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `We'd love your feedback on ${eventTitle}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
          <h2 style="color:#1e3a8a;margin-bottom:4px">How did we do?</h2>
          <p>Hi,</p>
          <p>Thank you for being part of <strong>${eventTitle}</strong>. We'd be grateful for a few minutes of your honest feedback — it helps us serve every member better, from kids to seniors, men and women alike.</p>
          <p>This takes about 3 minutes.</p>
          <p style="margin:28px 0">
            <a href="${feedbackUrl}" style="background:#1A365D;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Share Your Feedback</a>
          </p>
          <p style="color:#9ca3af;font-size:12px;margin-top:32px">JLYCC Events — if you'd rather not receive these, just reply and let us know.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `Resend error: ${res.status} ${text}` };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401);

  let body: { batch_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.batch_id) return json({ error: 'batch_id is required' }, 400);

  // Verify the CALLER is an admin using their own JWT (not service role).
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: isAdmin, error: adminCheckError } = await callerClient.rpc('is_reg_admin');
  if (adminCheckError || !isAdmin) {
    return json({ error: 'Not authorized.' }, 403);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: batch, error: batchError } = await admin
    .from('feedback_email_batches')
    .select('*, events(title)')
    .eq('id', body.batch_id)
    .single();
  if (batchError || !batch) return json({ error: 'Batch not found.' }, 404);
  if (batch.status === 'sent') return json({ error: 'This batch was already sent.' }, 400);

  const { data: recipients, error: recipientsError } = await admin
    .from('feedback_email_recipients')
    .select('*')
    .eq('batch_id', body.batch_id)
    .eq('status', 'queued');
  if (recipientsError) return json({ error: recipientsError.message }, 500);

  const baseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://reg.jlycc.org';
  const eventTitle = (batch as any).events?.title ?? 'our event';

  let sent = 0, failed = 0;
  for (const r of recipients ?? []) {
    const result = await sendFeedbackEmail(r.email, eventTitle, `${baseUrl}/feedback/${r.token}`);
    if (result.ok) {
      sent++;
      await admin.from('feedback_email_recipients').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', r.id);
    } else {
      failed++;
      await admin.from('feedback_email_recipients').update({ status: 'failed', error_message: result.error }).eq('id', r.id);
    }
  }

  await admin.from('feedback_email_batches').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', body.batch_id);

  return json({ ok: true, sent, failed });
});
