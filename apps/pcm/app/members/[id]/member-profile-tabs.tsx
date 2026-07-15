'use client';

import { useState } from 'react';

type Followup = { id: string; date: string; method: string; notes: string | null };
type History = { id: string; field: string; old_value: string | null; new_value: string | null; changed_at: string };

export default function MemberProfileTabs({
  member,
  followups,
  history,
  milestones,
}: {
  member: { name: string; email?: string | null; phone?: string | null; journey_status?: string | null; primary_heartlink?: string | null; risk_level?: string | null };
  followups: Followup[];
  history: History[];
  milestones: string[];
}) {
  const [tab, setTab] = useState<'overview' | 'discipleship' | 'activity'>('overview');
  const days = Array.from({ length: 84 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (83 - index));
    const key = date.toISOString().slice(0, 10);
    const active = followups.some((row) => row.date === key);
    return { key, active };
  });

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
      {(['overview', 'discipleship', 'activity'] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${tab === item ? 'bg-[#e2f2f2] text-[#147f84]' : 'text-slate-400 hover:bg-slate-50'}`}>{item === 'activity' ? 'Activity & Heat Map' : item}</button>)}
    </div>
    {tab === 'overview' ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ProfileStat label="Journey status" value={member.journey_status ?? 'Unassigned'} /><ProfileStat label="HeartLink" value={member.primary_heartlink ?? 'Not assigned'} /><ProfileStat label="Risk level" value={member.risk_level ?? 'Unspecified'} /><ProfileStat label="Interactions" value={String(followups.length)} /></div> : null}
    {tab === 'discipleship' ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{['CHOSEN_GENERATION', 'JOSHUA_GENERATION', 'INNER_CORE', 'WATER_BAPTISM', 'TRANSFORMATION_WEEKEND'].map((milestone) => <div key={milestone} className={`rounded-xl border p-4 ${milestones.includes(milestone) ? 'border-[#8bcfc7] bg-[#eef9f7]' : 'border-slate-200 bg-slate-50'}`}><p className="text-xs font-bold uppercase tracking-wide text-[#16858a]">{milestone.replaceAll('_', ' ')}</p><p className="mt-2 text-sm text-slate-500">{milestones.includes(milestone) ? 'Completed' : 'Not recorded'}</p></div>)}</div> : null}
    {tab === 'activity' ? <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><div><p className="text-sm font-semibold text-slate-700">Last 12 weeks</p><div className="mt-3 grid grid-cols-12 gap-1">{days.map((day) => <span key={day.key} title={day.key} className={`h-3 w-3 rounded-sm ${day.active ? 'bg-[#299496]' : 'bg-slate-100'}`} />)}</div></div><div><p className="text-sm font-semibold text-slate-700">Activity feed</p><div className="mt-3 space-y-3">{[...followups, ...history.map((row) => ({ id: row.id, date: row.changed_at.slice(0, 10), method: 'status', notes: `${row.field}: ${row.old_value ?? 'blank'} → ${row.new_value ?? 'blank'}` }))].slice(0, 8).map((row) => <div key={row.id} className="border-l-2 border-[#8bcfc7] pl-3"><p className="text-xs font-bold uppercase text-[#16858a]">{row.method}</p><p className="text-sm text-slate-600">{row.notes || 'Interaction recorded'}</p><p className="text-xs text-slate-400">{row.date}</p></div>)}</div></div></div> : null}
  </div>;
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-sm font-semibold text-[#147f84]">{value}</p></div>;
}
