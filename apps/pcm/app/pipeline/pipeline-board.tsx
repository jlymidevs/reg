'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { requestStatusChange } from '../lib/ops-actions';

export type PipelineMember = {
  member_id: string;
  name: string;
  member_code: string | null;
  journey_status: string | null;
  current_stage_name: string | null;
  days_inactive: number | null;
  primary_heartlink: string | null;
};

const FILTERS = ['ALL', 'FTV', 'OGV', 'RM', 'AM'] as const;
const COLUMNS = ['FTV', 'OGV', 'RM', 'AM', 'DROPPED'] as const;

export default function PipelineBoard({ members }: { members: PipelineMember[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [dragged, setDragged] = useState<PipelineMember | null>(null);
  const [dropTarget, setDropTarget] = useState<(typeof COLUMNS)[number] | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitMove(to: (typeof COLUMNS)[number]) {
    if (!dragged) return;
    const form = new FormData();
    form.set('memberId', dragged.member_id);
    form.set('to', to);
    form.set('reason', reason);
    form.set('path', '/pipeline');
    startTransition(async () => {
      const result = await requestStatusChange(form);
      if (!result.ok) setError(result.error);
      else window.location.reload();
    });
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#22b8a4]">CRM Pipeline</p><h1 className="mt-1 font-serif text-3xl text-[#147f84]">Visual Discipleship Tracking</h1><p className="mt-1 text-sm text-slate-500">Drag members through care stages. Moves require approval and are audited.</p></div>
        <div className="flex gap-2 rounded-xl bg-white p-1 shadow-sm">{FILTERS.map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === item ? 'bg-[#299496] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{item}</button>)}</div>
      </header>

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <div className="grid gap-4 overflow-x-auto pb-3 xl:grid-cols-5">
        {COLUMNS.map((column) => {
          const cards = members.filter((member) => (member.journey_status ?? 'FTV') === column && (filter === 'ALL' || filter === column));
          return <div key={column} onDragOver={(event) => { event.preventDefault(); setDropTarget(column); }} onDrop={(event) => { event.preventDefault(); if (column === 'DROPPED') { setReason(''); setDropTarget(column); } else { submitMove(column); } }} className={`min-w-[220px] rounded-2xl border bg-slate-50 p-3 transition ${dropTarget === column ? 'border-[#299496] bg-[#e8f7f6]' : 'border-slate-200'}`}>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-700">{column}</h2><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-400">{cards.length}</span></div>
            <div className="space-y-3">{cards.map((member) => <article key={member.member_id} draggable onDragStart={() => setDragged(member)} onDragEnd={() => setDragged(null)} className="cursor-grab rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:cursor-grabbing"><Link href={`/members/${member.member_id}`} className="font-semibold text-[#147f84] hover:underline">{member.name}</Link><p className="mt-1 text-xs text-slate-400">{member.member_code ?? 'No code'}</p><p className="mt-3 text-xs text-slate-500">{member.current_stage_name ?? 'No stage'}{member.days_inactive ? ` · ${member.days_inactive}d inactive` : ''}</p><div className="mt-3 flex flex-wrap gap-1"><span className="rounded-full bg-[#e6f4f3] px-2 py-1 text-[10px] font-bold text-[#16858a]">{member.primary_heartlink ?? 'No HeartLink'}</span></div></article>)}</div>
          </div>;
        })}
      </div>

      {dragged && dropTarget === 'DROPPED' ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="font-serif text-2xl text-[#147f84]">Document pastoral drop</h2><p className="mt-2 text-sm text-slate-500">Why is {dragged.name} moving to Dropped? This reason is saved with the approval request.</p><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#299496]" placeholder="Type at least 10 characters..." /><div className="mt-4 flex justify-end gap-2"><button onClick={() => { setDragged(null); setDropTarget(null); }} className="rounded-xl px-4 py-2 text-sm text-slate-500">Cancel</button><button disabled={isPending || reason.trim().length < 10} onClick={() => submitMove('DROPPED')} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Submit drop request</button></div></div></div> : null}
    </section>
  );
}
