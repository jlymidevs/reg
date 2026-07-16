'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyRoles } from '@jlycc/permissions';
import { createClient } from '@jlycc/supabase/server';
import type { RoleCode } from '@jlycc/types';
import { buildFlashPath } from './flash';

type SaveResult = { ok: true; announcementId: string } | { ok: false; error: string };
type ArchiveResult = { ok: true } | { ok: false; error: string };

const ANNOUNCER_ROLES: RoleCode[] = ['network_head', 'ministry_head', 'admin', 'super_admin'];
const AUDIENCES = ['church', 'network', 'ministry', 'role'] as const;

function hasAnyRole(roles: RoleCode[], allowed: RoleCode[]) {
  return roles.some((role) => allowed.includes(role));
}

function optionalValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim() || null;
}

async function requireAnnouncer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not signed in.' };

  const roles = await getMyRoles(supabase);
  if (!hasAnyRole(roles, ANNOUNCER_ROLES)) return { ok: false as const, error: 'Not authorized.' };

  return { ok: true as const, supabase };
}

export async function saveAnnouncement(formData: FormData): Promise<SaveResult> {
  const auth = await requireAnnouncer();
  if (!auth.ok) return auth;

  const title = optionalValue(formData, 'title');
  const body = optionalValue(formData, 'body');
  const audience = optionalValue(formData, 'audience');
  const targetId = optionalValue(formData, 'targetId');
  const targetRoleCode = optionalValue(formData, 'targetRoleCode');
  const mode = optionalValue(formData, 'mode') ?? 'draft';

  if (!title || !body || !audience || !AUDIENCES.includes(audience as (typeof AUDIENCES)[number])) {
    return { ok: false, error: 'Title, message, and audience are required.' };
  }
  if ((audience === 'network' || audience === 'ministry') && !targetId) {
    return { ok: false, error: 'A target ID is required for network or ministry announcements.' };
  }
  if (audience === 'role' && !targetRoleCode) return { ok: false, error: 'A role is required for role announcements.' };
  if (mode !== 'draft' && mode !== 'publish') return { ok: false, error: 'Invalid announcement action.' };

  const { data: announcementId, error } = await auth.supabase.rpc('pcm_save_announcement', {
    p_announcement_id: optionalValue(formData, 'announcementId'),
    p_title: title,
    p_body: body,
    p_audience: audience,
    p_target_id: audience === 'network' || audience === 'ministry' ? targetId : null,
    p_target_role_code: audience === 'role' ? targetRoleCode : null,
    p_publish: mode === 'publish',
  });

  if (error || !announcementId) return { ok: false, error: 'Unable to save the announcement.' };

  revalidatePath('/dashboard/announcements');
  return { ok: true, announcementId };
}

export async function archiveAnnouncement(formData: FormData): Promise<ArchiveResult> {
  const auth = await requireAnnouncer();
  if (!auth.ok) return auth;

  const announcementId = optionalValue(formData, 'announcementId');
  if (!announcementId) return { ok: false, error: 'Missing announcement.' };

  const { error } = await auth.supabase.rpc('pcm_archive_announcement', {
    p_announcement_id: announcementId,
  });
  if (error) return { ok: false, error: 'Unable to archive the announcement.' };

  revalidatePath('/dashboard/announcements');
  return { ok: true };
}

export async function submitAnnouncement(formData: FormData): Promise<void> {
  const result = await saveAnnouncement(formData);
  if (!result.ok) redirect(buildFlashPath('/dashboard/announcements', 'error', result.error));
  redirect(buildFlashPath('/dashboard/announcements', 'success', 'Announcement saved.'));
}

export async function submitArchiveAnnouncement(formData: FormData): Promise<void> {
  const result = await archiveAnnouncement(formData);
  if (!result.ok) redirect(buildFlashPath('/dashboard/announcements', 'error', result.error));
  redirect(buildFlashPath('/dashboard/announcements', 'success', 'Announcement archived.'));
}
