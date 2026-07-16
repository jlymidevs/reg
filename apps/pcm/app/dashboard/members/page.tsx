import Link from 'next/link';
import { createClient } from '@jlycc/supabase/server';
import { Topbar } from '../../components/topbar';
import { requirePcmAccess } from '../../lib/access';
import type { DashboardMemberRow } from '../../lib/pcm-data';

export const dynamic = 'force-dynamic';

export default async function DashboardMembersPage() {
  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const { data, error } = await supabase
    .from('member_dashboard_view')
    .select(
      'member_id,name,member_code,journey_status,email,current_stage_code,current_stage_name,stage_completed_count,stage_required_count,last_activity_on,days_inactive,primary_heartlink,total_attendance,active_ministries'
    )
    .order('name')
    .limit(50);

  const members = (data ?? []) as DashboardMemberRow[];
  return (
    <section className="space-y-6">
      <Topbar title="Members" />
      <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Member records</h2>
        <p className="mt-2 text-sm text-gray-500">Showing up to 50 members visible to your current role scope.</p>
        <div className="mt-5 overflow-x-auto">
          {error ? (
            <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Member records could not be loaded. Please refresh and try again.</p>
          ) : members.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-teal-100 p-6 text-center text-sm text-gray-500">No member records are visible in your current scope.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="text-gray-500">
                <tr className="border-b border-teal-100">
                  <th className="px-3 py-3 font-medium">Member</th>
                  <th className="px-3 py-3 font-medium">Journey</th>
                  <th className="px-3 py-3 font-medium">Stage</th>
                  <th className="px-3 py-3 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.member_id} className="border-b border-teal-50 last:border-b-0">
                    <td className="px-3 py-3">
                      <Link href={`/members/${member.member_id}`} className="font-medium text-[var(--pcm-text)] underline-offset-2 hover:underline">
                        {member.name}
                      </Link>
                      <p className="text-gray-500">{member.member_code ?? 'No code'}</p>
                    </td>
                    <td className="px-3 py-3">{member.journey_status ?? 'No status'}</td>
                    <td className="px-3 py-3">{member.current_stage_name ?? 'No stage'}</td>
                    <td className="px-3 py-3">
                      {member.last_activity_on ? new Date(member.last_activity_on).toLocaleDateString() : 'No activity'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
