import Link from 'next/link';
import { createClient } from '@jlycc/supabase/server';
import { Topbar } from '../../components/topbar';
import { requirePcmAccess } from '../../lib/access';
import type { WatchlistRow } from '../../lib/pcm-data';

export const dynamic = 'force-dynamic';

export default async function PulsePage() {
  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const { data, error } = await supabase
    .from('inactive_watchlist_view')
    .select(
      'member_id,name,member_code,journey_status,assigned_pcm,last_attendance_at,last_followup_on,last_activity_on,days_inactive,watch_level'
    )
    .order('days_inactive', { ascending: false })
    .limit(50);

  const members = (data ?? []) as WatchlistRow[];
  return (
    <section className="space-y-6">
      <Topbar title="Watchlist" />
      <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Inactivity watchlist</h2>
        <p className="mt-2 text-sm text-gray-500">Members with 14+ days since last recorded activity.</p>
        <div className="mt-5 space-y-3">
          {error ? (
            <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">The inactivity watchlist could not be loaded. Please refresh and try again.</p>
          ) : members.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-teal-100 p-6 text-center text-sm text-gray-500">No inactive members are visible in your current scope.</p>
          ) : members.map((member) => (
            <div key={member.member_id} className="rounded-2xl border border-teal-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/members/${member.member_id}`} className="font-semibold text-[var(--pcm-text)] underline-offset-2 hover:underline">
                    {member.name}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {member.member_code ?? 'No code'} · {member.journey_status ?? 'No status'}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase text-amber-700">
                  {member.watch_level}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                {member.days_inactive} days inactive. Last attendance:{' '}
                {member.last_attendance_at ? new Date(member.last_attendance_at).toLocaleDateString() : 'None'}.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
