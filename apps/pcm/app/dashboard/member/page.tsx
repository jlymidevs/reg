import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requirePcmAccess } from '../../lib/access';

export const dynamic = 'force-dynamic';
export default async function MemberDashboardPage() {
  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const { data, error } = await supabase.from('member_dashboard_view').select('*').limit(1);
  const member = data?.[0] as Record<string, unknown> | undefined;
  return <section className="space-y-6"><PageHeader title="My D-Journey" subtitle="Your personal journey stage, next steps, and activity." />{error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Your member dashboard could not be loaded.</p> : member ? <div className="grid gap-6 md:grid-cols-2"><LegacyCard><p className="text-xs font-bold uppercase tracking-wide text-[#22a995]">Current stage</p><p className="mt-3 font-serif text-3xl text-[#147f84]">{String(member.journey_status ?? member.stage ?? 'Not assigned')}</p><p className="mt-3 text-sm text-slate-500">Your next recommended steps are maintained by your care team.</p></LegacyCard><LegacyCard><p className="text-xs font-bold uppercase tracking-wide text-[#22a995]">Recent activity</p><p className="mt-3 text-sm text-slate-600">{String(member.last_activity_at ?? 'No activity recorded yet.')}</p></LegacyCard></div> : <LegacyCard><p className="text-center text-sm text-slate-500">No member profile is linked to this account yet.</p></LegacyCard>}</section>;
}
