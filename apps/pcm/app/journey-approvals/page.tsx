import { createClient } from '@jlycc/supabase/server';
import { ActionFlash } from '../components/action-flash';
import { Topbar } from '../components/topbar';
import { requirePcmAccess } from '../lib/access';
import { submitApprovalDecision } from '../lib/ops-actions';
import { normalizeApprovalRequests, type ApprovalRequestQueryRow } from '../lib/pcm-data';

export const dynamic = 'force-dynamic';

export default async function JourneyApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; message?: string }>;
}) {
  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const flash = await searchParams;
  const { data } = await supabase
    .from('approval_requests')
    .select('id,request_type,status,created_at,decision_note,payload,members(name,member_code,journey_status)')
    .order('created_at', { ascending: false })
    .limit(50);

  const requests = normalizeApprovalRequests((data ?? []) as ApprovalRequestQueryRow[]);
  return (
    <section className="space-y-6">
      <Topbar title="Journey Approvals" />
      {flash.message && (flash.flash === 'success' || flash.flash === 'error') ? (
        <ActionFlash tone={flash.flash} message={flash.message} />
      ) : null}
      <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Approval queue</h2>
        <p className="mt-2 text-sm text-gray-500">Recent approval requests visible to your current role scope.</p>
        <div className="mt-5 space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="rounded-2xl border border-teal-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold capitalize text-[var(--pcm-text)]">
                    {request.request_type.replaceAll('_', ' ')}
                  </p>
                  <p className="text-sm text-gray-500">
                    {request.members?.name ?? 'No member linked'} · {request.members?.member_code ?? 'No code'}
                  </p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase text-sky-700">
                  {request.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Created {new Date(request.created_at).toLocaleDateString()}.
              </p>
              {request.status === 'pending' && (
                <form action={submitApprovalDecision} className="mt-4 space-y-3">
                  <input type="hidden" name="approvalId" value={request.id} />
                  <input type="hidden" name="path" value="/journey-approvals" />
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
