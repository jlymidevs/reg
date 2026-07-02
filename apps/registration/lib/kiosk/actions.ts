'use server';

import { createAdminClient } from '@jlycc/supabase/admin';
import { createClient } from '@jlycc/supabase/server';

export type QrRegisterResult =
  | { ok: true; memberName: string; duplicate?: boolean }
  | { ok: false; error: string };

export async function registerByQr(eventId: string, qrValue: string): Promise<QrRegisterResult> {
  // security boundary: caller must be signed in AND pass can_scan()
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { ok: false, error: 'Not signed in.' };
  const { data: allowed } = await supabase.rpc('can_scan');
  if (!allowed) return { ok: false, error: 'Not authorized.' };

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select('id, is_published, is_active, requires_registration, starts_at')
    .eq('id', eventId)
    .single();
  if (!event || !event.is_published || !event.is_active)
    return { ok: false, error: 'This event is not open for registration.' };
  if (!event.requires_registration)
    return { ok: false, error: 'This event does not require registration.' };
  if (new Date(event.starts_at).getTime() < Date.now() - 6 * 3600_000)
    return { ok: false, error: 'This event has already ended.' };

  const { data: member } = await admin
    .from('members')
    .select('id, name')
    .eq('qr_code_value', qrValue.trim())
    .maybeSingle();
  if (!member) return { ok: false, error: 'QR code not recognized.' };

  const { error: insErr } = await admin.from('event_registrations').insert({
    event_id: eventId,
    member_id: member.id,
    status: 'registered',
    registered_by: userData.user.id,
  } as never);

  if (insErr) {
    if (insErr.code === '23505') return { ok: true, memberName: member.name, duplicate: true };
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
  return { ok: true, memberName: member.name };
}
