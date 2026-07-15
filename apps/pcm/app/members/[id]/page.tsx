import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@jlycc/supabase/server';
import { ActionFlash } from '../../components/action-flash';
import { Topbar } from '../../components/topbar';
import { requirePcmAccess } from '../../lib/access';
import { submitApprovalDecision, submitFollowupLog } from '../../lib/ops-actions';
import type { ApprovalRequestQueryRow, DashboardMemberRow } from '../../lib/pcm-data';
import { normalizeApprovalRequests } from '../../lib/pcm-data';
import MemberProfileTabs from './member-profile-tabs';

export const dynamic = 'force-dynamic';

type MemberDetailRow = DashboardMemberRow & {
  id?: string;
  phone?: string | null;
  telephone?: string | null;
  address?: string | null;
  entry_date?: string | null;
  risk_level?: string | null;
  activity_score?: number | null;
  fb_name?: string | null;
};

interface FollowupRow {
  id: string;
  date: string;
  method: string;
  notes: string | null;
  created_at: string;
}

interface HistoryRow {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string; message?: string }>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const supabase = await createClient();
  await requirePcmAccess(supabase);

  const [{ data: dashboard }, { data: member }, { data: followups }, { data: history }, { data: approvals }] =
    await Promise.all([
      supabase
        .from('member_dashboard_view')
        .select(
          'member_id,name,member_code,journey_status,email,current_stage_code,current_stage_name,stage_completed_count,stage_required_count,last_activity_on,days_inactive,primary_heartlink,total_attendance,active_ministries'
        )
        .eq('member_id', id)
        .maybeSingle(),
      supabase
        .from('members')
        .select('id,name,phone,telephone,address,email,entry_date,risk_level,activity_score,fb_name')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('follow_up_logs')
        .select('id,date,method,notes,created_at')
        .eq('member_id', id)
        .order('date', { ascending: false })
        .limit(10),
      supabase
        .from('member_field_history')
        .select('id,field,old_value,new_value,changed_at')
        .eq('member_id', id)
        .order('changed_at', { ascending: false })
        .limit(12),
      supabase
        .from('approval_requests')
        .select('id,request_type,status,created_at,decision_note,payload,members(name,member_code,journey_status)')
        .eq('member_id', id)
        .order('created_at', { ascending: false })
        .limit(12),
    ]);

  if (!dashboard) notFound();

  const detail: MemberDetailRow = {
    ...(dashboard as DashboardMemberRow),
    ...(member as Record<string, unknown> | null),
  };
  const followupRows = (followups ?? []) as FollowupRow[];
  const historyRows = (history ?? []) as HistoryRow[];
  const approvalRows = normalizeApprovalRequests((approvals ?? []) as ApprovalRequestQueryRow[]);
  const { data: completedMilestones } = await supabase
    .from('member_requirement_completions')
    .select('journey_requirements(code)')
    .eq('member_id', id);
  const milestones = (completedMilestones ?? [])
    .map((row) => (row.journey_requirements as unknown as { code: string } | null)?.code)
    .filter((code): code is string => Boolean(code));

  return (
    <section className="space-y-6">
      <Topbar title="Member Detail" />
      {flash.message && (flash.flash === 'success' || flash.flash === 'error') ? (
        <ActionFlash tone={flash.flash} message={flash.message} />
      ) : null}

      <MemberProfileTabs member={detail} followups={followupRows} history={historyRows} milestones={milestones} />

      <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-[var(--pcm-text)]">{detail.name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {detail.member_code ?? 'No code'} · {detail.journey_status ?? 'No status'} ·{' '}
              {detail.current_stage_name ?? 'No stage'}
            </p>
          </div>
          <Link
            href="/members"
            className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-medium text-[var(--pcm-text)] hover:bg-teal-50"
          >
            Back to members
          </Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Last activity" value={formatDate(detail.last_activity_on) ?? 'No activity'} />
          <InfoCard label="Phone" value={detail.phone || detail.telephone || 'Not listed'} />
          <InfoCard label="Heartlink" value={detail.primary_heartlink ?? 'Not assigned'} />
          <InfoCard label="Risk level" value={detail.risk_level ?? 'Unspecified'} />
        </div>
        <div className="mt-5 rounded-2xl bg-teal-50/60 p-4 text-sm text-gray-600">
          <p>Email: {detail.email ?? 'Not listed'}</p>
          <p className="mt-1">Address: {detail.address ?? 'Not listed'}</p>
          <p className="mt-1">Entry date: {formatDate(detail.entry_date) ?? 'Unknown'}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Log follow-up</h3>
            <form action={submitFollowupLog} className="mt-5 space-y-4">
              <input type="hidden" name="memberId" value={id} />
              <input type="hidden" name="path" value={`/members/${id}`} />
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--pcm-text)]">Method</span>
                <select
                  name="method"
                  defaultValue="call"
                  className="w-full rounded-xl border border-teal-200 px-3 py-2 outline-none focus:border-teal-400"
                >
                  <option value="call">Call</option>
                  <option value="text">Text</option>
                  <option value="visit">Visit</option>
                  <option value="prayer">Prayer</option>
                  <option value="online">Online</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--pcm-text)]">Date</span>
                <input
                  type="date"
                  name="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-xl border border-teal-200 px-3 py-2 outline-none focus:border-teal-400"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--pcm-text)]">Notes</span>
                <textarea
                  name="notes"
                  rows={4}
                  className="w-full rounded-xl border border-teal-200 px-3 py-2 outline-none focus:border-teal-400"
                  placeholder="Short summary of contact, prayer points, or next step."
                />
              </label>
              <button className="rounded-xl bg-[var(--pcm-primary)] px-4 py-2 font-semibold text-white hover:bg-[var(--pcm-primary-light)]">
                Save follow-up
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Recent follow-ups</h3>
            <div className="mt-5 space-y-3">
              {followupRows.length === 0 ? (
                <EmptyState text="No follow-up logs yet for this member." />
              ) : (
                followupRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-teal-100 p-4">
                    <p className="font-medium capitalize text-[var(--pcm-text)]">
                      {row.method} · {new Date(row.date).toLocaleDateString()}
                    </p>
                    <p className="mt-2 text-sm text-gray-600">{row.notes || 'No notes recorded.'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Approval history</h3>
            <div className="mt-5 space-y-3">
              {approvalRows.length === 0 ? (
                <EmptyState text="No approval records for this member yet." />
              ) : (
                approvalRows.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-teal-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium capitalize text-[var(--pcm-text)]">
                          {request.request_type.replaceAll('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-500">{formatDate(request.created_at) ?? 'Unknown date'}</p>
                      </div>
                      <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold uppercase text-teal-700">
                        {request.status}
                      </span>
                    </div>
                    {request.status === 'pending' && (
                      <form action={submitApprovalDecision} className="mt-4 space-y-3">
                        <input type="hidden" name="approvalId" value={request.id} />
                        <input type="hidden" name="path" value={`/members/${id}`} />
                        <textarea
                          name="note"
                          rows={2}
                          className="w-full rounded-xl border border-teal-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                          placeholder="Optional decision note"
                        />
                        <div className="flex gap-2">
                          <button
                            name="decision"
                            value="approved"
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            name="decision"
                            value="rejected"
                            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                          >
                            Reject
                          </button>
                        </div>
                      </form>
                    )}
                    {request.decision_note && <p className="mt-3 text-sm text-gray-600">{request.decision_note}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Journey status history</h3>
            <div className="mt-5 space-y-3">
              {historyRows.length === 0 ? (
                <EmptyState text="No member field history is visible yet." />
              ) : (
                historyRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-teal-100 p-4">
                    <p className="font-medium text-[var(--pcm-text)]">{row.field.replaceAll('_', ' ')}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {row.old_value ?? 'blank'} → {row.new_value ?? 'blank'}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{formatDate(row.changed_at) ?? 'Unknown date'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 font-medium text-[var(--pcm-text)]">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-teal-200 p-4 text-sm text-gray-500">{text}</div>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}
