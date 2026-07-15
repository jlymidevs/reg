import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requirePcmAccess } from '../../lib/access';

export const dynamic = 'force-dynamic';

export default async function TurnoverPage() {
  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const { data } = await supabase.from('pcm_staff').select('id,name,email,status').order('name');
  const staff = data ?? [];
  return <section className="space-y-6"><PageHeader title="Team Turnover" subtitle="Transfer assigned members and active tasks between staff." /><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><LegacyCard><h2 className="font-serif text-xl text-[#147f84]">Select Personnel</h2><div className="mt-6 grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-end"><label className="text-sm font-semibold">From (Current Handler)<select className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal"><option>Select staff member...</option>{staff.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><span className="mx-auto rounded-full bg-[#e6f4f3] px-4 py-3 text-[#16858a]">⇄</span><label className="text-sm font-semibold">To (New Handler)<select className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal"><option>Select staff member...</option>{staff.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label></div></LegacyCard><div className="rounded-2xl bg-[#299496] p-6 text-white"><p className="text-[11px] font-bold uppercase tracking-wide text-teal-100">Transferring from</p><p className="mt-2 font-serif text-xl">Not selected</p><hr className="my-6 border-white/20"/><p className="text-[11px] font-bold uppercase tracking-wide text-teal-100">Transferring to</p><p className="mt-2 font-serif text-xl">Not selected</p><button className="mt-7 w-full rounded-xl bg-[#a9d5d5] px-4 py-3 font-semibold text-[#16858a]">Execute Turnover</button></div></div></section>;
}
