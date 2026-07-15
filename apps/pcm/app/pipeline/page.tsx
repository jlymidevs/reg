import { createClient } from '@jlycc/supabase/server';
import { requirePcmAccess } from '../lib/access';
import PipelineBoard, { type PipelineMember } from './pipeline-board';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const { data } = await supabase
    .from('member_dashboard_view')
    .select('member_id,name,member_code,journey_status,current_stage_name,days_inactive,primary_heartlink')
    .order('name')
    .limit(200);

  return <PipelineBoard members={(data ?? []) as PipelineMember[]} />;
}
