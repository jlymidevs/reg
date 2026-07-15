import { createClient } from '@jlycc/supabase/server';
import { Topbar } from '../../components/topbar';
import { requirePcmAccess } from '../../lib/access';
import type { WeeklyKpiRow } from '../../lib/pcm-data';

export const dynamic = 'force-dynamic';

export default async function WeeklyReportPage() {
  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const { data } = await supabase
    .from('pcm_weekly_kpi_view')
    .select(
      'pcm_staff_id,pcm_staff_name,week_start,week_end,followups_completed,members_assigned,ftv_to_ogv,ogv_to_rm,rm_to_am,attendance_this_week,inactive_recovered,heartlink_assignments,requirements_completed'
    )
    .order('week_start', { ascending: false })
    .limit(20);

  const rows = (data ?? []) as WeeklyKpiRow[];
  return (
    <section className="space-y-6">
      <Topbar title="Weekly Report" />
      <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Weekly KPI report</h2>
        <p className="mt-2 text-sm text-gray-500">Recent weekly summaries from `pcm_weekly_kpi_view`.</p>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-gray-500">
              <tr className="border-b border-teal-100">
                <th className="px-3 py-3 font-medium">PCM staff</th>
                <th className="px-3 py-3 font-medium">Week</th>
                <th className="px-3 py-3 font-medium">Follow-ups</th>
                <th className="px-3 py-3 font-medium">Attendance</th>
                <th className="px-3 py-3 font-medium">Recovered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.pcm_staff_id}-${row.week_start}`} className="border-b border-teal-50 last:border-b-0">
                  <td className="px-3 py-3">{row.pcm_staff_name}</td>
                  <td className="px-3 py-3">
                    {new Date(row.week_start).toLocaleDateString()} - {new Date(row.week_end).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">{row.followups_completed}</td>
                  <td className="px-3 py-3">{row.attendance_this_week}</td>
                  <td className="px-3 py-3">{row.inactive_recovered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
