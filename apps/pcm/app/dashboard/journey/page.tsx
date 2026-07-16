import Link from 'next/link';
import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requirePcmAccess } from '../../lib/access';

export const dynamic = 'force-dynamic';

export default async function JourneyPage() {
  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const [{ data: stages, error: stagesError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from('journey_stages').select('id,code,name,description').order('sort_order'),
    supabase.from('member_dashboard_view').select('member_id,name,journey_status,current_stage_name').order('name').limit(200),
  ]);
  const stageList = stages ?? [];
  const memberList = members ?? [];
  const error = stagesError ?? membersError;

  return (
    <section className="space-y-6">
      <PageHeader title="D-Journey Tracker" subtitle="Track members through the discipleship milestones." />
      {error ? (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">D-Journey data could not be loaded. Please refresh and try again.</p>
      ) : (
        <>
          <div className="flex gap-6 overflow-x-auto border-b border-slate-200 pb-0">
            {['RED BOOK (SAINT)', 'GREEN BOOK (SHEEP)', 'YELLOW BOOK (SON)', 'BLUE BOOK (SERVANT)', 'PURPLE BOOK (SENT ONE)'].map((label) => (
              <span key={label} className="whitespace-nowrap border-b-2 border-[#299496] px-2 pb-3 text-sm font-bold text-[#22a995]">{label}</span>
            ))}
          </div>
          <LegacyCard>
            <div className="space-y-5">
              {stageList.length === 0 ? (
                <p className="py-8 text-center text-[#22a995]">No journey stages configured.</p>
              ) : stageList.map((stage) => {
                const current = memberList.filter((member) => member.current_stage_name === stage.name);
                return (
                  <div key={stage.id} className="border-b border-slate-200 pb-5 last:border-0">
                    <h2 className="font-serif text-xl text-[#147f84]">{stage.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{stage.description ?? 'Discipleship milestone'}</p>
                    <p className="mt-1 text-xs text-[#22b8a4]">{current.length} members currently in this stage.</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {current.length === 0 ? <p className="text-sm text-slate-400">No members currently in this stage.</p> : current.map((member) => (
                        <Link key={member.member_id} href={`/members/${member.member_id}`} className="rounded-xl border border-slate-200 p-3 text-sm font-semibold text-[#147f84] hover:border-[#299496]">
                          {member.name}<span className="mt-1 block text-xs font-normal text-slate-400">{member.journey_status ?? 'No status'}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </LegacyCard>
        </>
      )}
    </section>
  );
}
