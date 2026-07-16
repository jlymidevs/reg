import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requireAdminAccess } from '../../lib/access';
import { submitTurnover } from '../../lib/admin-actions';

export const dynamic = 'force-dynamic';

export default async function TurnoverPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; message?: string }>;
}) {
  const supabase = await createClient();
  await requireAdminAccess(supabase);
  const [{ data }, flash] = await Promise.all([
    supabase.from('pcm_staff').select('id,name,email,status').eq('status', 'active').order('name'),
    searchParams,
  ]);
  const staff = data ?? [];
  const message = flash.message ? decodeURIComponent(flash.message) : null;

  return (
    <section className="space-y-6">
      <PageHeader title="Team Turnover" subtitle="Transfer assigned members and active tasks between staff." />
      {message ? (
        <p className={`rounded-xl border px-4 py-3 text-sm ${flash.flash === 'success' ? 'border-[#8bcfc7] bg-[#eef9f7] text-[#16858a]' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {message}
        </p>
      ) : null}
      <form action={submitTurnover} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <LegacyCard>
          <h2 className="font-serif text-xl text-[#147f84]">Select Personnel</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-end">
            <label className="text-sm font-semibold">
              From (Current Handler)
              <select name="sourceStaffId" required className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal">
                <option value="">Select staff member...</option>
                {staff.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.email})</option>)}
              </select>
            </label>
            <span aria-hidden className="mx-auto rounded-full bg-[#e6f4f3] px-4 py-3 text-[#16858a]">⇄</span>
            <label className="text-sm font-semibold">
              To (New Handler)
              <select name="destinationStaffId" required className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal">
                <option value="">Select staff member...</option>
                {staff.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.email})</option>)}
              </select>
            </label>
          </div>
          <label className="mt-5 block text-sm font-semibold">
            Transfer reason
            <textarea name="reason" required minLength={3} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal" placeholder="Document why this care workload is moving..." />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Optional note
            <textarea name="note" rows={2} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal" placeholder="Additional context for the receiving staff member" />
          </label>
        </LegacyCard>
        <div className="rounded-2xl bg-[#299496] p-6 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-100">Controlled transfer</p>
          <p className="mt-2 font-serif text-xl">Members and open tasks</p>
          <p className="mt-3 text-sm leading-6 text-teal-50">The transfer records the reason and audit trail. Source and receiving personnel must both be active.</p>
          <button type="submit" className="mt-7 w-full rounded-xl bg-[#a9d5d5] px-4 py-3 font-semibold text-[#16858a]">Execute Turnover</button>
        </div>
      </form>
      {!staff.length ? <p className="text-center text-sm text-slate-400">No active PCM staff are available for turnover.</p> : null}
    </section>
  );
}
