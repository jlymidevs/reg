import Link from 'next/link';
import { createClient } from '@jlycc/supabase/server';
import { Topbar } from '../../components/topbar';
import { requirePcmAccess } from '../../lib/access';

const PAGE_SIZE = 25;

type AttendancePageProps = {
  searchParams: Promise<{ page?: string }>;
};

type AttendanceRow = {
  id: string;
  checked_in_at: string;
  method: string;
  notes: string | null;
  members: { name: string | null; member_code: string | null } | null;
  events: { title: string | null } | null;
};

export const dynamic = 'force-dynamic';

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const { page: pageParam } = await searchParams;
  const candidatePage = Number(pageParam ?? '1');
  const page = Number.isSafeInteger(candidatePage) && candidatePage > 0 ? candidatePage : 1;
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  await requirePcmAccess(supabase);
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id,checked_in_at,method,notes,members(name,member_code),events(title)')
    .order('checked_in_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
    .overrideTypes<AttendanceRow[], { merge: false }>();

  const logs = data ?? [];
  const hasNextPage = logs.length === PAGE_SIZE;

  return (
    <section className="space-y-6">
      <Topbar title="Attendance" />
      <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl font-semibold text-[var(--pcm-text)]">Recent attendance</h2>
        <p className="mt-2 text-sm text-gray-500">Recent check-ins visible within your current member scope.</p>
        <div className="mt-5 overflow-x-auto">
          {error ? (
            <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Attendance records could not be loaded. Please refresh and try again.</p>
          ) : logs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-teal-100 p-6 text-center text-sm text-gray-500">No attendance check-ins are visible on this page.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="text-gray-500">
                <tr className="border-b border-teal-100">
                  <th className="px-3 py-3 font-medium">Checked in</th>
                  <th className="px-3 py-3 font-medium">Member</th>
                  <th className="px-3 py-3 font-medium">Event</th>
                  <th className="px-3 py-3 font-medium">Method</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-teal-50 last:border-b-0">
                    <td className="px-3 py-3 text-gray-600">{new Date(log.checked_in_at).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-[var(--pcm-text)]">{log.members?.name ?? 'Member unavailable'}</p>
                      <p className="text-gray-500">{log.members?.member_code ?? 'No code'}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{log.events?.title ?? 'Event unavailable'}</td>
                    <td className="px-3 py-3 capitalize text-gray-600">{log.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!error ? (
          <nav aria-label="Attendance pages" className="mt-5 flex items-center justify-between gap-3 text-sm">
            {page > 1 ? <Link href={`/dashboard/attendance?page=${page - 1}`} className="rounded-lg border border-teal-100 px-3 py-2 font-medium text-[var(--pcm-text)] hover:bg-teal-50">Previous</Link> : <span />}
            <span className="text-gray-500">Page {page}</span>
            {hasNextPage ? <Link href={`/dashboard/attendance?page=${page + 1}`} className="rounded-lg border border-teal-100 px-3 py-2 font-medium text-[var(--pcm-text)] hover:bg-teal-50">Next</Link> : <span />}
          </nav>
        ) : null}
      </div>
    </section>
  );
}
