import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@jlycc/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('./access', () => ({ requireAdminAccess: vi.fn() }));

import { createClient } from '@jlycc/supabase/server';
import { requireAdminAccess } from './access';
import { grantStaffAccess, removeStaffAccess, transferStaffWork } from './admin-actions';

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('admin operations actions', () => {
  let rpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    vi.mocked(createClient).mockResolvedValue({ rpc } as never);
    vi.mocked(requireAdminAccess).mockResolvedValue({ user: { id: 'admin-1' }, roles: ['admin'] } as never);
  });

  it('rejects a role outside the staff role allowlist before calling the database', async () => {
    const result = await grantStaffAccess(formData({
      userId: '00000000-0000-0000-0000-000000000101',
      role: 'member',
    }));

    expect(result).toEqual({ ok: false, error: 'Select an allowed staff role.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('grants staff access only through the audited admin RPC', async () => {
    const result = await grantStaffAccess(formData({
      userId: '00000000-0000-0000-0000-000000000101',
      role: 'pcm_staff',
      name: 'Team Member',
    }));

    expect(result).toEqual({ ok: true });
    expect(requireAdminAccess).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('pcm_admin_set_staff_role', {
      p_user_id: '00000000-0000-0000-0000-000000000101',
      p_role_code: 'pcm_staff',
      p_network_id: null,
      p_ministry_id: null,
      p_staff_name: 'Team Member',
      p_is_active: true,
      p_invited: false,
    });
  });

  it('removes staff access through the same audited RPC', async () => {
    const result = await removeStaffAccess(formData({
      userId: '00000000-0000-0000-0000-000000000101',
      role: 'ministry_head',
      ministryId: '00000000-0000-0000-0000-000000000102',
    }));

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('pcm_admin_set_staff_role', {
      p_user_id: '00000000-0000-0000-0000-000000000101',
      p_role_code: 'ministry_head',
      p_network_id: null,
      p_ministry_id: '00000000-0000-0000-0000-000000000102',
      p_staff_name: null,
      p_is_active: false,
      p_invited: false,
    });
  });

  it('rejects an invalid turnover before invoking its RPC', async () => {
    const result = await transferStaffWork(formData({
      sourceStaffId: '00000000-0000-0000-0000-000000000101',
      destinationStaffId: '00000000-0000-0000-0000-000000000101',
      reason: 'Coverage change',
    }));

    expect(result).toEqual({ ok: false, error: 'Choose two different active staff members.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('submits a turnover through the atomic transfer RPC', async () => {
    const result = await transferStaffWork(formData({
      sourceStaffId: '00000000-0000-0000-0000-000000000101',
      destinationStaffId: '00000000-0000-0000-0000-000000000102',
      reason: 'Coverage change for leave.',
    }));

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('pcm_transfer_staff_work', {
      p_source_staff_id: '00000000-0000-0000-0000-000000000101',
      p_destination_staff_id: '00000000-0000-0000-0000-000000000102',
      p_reason: 'Coverage change for leave.',
    });
  });
});
