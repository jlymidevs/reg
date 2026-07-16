import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requirePcmAccess } from '../../lib/access';

export const dynamic = 'force-dynamic';
export default async function MinistryDashboardPage() {
  const supabase = await createClient();
  const { roles } = await requirePcmAccess(supabase);
  if (!roles.includes('ministry_head') && !roles.includes('admin') && !roles.includes('super_admin')) return <section className="space-y-6"><PageHeader title="Ministry Dashboard" subtitle="Your scoped ministry care view." /><p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Ministry Head access is required.</p></section>;
  const { data, error } = await supabase.from('member_dashboard_view').select('*').limit(100);
  const rows = data ?? [];
  return <section className="space-y-6"><PageHeader title="Ministry Dashboard" subtitle="Members and care activity visible in your ministry scope." />{error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Ministry data could not be loaded.</p> : <LegacyCard><h2 className="font-serif text-xl text-[#147f84]">Scoped Members ({rows.length})</h2><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-[#22a995]"><tr><th className="px-3 py-3">Member</th><th className="px-3 py-3">Journey Stage</th><th className="px-3 py-3">Last Activity</th></tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-b border-slate-100"><td className="px-3 py-4 font-semibold">{String(row.full_name ?? row.name ?? row.member_name ?? 'Member')}</td><td className="px-3 py-4">{String(row.journey_status ?? row.stage ?? 'Unassigned')}</td><td className="px-3 py-4 text-slate-500">{String(row.last_activity_at ?? 'No activity')}</td></tr>)}</tbody></table>{!rows.length ? <p className="py-10 text-center text-sm text-slate-400">No members are currently visible in this ministry scope.</p> : null}</div></LegacyCard>}</section>;
}
