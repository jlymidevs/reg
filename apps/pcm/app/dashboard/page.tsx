import Link from 'next/link';
import { createClient } from '@jlycc/supabase/server';
import { loadDashboardSnapshot } from '../lib/pcm-data';
import { requirePcmAccess } from '../lib/access';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { user, roles } = await requirePcmAccess(supabase);

  try {
    const snapshot = await loadDashboardSnapshot(supabase, roles, user.email);
    const roleLabel = roles.includes('super_admin') ? 'Super Admin' : roles[0]?.replaceAll('_', ' ') ?? 'PCM Staff';
    const pipeline = ['FTV', 'OGV', 'RM', 'AM'].map((status) => ({
      status,
      count: snapshot.members.filter((member) => member.journey_status === status).length,
    }));
    const tasks = snapshot.watchlist.slice(0, 2).map((member, index) => ({
      id: member.member_id,
      name: member.name,
      type: index === 0 ? 'CP' : 'IP',
      detail: index === 0 ? 'Check how their first Sunday service was.' : 'Meet to discuss D-Journey.',
      status: member.watch_level === 'inactive' ? 'OVERDUE' : 'PENDING',
    }));

    return (
      <div className="mx-auto max-w-[1120px] space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-[#147f84] sm:text-4xl">Dashboard Overview</h1>
            <p className="mt-1 text-sm font-medium text-[#22b8a4]">Here is what is happening today.</p>
          </div>
          <span className="hidden rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 shadow-sm sm:block">
            {roleLabel}
          </span>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active Members" value={snapshot.membersCount} icon="♧" />
          <MetricCard label="First-Time Visitors" value={snapshot.weeklyKpi?.ftv_to_ogv ?? 0} icon="♧" />
          <MetricCard label="Connected" value={snapshot.weeklyKpi?.heartlink_assignments ?? 0} icon="✓" />
          <MetricCard label="Pending Tasks" value={snapshot.pendingApprovalsCount + snapshot.watchlistCount} icon="◷" accent />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_5px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-[#167f84]">Today&apos;s Tasks</h2>
                <p className="mt-1 text-sm text-slate-400">Your pending tasks and follow-ups for today.</p>
              </div>
              <Link href="/dashboard/tasks" className="text-xs font-semibold text-[#168e91] hover:underline">View all</Link>
            </div>
            <div className="mt-5 space-y-3">
              {tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No tasks today.</div>
              ) : tasks.map((task) => (
                <Link href={`/members/${task.id}`} key={task.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-4 transition hover:border-[#62b9b6] hover:bg-[#f8fcfc]">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{task.name}</p>
                    <p className="mt-1 text-sm text-[#22b8a4]"><span className="font-semibold">{task.type}</span> • {task.detail}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold tracking-wide ${task.status === 'OVERDUE' ? 'bg-rose-100 text-rose-500' : 'bg-[#e5f4f3] text-[#188d90]'}`}>{task.status}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#299496] p-6 text-white shadow-[0_2px_5px_rgba(15,23,42,0.06)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl">D-Journey Pipeline</h2>
                <p className="mt-1 text-xs text-teal-100">Members by current journey status</p>
              </div>
              <Link href="/dashboard/members" className="text-xs font-semibold text-teal-50 hover:underline">Details</Link>
            </div>
            <div className="space-y-5">
              {pipeline.map((item) => (
                <div key={item.status}>
                  <div className="flex items-center justify-between text-sm font-semibold"><span>{item.status} <span className="font-normal text-teal-100">({pipelineLabel(item.status)})</span></span><span>{item.count}</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#8bd5cd]" style={{ width: `${Math.min(100, Math.max(8, item.count * 10))}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <QuickCard href="/dashboard/members" title="Members" detail={`${snapshot.membersCount} visible member records`} />
          <QuickCard href="/dashboard/pulse" title="Daily Pulse" detail={`${snapshot.watchlistCount} members need attention`} />
          <QuickCard href="/dashboard/meetings" title="Heartlink Reports" detail="Review ministry health and progress" />
        </section>
      </div>
    );
  } catch {
    return (
      <section className="mx-auto max-w-[1120px] space-y-6">
        <header>
          <h1 className="font-serif text-3xl text-[#147f84] sm:text-4xl">Dashboard Overview</h1>
          <p className="mt-1 text-sm font-medium text-[#22b8a4]">Here is what is happening today.</p>
        </header>
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">Dashboard data could not be loaded. Please refresh and try again.</p>
      </section>
    );
  }
}

function MetricCard({ label, value, icon, accent = false }: { label: string; value: number; icon: string; accent?: boolean }) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_2px_5px_rgba(15,23,42,0.06)]">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ${accent ? 'bg-[#148486] text-[#d8f153]' : 'bg-[#e6f4f3] text-[#138d91]'}`}>{icon}</div>
      <div><p className="text-[11px] font-bold uppercase tracking-wide text-[#2bb69f]">{label}</p><p className="mt-1 font-serif text-2xl text-[#16858a]">{value}</p></div>
    </article>
  );
}

function QuickCard({ href, title, detail }: { href: string; title: string; detail: string }) {
  return <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#61b8b4]"><p className="font-serif text-lg text-[#167f84]">{title}</p><p className="mt-1 text-sm text-slate-400">{detail}</p></Link>;
}

function pipelineLabel(status: string) {
  return ({ FTV: 'First-Time Visitor', OGV: 'Ongoing Visitor', RM: 'Regular Member', AM: 'Active Member' } as Record<string, string>)[status] ?? status;
}
