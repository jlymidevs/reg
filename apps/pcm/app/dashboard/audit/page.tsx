import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requireAdminAccess } from '../../lib/access';

export const dynamic = 'force-dynamic';

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const supabase = await createClient();
  await requireAdminAccess(supabase);
  const { q = '', page = '1' } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const start = (currentPage - 1) * 30;
  const term = q.trim().replace(/[,%()]/g, ' ').slice(0, 80);
  let query = supabase
    .from('admin_audit_logs')
    .select('id,action,entity_type,entity_id,before,after,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(start, start + 29);
  if (term) query = query.or(`action.ilike.%${term}%,entity_type.ilike.%${term}%,entity_id.ilike.%${term}%`);
  const { data, error, count } = await query;
  const rows = data ?? [];
  const hasNext = start + rows.length < (count ?? 0);

  return (
    <section className="space-y-6">
      <PageHeader title="Audit Trail" subtitle="Review privileged changes and care operations recorded by the portal." />
      <form className="flex max-w-lg gap-2" action="/dashboard/audit">
        <label className="sr-only" htmlFor="audit-search">Search audit events</label>
        <input id="audit-search" name="q" defaultValue={q} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Search action, entity, or ID" />
        <button className="rounded-xl bg-[#299496] px-4 py-3 text-sm font-semibold text-white">Search</button>
      </form>
      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Audit records could not be loaded. Try again shortly.</p> : null}
      <LegacyCard>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-[#22a995]"><tr><th className="px-3 py-3">When</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Entity</th><th className="px-3 py-3">Details</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-slate-100 align-top"><td className="whitespace-nowrap px-3 py-4 text-slate-500">{new Date(row.created_at).toLocaleString()}</td><td className="px-3 py-4 font-semibold text-slate-800">{row.action.replaceAll('_', ' ')}</td><td className="px-3 py-4"><p>{row.entity_type}</p><p className="max-w-48 truncate text-xs text-slate-400">{row.entity_id}</p></td><td className="px-3 py-4"><details><summary className="cursor-pointer text-[#16858a]">View payload</summary><pre className="mt-2 max-w-xl overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify({ before: row.before, after: row.after }, null, 2)}</pre></details></td></tr>)}</tbody></table>
          {!rows.length && !error ? <p className="py-10 text-center text-sm text-slate-400">No audit events match this search.</p> : null}
        </div>
        <div className="mt-5 flex justify-between text-sm"><a className={currentPage > 1 ? 'text-[#16858a]' : 'pointer-events-none text-slate-300'} href={`/dashboard/audit?q=${encodeURIComponent(q)}&page=${currentPage - 1}`}>Previous</a><span className="text-slate-500">Page {currentPage}</span><a className={hasNext ? 'text-[#16858a]' : 'pointer-events-none text-slate-300'} href={`/dashboard/audit?q=${encodeURIComponent(q)}&page=${currentPage + 1}`}>Next</a></div>
      </LegacyCard>
    </section>
  );
}
