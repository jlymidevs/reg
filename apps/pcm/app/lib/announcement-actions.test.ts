import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@jlycc/permissions', () => ({ getMyRoles: vi.fn() }));
vi.mock('@jlycc/supabase/server', () => ({ createClient: vi.fn() }));

import { getMyRoles } from '@jlycc/permissions';
import { createClient } from '@jlycc/supabase/server';
import { archiveAnnouncement, saveAnnouncement } from './announcement-actions';

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('announcement actions', () => {
  let rpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    rpc = vi.fn().mockResolvedValue({ data: 'announcement-1', error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      rpc,
    } as never);
    vi.mocked(getMyRoles).mockResolvedValue(['admin'] as never);
  });

  it('requires a target id for scoped audiences before calling the database', async () => {
    const result = await saveAnnouncement(formData({
      audience: 'network',
      title: 'Serve day',
      body: 'Please join the outreach team.',
    }));

    expect(result).toEqual({ ok: false, error: 'A target ID is required for network or ministry announcements.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('saves a scoped announcement through the authenticated RPC', async () => {
    const result = await saveAnnouncement(formData({
      audience: 'network',
      targetId: '00000000-0000-0000-0000-000000000201',
      title: 'Serve day',
      body: 'Please join the outreach team.',
      mode: 'publish',
    }));

    expect(result).toEqual({ ok: true, announcementId: 'announcement-1' });
    expect(rpc).toHaveBeenCalledWith('pcm_save_announcement', {
      p_announcement_id: null,
      p_title: 'Serve day',
      p_body: 'Please join the outreach team.',
      p_audience: 'network',
      p_target_id: '00000000-0000-0000-0000-000000000201',
      p_target_role_code: null,
      p_publish: true,
    });
  });

  it('archives through the authenticated RPC', async () => {
    const result = await archiveAnnouncement(formData({ announcementId: '00000000-0000-0000-0000-000000000301' }));

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('pcm_archive_announcement', {
      p_announcement_id: '00000000-0000-0000-0000-000000000301',
    });
  });
});
