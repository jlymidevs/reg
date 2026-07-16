'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@jlycc/supabase/server';
import { requireAdminAccess } from './access';
import { buildFlashPath } from './flash';

type ActionResult = { ok: true } | { ok: false; error: string };

const STAFF_ROLES = new Set(['pcm_staff', 'network_head', 'ministry_head', 'admin', 'super_admin']);

function optional(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim() || null;
}

function roleInput(formData: FormData) {
  const userId = String(formData.get('userId') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim();
  if (!userId) return null;
  if (!STAFF_ROLES.has(role)) return 'invalid' as const;
  return { userId, role };
}

async function setStaffRole(formData: FormData, isActive: boolean): Promise<ActionResult> {
  const input = roleInput(formData);
  if (input === 'invalid') return { ok: false, error: 'Select an allowed staff role.' };
  if (!input) return { ok: false, error: 'Select a staff account and role.' };

  try {
    const supabase = await createClient();
    await requireAdminAccess(supabase);
    const { error } = await supabase.rpc('pcm_admin_set_staff_role', {
      p_user_id: input.userId,
      p_role_code: input.role,
      p_network_id: optional(formData, 'networkId'),
      p_ministry_id: optional(formData, 'ministryId'),
      p_staff_name: optional(formData, 'name'),
      p_is_active: isActive,
      p_invited: false,
    });
    if (error) return { ok: false, error: 'Unable to update staff access.' };
    revalidatePath('/dashboard/staff');
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unable to update staff access.' };
  }
}

export async function grantStaffAccess(formData: FormData): Promise<ActionResult> {
  return setStaffRole(formData, true);
}

export async function removeStaffAccess(formData: FormData): Promise<ActionResult> {
  return setStaffRole(formData, false);
}

export async function submitGrantStaffAccess(formData: FormData): Promise<void> {
  const result = await grantStaffAccess(formData);
  if (!result.ok) redirect(buildFlashPath('/dashboard/staff', 'error', result.error));
  redirect(buildFlashPath('/dashboard/staff', 'success', 'Staff role updated and audited.'));
}

export async function submitRemoveStaffAccess(formData: FormData): Promise<void> {
  const result = await removeStaffAccess(formData);
  if (!result.ok) redirect(buildFlashPath('/dashboard/staff', 'error', result.error));
  redirect(buildFlashPath('/dashboard/staff', 'success', 'Staff role removed and audited.'));
}

export async function transferStaffWork(formData: FormData): Promise<ActionResult> {
  const sourceStaffId = String(formData.get('sourceStaffId') ?? '').trim();
  const destinationStaffId = String(formData.get('destinationStaffId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!sourceStaffId || !destinationStaffId || sourceStaffId === destinationStaffId) {
    return { ok: false, error: 'Choose two different active staff members.' };
  }
  if (reason.length < 3) return { ok: false, error: 'Enter a turnover reason.' };

  try {
    const supabase = await createClient();
    await requireAdminAccess(supabase);
    const { error } = await supabase.rpc('pcm_transfer_staff_work', {
      p_source_staff_id: sourceStaffId,
      p_destination_staff_id: destinationStaffId,
      p_reason: reason,
    });
    if (error) return { ok: false, error: 'Unable to execute turnover.' };
    revalidatePath('/dashboard/turnover');
    revalidatePath('/dashboard/tasks');
    revalidatePath('/dashboard/members');
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unable to execute turnover.' };
  }
}

export async function submitTurnover(formData: FormData): Promise<void> {
  const result = await transferStaffWork(formData);
  if (!result.ok) redirect(buildFlashPath('/dashboard/turnover', 'error', result.error));
  redirect(buildFlashPath('/dashboard/turnover', 'success', 'Team turnover completed and audited.'));
}

export async function submitMemberLinkDecision(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await requireAdminAccess(supabase);
  const requestId = String(formData.get('requestId') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();
  const memberId = String(formData.get('memberId') ?? '').trim();
  if (!requestId || !['approve', 'reject', 'needs_more_info'].includes(decision)) redirect(buildFlashPath('/dashboard/member-links', 'error', 'Invalid member link decision.'));
  const result = decision === 'approve'
    ? await supabase.rpc('approve_member_link', { p_request_id: requestId, p_selected_member_id: memberId, p_admin_notes: optional(formData, 'notes') })
    : await supabase.rpc('update_member_link_status', { p_request_id: requestId, p_status: decision, p_reason: optional(formData, 'reason'), p_admin_notes: optional(formData, 'notes') });
  if (result.error) redirect(buildFlashPath('/dashboard/member-links', 'error', 'Member link decision could not be saved.'));
  revalidatePath('/dashboard/member-links');
  redirect(buildFlashPath('/dashboard/member-links', 'success', 'Member link decision saved and audited.'));
}
