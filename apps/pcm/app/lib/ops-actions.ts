'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyRoles } from '@jlycc/permissions';
import { createAdminClient } from '@jlycc/supabase/admin';
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

  return { ok: true as const, user, roles };
}

async function resolvePcmStaffId(email?: string | null) {
  if (!email) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('pcm_staff')
    .select('id')
    .eq('email', email.toLowerCase())
    .eq('status', 'active')
    .maybeSingle();
  return data?.id ?? null;
}

async function resolveStageId(payload: Record<string, unknown>) {
  const admin = createAdminClient();
  const stageId = typeof payload.stage_id === 'string' ? payload.stage_id : null;
  const stageCode = typeof payload.stage_code === 'string' ? payload.stage_code : null;
  if (stageId) return stageId;
  if (!stageCode) return null;
  const { data } = await admin.from('journey_stages').select('id').eq('code', stageCode).maybeSingle();
  return data?.id ?? null;
}

async function resolveRequirement(payload: Record<string, unknown>) {
  const admin = createAdminClient();
  const requirementId = typeof payload.requirement_id === 'string' ? payload.requirement_id : null;
  const requirementCode = typeof payload.requirement_code === 'string' ? payload.requirement_code : null;
  if (requirementId) return requirementId;
  if (!requirementCode) return null;
  const { data } = await admin
    .from('journey_requirements')
    .select('id')
    .eq('code', requirementCode)
    .maybeSingle();
  return data?.id ?? null;
}

async function applyApprovalMutation(
  request: {
    id: string;
    member_id: string | null;
    request_type: string;
    payload: Record<string, unknown>;
  },
  userId: string,
  note: string | null
) {
  if (!request.member_id) return;

  const admin = createAdminClient();

  if (request.request_type === 'member_status_change') {
    const { data: member } = await admin
      .from('members')
      .select('journey_status')
      .eq('id', request.member_id)
      .maybeSingle();

    const nextStatus =
      typeof request.payload.to === 'string'
        ? request.payload.to
        : typeof request.payload.new_value === 'string'
          ? request.payload.new_value
          : null;

    if (!nextStatus || member?.journey_status === nextStatus) return;

    await admin.from('members').update({ journey_status: nextStatus }).eq('id', request.member_id);
    await admin.from('member_field_history').insert({
      member_id: request.member_id,
      field: 'journey_status',
      old_value: member?.journey_status ?? null,
      new_value: nextStatus,
      changed_by: userId,
    });
    return;
  }

  if (request.request_type === 'journey_stage_completion') {
    const stageId = await resolveStageId(request.payload);
    if (!stageId) return;

    await admin.from('member_journey_progress').upsert(
      {
        member_id: request.member_id,
        stage_id: stageId,
        status: 'completed',
        completed_at: new Date().toISOString().slice(0, 10),
        approved_by: userId,
        approval_request_id: request.id,
        notes: note,
      },
      { onConflict: 'member_id,stage_id' }
    );
    return;
  }

  if (request.request_type === 'journey_requirement_completion') {
    const requirementId = await resolveRequirement(request.payload);
    if (!requirementId) return;

    await admin.from('member_requirement_completions').upsert(
      {
        member_id: request.member_id,
        requirement_id: requirementId,
        completed_on: new Date().toISOString().slice(0, 10),
        evidence_type: 'manual_approval',
        approved_by: userId,
        approval_request_id: request.id,
        notes: note,
      },
      { onConflict: 'member_id,requirement_id' }
    );
  }
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

  const admin = createAdminClient();
  const { data: request } = await admin
    .from('approval_requests')
    .select('id,member_id,request_type,payload,status')
    .eq('id', id)
    .maybeSingle();

  if (!request) return { ok: false, error: 'Approval request not found.' };
  if (request.status !== 'pending') return { ok: false, error: 'This request was already decided.' };

  if (decision === 'approved') {
    await applyApprovalMutation(
      {
        id: request.id,
        member_id: request.member_id,
        request_type: request.request_type,
        payload: (request.payload as Record<string, unknown>) ?? {},
      },
      auth.user.id,
      note
    );
  }

  const { error } = await admin
    .from('approval_requests')
    .update({
      status: decision,
      decided_by: auth.user.id,
      decided_at: new Date().toISOString(),
      decision_note: note,
    })
    .eq('id', id);

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

  const loggedBy = await resolvePcmStaffId(auth.user.email);
  const admin = createAdminClient();
  const { error } = await admin.from('follow_up_logs').insert({
    member_id: memberId,
    logged_by: loggedBy,
    date,
    method,
    notes: notes || null,
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

  const admin = createAdminClient();
  const { data: member } = await admin.from('members').select('journey_status').eq('id', memberId).maybeSingle();
  if (!member || member.journey_status === to) return { ok: false, error: 'Member or move not found.' };

  const { error } = await admin.from('approval_requests').insert({
    request_type: 'member_status_change',
    member_id: memberId,
    requested_by: auth.user.id,
    payload: { from: member.journey_status, to, reason: reason || null },
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
