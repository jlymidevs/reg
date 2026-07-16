import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requireAdminAccess } from '../../lib/access';

export const dynamic = 'force-dynamic';
type Row = Record<string, unknown> & { id?: string; status?: string; created_at?: string };

export default async function PromotionsPage() {
  const supabase = await createClient();
  await requireAdminAccess(supabase);
  const { data, error } = await supabase.from('approval_requests').select('id, member_id, requested_by, status, decision_note, created_at').eq('request_type', 'role_assignment').order('created_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as Row[];
  return <section className="space-y-6"><PageHeader title="Role Promotions" subtitle="Review role promotion requests from the live approval queue." />{error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Promotion requests could not be loaded.</p> : null}<LegacyCard><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-[#22a995]"><tr><th className="px-3 py-3">Request</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Created</th></tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-b border-slate-100"><td className="px-3 py-4 font-semibold text-slate-800">{String(row.requested_by ?? row.member_id ?? row.id ?? 'Promotion request')}</td><td className="px-3 py-4">{String(row.status ?? 'pending')}</td><td className="px-3 py-4 text-slate-500">{row.created_at ? new Date(String(row.created_at)).toLocaleString() : 'Date unavailable'}</td></tr>)}</tbody></table>{!rows.length && !error ? <p className="py-10 text-center text-sm text-slate-400">No role promotion requests found.</p> : null}</div></LegacyCard></section>;
}
