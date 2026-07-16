import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requirePcmAccess } from '../../lib/access';

export const dynamic = 'force-dynamic';

export default async function KraPage() {
  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const { data, error } = await supabase.from('pcm_weekly_kpi_view').select('pcm_staff_name,followups_completed,members_assigned,ftv_to_ogv,ogv_to_rm,rm_to_am,attendance_this_week,heartlink_assignments,requirements_completed').order('week_start', { ascending: false }).limit(25);
  if (error) return <section className="space-y-6"><PageHeader title="KRA Dashboard" subtitle="PCM Follow-Up Reports & Conversion Metrics" /><p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">KRA data could not be loaded. Try again shortly.</p></section>;
  const rows = data ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.members_assigned ?? 0), 0);
  const followups = rows.reduce((sum, row) => sum + Number(row.followups_completed ?? 0), 0);
  return <section className="space-y-6"><PageHeader title="KRA Dashboard" subtitle="PCM Follow-Up Reports & Conversion Metrics" action={<div className="flex gap-2"><select className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"><option>2026</option></select><select className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"><option>Q1 (Jan-Mar)</option></select></div>} /><div className="grid gap-4 md:grid-cols-3"><Metric title="Total Reach (Base)" value={total} /><Metric title="Total Follow-ups" value={followups} /><Metric title="Conversion Rate" value={`${total ? Math.round((followups / total) * 100) : 0}%`} dark /></div><LegacyCard><h2 className="mb-5 font-serif text-xl text-[#147f84]">Quarterly Follow-Up Report</h2><div className="overflow-x-auto"><table className="min-w-full text-center text-sm"><thead className="bg-[#299496] text-white"><tr>{['PCM Name','Base','TC','CP','VC','CH','IP','CO','VO'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.pcm_staff_name}-${index}`} className="border-b border-slate-200"><td className="px-4 py-3 text-left font-semibold">{row.pcm_staff_name}</td><td className="px-4 py-3">{row.members_assigned}</td><td className="px-4 py-3">{row.followups_completed}</td><td className="px-4 py-3">{row.ftv_to_ogv}</td><td className="px-4 py-3">{row.ogv_to_rm}</td><td className="px-4 py-3">{row.rm_to_am}</td><td className="px-4 py-3">{row.heartlink_assignments}</td><td className="px-4 py-3">{row.requirements_completed}</td><td className="px-4 py-3">0</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-[#22a995]">Legend: TC Text Conversation · CP Call · VC Video Call · CH Chat · IP In person</p></LegacyCard></section>;
}

function Metric({ title, value, dark = false }: { title: string; value: string | number; dark?: boolean }) { return <div className={`rounded-2xl border border-slate-200 p-6 shadow-sm ${dark ? 'bg-[#299496] text-white' : 'bg-white'}`}><p className="text-sm font-semibold">{title}</p><p className="mt-4 font-serif text-3xl">{value}</p></div>; }
