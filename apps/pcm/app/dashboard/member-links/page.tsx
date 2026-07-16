import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requireAdminAccess } from '../../lib/access';
import { submitMemberLinkDecision } from '../../lib/admin-actions';

export const dynamic = 'force-dynamic';
type Row = Record<string, unknown> & { id?: string; status?: string; created_at?: string };

export default async function MemberLinksPage() {
  const supabase = await createClient();
  await requireAdminAccess(supabase);
  const { data, error } = await supabase.from('member_link_requests').select('*').order('created_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as Row[];
  return <section className="space-y-6"><PageHeader title="Member Link Approvals" subtitle="Review requests linking authenticated accounts to member records." />{error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Member link requests could not be loaded.</p> : null}<LegacyCard><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-[#22a995]"><tr><th className="px-3 py-3">Request</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Created</th><th className="px-3 py-3 text-right">Decision</th></tr></thead><tbody>{rows.map((row, index) => { const id = String(row.id ?? ''); const status = String(row.status ?? 'pending'); return <tr key={id || index} className="border-b border-slate-100"><td className="px-3 py-4 font-semibold text-slate-800">{String(row.user_id ?? row.member_id ?? row.id ?? 'Member link request')}</td><td className="px-3 py-4">{status}</td><td className="px-3 py-4 text-slate-500">{row.created_at ? new Date(String(row.created_at)).toLocaleString() : 'Date unavailable'}</td><td className="px-3 py-4 text-right">{id && ['pending', 'needs_more_info'].includes(status) ? <form action={submitMemberLinkDecision} className="flex justify-end gap-2"><input type="hidden" name="requestId" value={id} /><input type="hidden" name="memberId" value={String(row.member_id ?? '')} /><button name="decision" value="approve" className="rounded-lg bg-[#299496] px-3 py-2 text-xs font-semibold text-white">Approve</button><button name="decision" value="reject" className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Reject</button></form> : <span className="text-xs text-slate-400">Resolved</span>}</td></tr>; })}</tbody></table>{!rows.length && !error ? <p className="py-10 text-center text-sm text-slate-400">No member-link requests found.</p> : null}</div></LegacyCard></section>;
}
