import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@jlycc/supabase/server';
import { Topbar } from './components/topbar';
import { loadDashboardSnapshot } from './lib/pcm-data';
import { requirePcmAccess } from './lib/access';

export const dynamic = 'force-dynamic';

const QUICK_LINKS = [
  { href: '/members', title: 'Members', blurb: 'Search member records and care notes.' },
  { href: '/watchlist', title: 'Watchlist', blurb: 'Track members needing closer follow-up.' },
  {
    href: '/journey-approvals',
    title: 'Journey Approvals',
    blurb: 'Review discipleship milestones and requests.',
  },
  { href: '/followups', title: 'Follow-ups', blurb: 'Manage callbacks, visits, and prayer care.' },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { user, roles } = await requirePcmAccess(supabase);
  const snapshot = await loadDashboardSnapshot(supabase, roles, user.email);
  const statusCards = [
    {
      label: 'Members Needing Follow-up',
      value: String(snapshot.watchlistCount),
      tone: 'border-amber-200 bg-amber-50 text-amber-900',
      note: `${snapshot.inactiveCount} marked inactive for 30+ days.`,
    },
    {
      label: 'Pending Journey Approvals',
      value: String(snapshot.pendingApprovalsCount),
      tone: 'border-sky-200 bg-sky-50 text-sky-900',
      note: 'Pending requests visible to your current role scope.',
    },
    {
      label: 'Members In View',
      value: String(snapshot.membersCount),
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      note: 'Top member list shown below. Full list in Members.',
    },
  ];

  return (
    <div className="space-y-6">
      <Topbar title="PCM Dashboard" />

      <section className="rounded-3xl bg-gradient-to-r from-[var(--pcm-primary)] to-[var(--pcm-primary-light)] px-6 py-7 text-white shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-teal-50">Pastoral Care Ministry</p>
        <h2 className="mt-2 font-heading text-3xl font-semibold">Care team workspace is live.</h2>
        <p className="mt-3 max-w-3xl text-sm text-teal-50 sm:text-base">
          Authentication, routing, and core PCM dashboard data are live from Supabase. Next build-out can
          extend this into editing, approvals, and richer care workflows.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          {roles.length > 0 ? (
            roles.map((role) => (
              <span key={role} className="rounded-full bg-white/15 px-3 py-1 font-medium text-white">
                {role.replaceAll('_', ' ')}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-white/15 px-3 py-1 font-medium text-white">
              No active ministry roles found
            </span>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {statusCards.map((card) => (
          <article key={card.label} className={`rounded-2xl border p-5 shadow-sm ${card.tone}`}>
            <p className="text-sm font-medium">{card.label}</p>
            <p className="mt-3 font-heading text-4xl font-semibold">{card.value}</p>
            <p className="mt-3 text-sm opacity-80">{card.note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Watchlist now</h2>
              <p className="mt-1 text-sm text-gray-500">Members with 14+ days of inactivity.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {snapshot.watchlist.length === 0 ? (
              <EmptyState text="No members are currently on the inactivity watchlist." />
            ) : (
              snapshot.watchlist.map((member) => (
                <div key={member.member_id} className="rounded-2xl border border-teal-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/members/${member.member_id}`} className="font-semibold text-[var(--pcm-text)] underline-offset-2 hover:underline">
                        {member.name}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {member.member_code ?? 'No code'} · {member.journey_status ?? 'No status'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        member.watch_level === 'inactive'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {member.watch_level}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    {member.days_inactive} days inactive. Last activity:{' '}
                    {formatDate(member.last_activity_on) ?? 'No activity recorded'}.
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">This week</h2>
          <p className="mt-1 text-sm text-gray-500">Current PCM weekly KPI snapshot.</p>
          {snapshot.weeklyKpi ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatChip label="Follow-ups" value={snapshot.weeklyKpi.followups_completed} />
              <StatChip label="Attendance" value={snapshot.weeklyKpi.attendance_this_week} />
              <StatChip label="Recovered" value={snapshot.weeklyKpi.inactive_recovered} />
              <StatChip label="Requirements" value={snapshot.weeklyKpi.requirements_completed} />
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState text="No weekly KPI row is visible for this account yet." />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Quick links</h2>
            <p className="mt-1 text-sm text-gray-500">
              Placeholder routes ready for feature pages and access control.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5 transition-colors duration-200 hover:border-teal-300 hover:bg-teal-50"
            >
              <h3 className="font-heading text-lg font-semibold text-[var(--pcm-text)]">{link.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{link.blurb}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Member snapshot</h2>
          <div className="mt-5 space-y-3">
            {snapshot.members.length === 0 ? (
              <EmptyState text="No members are visible to this account yet." />
            ) : (
              snapshot.members.map((member) => (
                <div key={member.member_id} className="rounded-2xl border border-teal-100 p-4">
                  <Link href={`/members/${member.member_id}`} className="font-semibold text-[var(--pcm-text)] underline-offset-2 hover:underline">
                    {member.name}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {member.member_code ?? 'No code'} · {member.current_stage_name ?? 'No stage'} ·{' '}
                    {member.journey_status ?? 'No status'}
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    Last activity: {formatDate(member.last_activity_on) ?? 'No activity recorded'}.
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Pending approvals</h2>
          <div className="mt-5 space-y-3">
            {snapshot.approvals.length === 0 ? (
              <EmptyState text="No pending approvals are visible right now." />
            ) : (
              snapshot.approvals.map((request) => (
                <div key={request.id} className="rounded-2xl border border-teal-100 p-4">
                  <p className="font-semibold capitalize text-[var(--pcm-text)]">
                    {request.request_type.replaceAll('_', ' ')}
                  </p>
                  <p className="text-sm text-gray-500">
                    {request.members?.name ?? 'No member linked'} · {formatDate(request.created_at) ?? 'Unknown date'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 font-heading text-2xl font-semibold text-[var(--pcm-text)]">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-teal-200 p-4 text-sm text-gray-500">{text}</div>;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}
