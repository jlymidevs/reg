import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@jlycc/permissions', () => ({ getMyRoles: vi.fn() }));
vi.mock('@jlycc/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@jlycc/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('./audit', () => ({ logAudit: vi.fn() }));

import { getMyRoles } from '@jlycc/permissions';
import { createAdminClient } from '@jlycc/supabase/admin';
import { createClient } from '@jlycc/supabase/server';
import { logAudit } from './audit';
import { decideApproval, logFollowup, requestStatusChange } from './ops-actions';

const user = { id: 'user-1', email: 'operator@example.org' };

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('atomic care actions', () => {
  let rpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    rpc = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      rpc,
    } as never);
    vi.mocked(getMyRoles).mockResolvedValue(['admin'] as never);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        const selectedRows: Record<string, Record<string, unknown>> = {
          approval_requests: {
            id: 'approval-1',
            member_id: 'member-1',
            request_type: 'member_status_change',
            payload: { to: 'OGV' },
            status: 'pending',
          },
          members: { id: 'member-1', journey_status: 'FTV' },
          pcm_staff: { id: 'pcm-1' },
        };
        const query = {
          eq: vi.fn(),
          maybeSingle: vi.fn().mockResolvedValue({ data: selectedRows[table] ?? null }),
        };
        query.eq.mockReturnValue(query);

        return {
          select: vi.fn(() => query),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        };
      }),
    } as never);
    vi.mocked(logAudit).mockResolvedValue(undefined);
  });

  it('sends a follow-up only through the authenticated atomic RPC', async () => {
    const result = await logFollowup(
      formData({ memberId: 'member-1', method: 'call', date: '2026-07-16', notes: 'Checked in.' })
    );

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('pcm_log_followup', {
      p_member_id: 'member-1',
      p_date: '2026-07-16',
      p_method: 'call',
      p_notes: 'Checked in.',
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('rejects an invalid follow-up before invoking its RPC', async () => {
    const result = await logFollowup(formData({ memberId: 'member-1', method: 'email' }));

    expect(result).toEqual({ ok: false, error: 'Invalid follow-up method.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends a status-change request through the authenticated atomic RPC', async () => {
    const result = await requestStatusChange(
      formData({ memberId: 'member-1', to: 'DROPPED', reason: 'Member requested removal.' })
    );

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('pcm_request_status_change', {
      p_member_id: 'member-1',
      p_to_status: 'DROPPED',
      p_reason: 'Member requested removal.',
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('sends an approval decision through the authenticated atomic RPC', async () => {
    const result = await decideApproval(
      formData({ approvalId: 'approval-1', decision: 'approved', note: 'Reviewed.' })
    );

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('pcm_decide_approval', {
      p_approval_id: 'approval-1',
      p_decision: 'approved',
      p_note: 'Reviewed.',
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it.each([
    ['failed approval side effect'],
    ['failed approval audit insert'],
  ])('keeps approval failures generic and relies on RPC rollback for %s', async () => {
    rpc.mockResolvedValue({ error: { message: 'database detail must not reach staff' } });

    const result = await decideApproval(formData({ approvalId: 'approval-1', decision: 'approved' }));

    expect(result).toEqual({ ok: false, error: 'Unable to save approval decision.' });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });
});
