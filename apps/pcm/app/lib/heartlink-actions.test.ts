import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@jlycc/permissions', () => ({ getMyRoles: vi.fn() }));
vi.mock('@jlycc/supabase/server', () => ({ createClient: vi.fn() }));

import { getMyRoles } from '@jlycc/permissions';
import { createClient } from '@jlycc/supabase/server';
import { saveHeartlinkReport } from './heartlink-actions';

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('saveHeartlinkReport', () => {
  let rpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    rpc = vi.fn().mockResolvedValue({ data: 'report-1', error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      rpc,
    } as never);
    vi.mocked(getMyRoles).mockResolvedValue(['network_head'] as never);
  });

  it('rejects missing report fields before calling the database', async () => {
    const result = await saveHeartlinkReport(formData({ topic: 'Care group' }));

    expect(result).toEqual({ ok: false, error: 'HeartLink, category, topic, venue, and date are required.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('saves typed attendees through the authenticated atomic RPC', async () => {
    const result = await saveHeartlinkReport(formData({
      heartlinkId: '00000000-0000-0000-0000-000000000101',
      category: 'weekly',
      topic: 'Red Book Chapter 1',
      venue: 'Community Hall',
      reportDate: '2026-07-19',
      regularAttendees: 'Alex\nSam',
      firstTimeAttendees: 'Jordan',
      childAttendees: 'Mika',
      mode: 'publish',
    }));

    expect(result).toEqual({ ok: true, reportId: 'report-1' });
    expect(rpc).toHaveBeenCalledWith('pcm_save_heartlink_report', {
      p_report_id: null,
      p_heartlink_id: '00000000-0000-0000-0000-000000000101',
      p_category: 'weekly',
      p_topic: 'Red Book Chapter 1',
      p_venue: 'Community Hall',
      p_report_date: '2026-07-19',
      p_started_at: null,
      p_ended_at: null,
      p_pastor: null,
      p_coordinator: null,
      p_notes: null,
      p_attendees: [
        { attendee_type: 'regular', attendee_name: 'Alex' },
        { attendee_type: 'regular', attendee_name: 'Sam' },
        { attendee_type: 'first_time', attendee_name: 'Jordan' },
        { attendee_type: 'child', attendee_name: 'Mika' },
      ],
      p_publish: true,
    });
  });
});
