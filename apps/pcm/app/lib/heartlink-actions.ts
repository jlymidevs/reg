'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyRoles } from '@jlycc/permissions';
import { createClient } from '@jlycc/supabase/server';
import type { RoleCode } from '@jlycc/types';
import { buildFlashPath } from './flash';

type ActionResult = { ok: true; reportId: string } | { ok: false; error: string };

const REPORTER_ROLES: RoleCode[] = ['pcm_staff', 'network_head', 'ministry_head', 'admin', 'super_admin'];
const ATTENDEE_FIELDS = [
  ['regularAttendees', 'regular'],
  ['firstTimeAttendees', 'first_time'],
  ['childAttendees', 'child'],
] as const;

function hasAnyRole(roles: RoleCode[], allowed: RoleCode[]) {
  return roles.some((role) => allowed.includes(role));
}

function optionalValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim() || null;
}

function parseAttendees(formData: FormData) {
  return ATTENDEE_FIELDS.flatMap(([field, attendeeType]) =>
    String(formData.get(field) ?? '')
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean)
      .map((attendeeName) => ({ attendee_type: attendeeType, attendee_name: attendeeName }))
  );
}

async function requireReporter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not signed in.' };

  const roles = await getMyRoles(supabase);
  if (!hasAnyRole(roles, REPORTER_ROLES)) return { ok: false as const, error: 'Not authorized.' };

  return { ok: true as const, supabase };
}

export async function saveHeartlinkReport(formData: FormData): Promise<ActionResult> {
  const auth = await requireReporter();
  if (!auth.ok) return auth;

  const heartlinkId = optionalValue(formData, 'heartlinkId');
  const category = optionalValue(formData, 'category');
  const topic = optionalValue(formData, 'topic');
  const venue = optionalValue(formData, 'venue');
  const reportDate = optionalValue(formData, 'reportDate');
  const startedAt = optionalValue(formData, 'startedAt');
  const endedAt = optionalValue(formData, 'endedAt');
  const mode = optionalValue(formData, 'mode') ?? 'draft';

  if (!heartlinkId || !category || !topic || !venue || !reportDate) {
    return { ok: false, error: 'HeartLink, category, topic, venue, and date are required.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return { ok: false, error: 'Enter a valid report date.' };
  if ((startedAt && !/^\d{2}:\d{2}$/.test(startedAt)) || (endedAt && !/^\d{2}:\d{2}$/.test(endedAt))) {
    return { ok: false, error: 'Enter times as HH:MM.' };
  }
  if (mode !== 'draft' && mode !== 'publish') return { ok: false, error: 'Invalid report action.' };

  const { data: reportId, error } = await auth.supabase.rpc('pcm_save_heartlink_report', {
    p_report_id: optionalValue(formData, 'reportId'),
    p_heartlink_id: heartlinkId,
    p_category: category,
    p_topic: topic,
    p_venue: venue,
    p_report_date: reportDate,
    p_started_at: startedAt,
    p_ended_at: endedAt,
    p_pastor: optionalValue(formData, 'pastor'),
    p_coordinator: optionalValue(formData, 'coordinator'),
    p_notes: optionalValue(formData, 'notes'),
    p_attendees: parseAttendees(formData),
    p_publish: mode === 'publish',
  });

  if (error || !reportId) return { ok: false, error: 'Unable to save the HeartLink report.' };

  revalidatePath('/dashboard/meetings');
  return { ok: true, reportId };
}

export async function submitHeartlinkReport(formData: FormData): Promise<void> {
  const result = await saveHeartlinkReport(formData);
  if (!result.ok) redirect(buildFlashPath('/dashboard/meetings', 'error', result.error));
  redirect(buildFlashPath('/dashboard/meetings', 'success', 'HeartLink report saved.'));
}
