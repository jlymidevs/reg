import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requireAdminAccess } from '../../lib/access';
import { stageWorkbook, submitApplyImport, submitRejectImport } from '../../lib/import-actions';

export const dynamic = 'force-dynamic';
type Batch = Record<string, unknown> & { id?: string; file_name?: string; status?: string; created_at?: string; row_count?: number };

export default async function IntegrationPage({ searchParams }: { searchParams: Promise<{ flash?: string; message?: string }> }) {
  const supabase = await createClient();
  await requireAdminAccess(supabase);
  const [{ data, error }, params] = await Promise.all([
    supabase.from('import_batches').select('*').order('created_at', { ascending: false }).limit(100),
    searchParams,
  ]);
  const batches = (data ?? []) as Batch[];
  const message = params.message ? decodeURIComponent(params.message) : null;
  return <section className="space-y-6"><PageHeader title="Data Integration" subtitle="Stage Excel workbooks, review duplicates and errors, then approve safe application." />{message ? <p className="rounded-xl border border-[#8bcfc7] bg-[#eef9f7] px-4 py-3 text-sm text-[#16858a]">{message}</p> : null}<LegacyCard><h2 className="font-serif text-xl text-[#147f84]">Stage PCM workbook</h2><p className="mt-2 text-sm text-slate-500">No member rows are changed while staging. An administrator must approve the reviewed batch before apply.</p><form action={stageWorkbook} encType="multipart/form-data" className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-semibold">Excel workbook<input name="file" type="file" accept=".xlsx" required className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal" /></label><button type="submit" className="rounded-xl bg-[#299496] px-5 py-3 text-sm font-semibold text-white">Stage Workbook</button></form></LegacyCard><LegacyCard><h2 className="font-serif text-xl text-[#147f84]">Import batches</h2>{error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Import batches could not be loaded.</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-[#22a995]"><tr><th className="px-3 py-3">File</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Created</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody>{batches.map((batch, index) => <tr key={String(batch.id ?? index)} className="border-b border-slate-100"><td className="px-3 py-4 font-semibold">{String(batch.file_name ?? 'Workbook')}</td><td className="px-3 py-4">{String(batch.status ?? 'staged')}</td><td className="px-3 py-4 text-slate-500">{batch.created_at ? new Date(String(batch.created_at)).toLocaleString() : 'Date unavailable'}</td><td className="px-3 py-4 text-right"><div className="flex justify-end gap-2">{batch.id ? <form action={submitApplyImport}><input type="hidden" name="batchId" value={batch.id} /><button className="rounded-lg bg-[#299496] px-3 py-2 text-xs font-semibold text-white">Apply approved</button></form> : null}{batch.id ? <form action={submitRejectImport}><input type="hidden" name="batchId" value={batch.id} /><button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Reject</button></form> : null}</div></td></tr>)}</tbody></table>{!batches.length ? <p className="py-10 text-center text-sm text-slate-400">No import batches found.</p> : null}</div>}</LegacyCard></section>;
}
