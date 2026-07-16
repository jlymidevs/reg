import Link from 'next/link';
import { createClient } from '@jlycc/supabase/server';
import { Topbar } from '../../components/topbar';
import { requirePcmAccess } from '../../lib/access';
import type { WatchlistRow } from '../../lib/pcm-data';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const { data, error } = await supabase
    .from('inactive_watchlist_view')
    .select(
      'member_id,name,member_code,journey_status,assigned_pcm,last_attendance_at,last_followup_on,last_activity_on,days_inactive,watch_level'
    )
    .order('days_inactive', { ascending: false })
    .limit(20);

  const queue = (data ?? []) as WatchlistRow[];
  return (
    <section className="space-y-6">
      <Topbar title="Follow-ups" />
      <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Follow-up queue</h2>
        <p className="mt-2 text-sm text-gray-500">Priority list based on inactivity and missing recent contact.</p>
        <div className="mt-5 space-y-3">
          {error ? (
            <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">The follow-up queue could not be loaded. Please refresh and try again.</p>
          ) : queue.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-teal-100 p-6 text-center text-sm text-gray-500">No follow-ups are waiting in your current scope.</p>
          ) : queue.map((member) => (
            <div key={member.member_id} className="rounded-2xl border border-teal-100 p-4">
              <Link href={`/members/${member.member_id}`} className="font-semibold text-[var(--pcm-text)] underline-offset-2 hover:underline">
                {member.name}
              </Link>
              <p className="text-sm text-gray-500">
                {member.days_inactive} days inactive · Last follow-up:{' '}
                {member.last_followup_on ? new Date(member.last_followup_on).toLocaleDateString() : 'None recorded'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
