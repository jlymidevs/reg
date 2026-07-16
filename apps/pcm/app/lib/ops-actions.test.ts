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

describe('care operation authorization', () => {
  let memberVisible = false;
  let selectedRows: Record<string, unknown>;
  let approvalUpdate: ReturnType<typeof vi.fn>;
  let insert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    memberVisible = false;
    selectedRows = {
      approval_requests: {
        id: 'approval-1',
        member_id: 'foreign-member',
        request_type: 'member_status_change',
        payload: { to: 'OGV' },
        status: 'pending',
      },
      members: { journey_status: 'FTV' },
      pcm_staff: { id: 'pcm-1' },
    };
    approvalUpdate = vi.fn().mockResolvedValue({ error: null });
    insert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: memberVisible ? { id: 'foreign-member' } : null }),
          })),
        })),
      })),
    } as never);
    vi.mocked(getMyRoles).mockResolvedValue(['network_head'] as never);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        const query = {
          eq: vi.fn(),
          maybeSingle: vi.fn().mockResolvedValue({ data: selectedRows[table] ?? null }),
        };
        query.eq.mockReturnValue(query);
        return {
          select: vi.fn(() => query),
          update: vi.fn(() => ({ eq: approvalUpdate })),
          insert,
        };
      }),
    } as never);
    vi.mocked(logAudit).mockResolvedValue(undefined);
  });

  it('rejects a foreign approval before using the service-role client', async () => {
    const result = await decideApproval(formData({ approvalId: 'approval-1', decision: 'rejected' }));

    expect(result).toEqual({ ok: false, error: 'Unable to process this member action.' });
    expect(approvalUpdate).not.toHaveBeenCalled();
  });

  it('does not expose a foreign approval decision state', async () => {
    selectedRows.approval_requests = {
      id: 'approval-1',
      member_id: 'foreign-member',
      request_type: 'member_status_change',
      payload: { to: 'OGV' },
      status: 'approved',
    };

    const result = await decideApproval(formData({ approvalId: 'approval-1', decision: 'rejected' }));

    expect(result).toEqual({ ok: false, error: 'Unable to process this member action.' });
    expect(approvalUpdate).not.toHaveBeenCalled();
  });

  it('rejects a foreign member before inserting a follow-up', async () => {
    vi.mocked(getMyRoles).mockResolvedValue(['pcm_staff'] as never);

    const result = await logFollowup(formData({ memberId: 'foreign-member', method: 'call' }));

    expect(result).toEqual({ ok: false, error: 'Unable to process this member action.' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a foreign member before inserting a status-change request', async () => {
    const result = await requestStatusChange(formData({ memberId: 'foreign-member', to: 'OGV' }));

    expect(result).toEqual({ ok: false, error: 'Unable to process this member action.' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('flags a committed follow-up when its audit entry fails', async () => {
    memberVisible = true;
    vi.mocked(getMyRoles).mockResolvedValue(['admin'] as never);
    vi.mocked(logAudit).mockRejectedValue(new Error('audit unavailable'));

    const result = await logFollowup(formData({ memberId: 'foreign-member', method: 'call' }));

    expect(result).toEqual({
      ok: false,
      error: 'Follow-up was saved, but audit logging failed. Contact an administrator for review.',
    });
    expect(insert).toHaveBeenCalledOnce();
  });
});
