import { createClient } from '@jlycc/supabase/server';
import { requirePcmAccess } from '../../lib/access';
import PipelineBoard, { type PipelineMember } from '../../pipeline/pipeline-board';

export const dynamic = 'force-dynamic';

export default async function DashboardPipelinePage() {
  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const { data, error } = await supabase
    .from('member_dashboard_view')
    .select('member_id,name,member_code,journey_status,current_stage_name,days_inactive,primary_heartlink')
    .order('name')
    .limit(200);

  if (error) {
    return (
      <section className="space-y-6">
        <PipelineHeader />
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">The pipeline could not be loaded. Please refresh and try again.</p>
      </section>
    );
  }

  const members = (data ?? []) as PipelineMember[];
  if (members.length === 0) {
    return (
      <section className="space-y-6">
        <PipelineHeader />
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No members are visible in your current scope.</p>
      </section>
    );
  }

  return <PipelineBoard members={members} />;
}

function PipelineHeader() {
  return (
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#22b8a4]">CRM Pipeline</p>
      <h1 className="mt-1 font-serif text-3xl text-[#147f84]">Visual Discipleship Tracking</h1>
      <p className="mt-1 text-sm text-slate-500">Drag members through care stages. Moves require approval and are audited.</p>
    </header>
  );
}
