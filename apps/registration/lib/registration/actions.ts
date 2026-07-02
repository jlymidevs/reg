'use server';

import { createAdminClient } from '@jlycc/supabase/admin';
import type { EventRegistration } from '@jlycc/types';
import { normalizePhone, registrationSchema, type RegistrationInput } from './schema';

export type RegisterResult =
  | { ok: true; matched: boolean; duplicate?: boolean }
  | { ok: false; error: string };

export async function registerForEvent(
  eventId: string,
  input: RegistrationInput
): Promise<RegisterResult> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the form and try again.' };
  const data = parsed.data;

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select('id, is_published, is_active, requires_registration, starts_at')
    .eq('id', eventId)
    .single();
  if (!event || !event.is_published || !event.is_active)
    return { ok: false, error: 'This event is not open for registration.' };
  if (!event.requires_registration)
    return { ok: false, error: 'This event does not require registration — just come!' };
  if (new Date(event.starts_at).getTime() < Date.now() - 6 * 3600_000)
    return { ok: false, error: 'This event has already ended.' };

  const { data: matches, error: matchErr } = await admin.rpc('match_registration_member', {
    p_email: data.email,
    p_phone: data.mobile,
  });
  if (matchErr) return { ok: false, error: 'Something went wrong. Please try again.' };

  const matchedId = matches?.length === 1 ? (matches[0] as { id: string }).id : null;

  const memberRow = {
    event_id: eventId,
    member_id: matchedId,
    status: 'registered' as const,
    is_first_time: data.is_first_time,
    heard_about: data.heard_about || null,
    consent_given: true,
  };

  const guestRow = {
    event_id: eventId,
    member_id: null,
    status: 'pending_review' as const,
    guest_first_name: data.first_name,
    guest_last_name: data.last_name,
    guest_middle_name: data.middle_name || null,
    guest_nickname: data.nickname || null,
    guest_email: data.email.toLowerCase(),
    guest_mobile: normalizePhone(data.mobile),
    guest_gender: data.gender ?? null,
    guest_birthday: data.birthday || null,
    guest_address: data.address || null,
    emergency_contact: data.emergency_contact || null,
    is_first_time: data.is_first_time,
    heard_about: data.heard_about || null,
    consent_given: true,
  };

  const row = matchedId ? memberRow : guestRow;

  const { error: insErr } = await admin.from('event_registrations').insert(row as Partial<EventRegistration>);
  if (insErr) {
    if (insErr.code === '23505')
      return { ok: true, matched: !!matchedId, duplicate: true }; // already registered — treat as success
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
  return { ok: true, matched: !!matchedId };
}
