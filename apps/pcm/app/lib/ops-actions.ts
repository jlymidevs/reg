'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyRoles } from '@jlycc/permissions';
import { createClient } from '@jlycc/supabase/server';
import type { RoleCode } from '@jlycc/types';
import { buildFlashPath } from './flash';

type ActionResult = { ok: true } | { ok: false; error: string };

const APPROVER_ROLES: RoleCode[] = ['pcm_staff', 'network_head', 'ministry_head', 'admin', 'super_admin'];
const FOLLOWUP_ROLES: RoleCode[] = ['pcm_staff', 'admin', 'super_admin'];
const FOLLOWUP_METHODS = ['call', 'text', 'visit', 'prayer', 'online', 'other'] as const;
const PIPELINE_STATUSES = ['FTV', 'OGV', 'RM', 'AM', 'DROPPED'] as const;

function hasAnyRole(roles: RoleCode[], allowed: RoleCode[]) {
  return roles.some((role) => allowed.includes(role));
}

async function requireOperator(allowed: RoleCode[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not signed in.' };

  const roles = await getMyRoles(supabase);
  if (!hasAnyRole(roles, allowed)) return { ok: false as const, error: 'Not authorized.' };

  return { ok: true as const, supabase };
}

export async function decideApproval(formData: FormData): Promise<ActionResult> {
  const auth = await requireOperator(APPROVER_ROLES);
  if (!auth.ok) return auth;

  const id = String(formData.get('approvalId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const path = String(formData.get('path') ?? '/journey-approvals');
  const noteInput = String(formData.get('note') ?? '').trim();
  const note = noteInput || null;

  if (!id) return { ok: false, error: 'Missing approval request.' };
  if (decision !== 'approved' && decision !== 'rejected') return { ok: false, error: 'Invalid decision.' };

  const { error } = await auth.supabase.rpc('pcm_decide_approval', {
    p_approval_id: id,
    p_decision: decision,
    p_note: note,
  });

  if (error) return { ok: false, error: 'Unable to save approval decision.' };

  revalidatePath('/journey-approvals');
  revalidatePath('/');
  revalidatePath(path);
  return { ok: true };
}

export async function logFollowup(formData: FormData): Promise<ActionResult> {
  const auth = await requireOperator(FOLLOWUP_ROLES);
  if (!auth.ok) return auth;

  const memberId = String(formData.get('memberId') ?? '');
  const path = String(formData.get('path') ?? '/followups');
  const method = String(formData.get('method') ?? '');
  const date = String(formData.get('date') ?? '') || new Date().toISOString().slice(0, 10);
  const notes = String(formData.get('notes') ?? '').trim();

  if (!memberId) return { ok: false, error: 'Missing member.' };
  if (!FOLLOWUP_METHODS.includes(method as (typeof FOLLOWUP_METHODS)[number])) {
    return { ok: false, error: 'Invalid follow-up method.' };
  }
  const { error } = await auth.supabase.rpc('pcm_log_followup', {
    p_member_id: memberId,
    p_date: date,
    p_method: method,
    p_notes: notes || null,
  });

  if (error) return { ok: false, error: 'Unable to log follow-up.' };

  revalidatePath('/');
  revalidatePath('/followups');
  revalidatePath('/watchlist');
  revalidatePath(path);
  return { ok: true };
}

export async function requestStatusChange(formData: FormData): Promise<ActionResult> {
  const auth = await requireOperator(APPROVER_ROLES);
  if (!auth.ok) return auth;

  const memberId = String(formData.get('memberId') ?? '');
  const to = String(formData.get('to') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const path = String(formData.get('path') ?? '/pipeline');

  if (!memberId || !PIPELINE_STATUSES.includes(to as (typeof PIPELINE_STATUSES)[number])) {
    return { ok: false, error: 'Invalid pipeline move.' };
  }
  if (to === 'DROPPED' && reason.length < 10) {
    return { ok: false, error: 'Dropped moves require a reason of at least 10 characters.' };
  }

  const { error } = await auth.supabase.rpc('pcm_request_status_change', {
    p_member_id: memberId,
    p_to_status: to,
    p_reason: reason || null,
  });
  if (error) return { ok: false, error: 'Unable to submit pipeline move.' };

  revalidatePath(path);
  revalidatePath('/journey-approvals');
  return { ok: true };
}

export async function submitApprovalDecision(formData: FormData): Promise<void> {
  const path = String(formData.get('path') ?? '/journey-approvals');
  const result = await decideApproval(formData);
  if (!result.ok) redirect(buildFlashPath(path, 'error', result.error));
  redirect(
    buildFlashPath(
      path,
      'success',
      String(formData.get('decision') ?? '') === 'approved' ? 'Approval saved.' : 'Request rejected.'
    )
  );
}

export async function submitFollowupLog(formData: FormData): Promise<void> {
  const path = String(formData.get('path') ?? '/followups');
  const result = await logFollowup(formData);
  if (!result.ok) redirect(buildFlashPath(path, 'error', result.error));
  redirect(buildFlashPath(path, 'success', 'Follow-up saved.'));
}
