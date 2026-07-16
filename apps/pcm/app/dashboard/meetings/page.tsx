import Link from 'next/link';
import { createClient } from '@jlycc/supabase/server';
import { ActionFlash } from '../../components/action-flash';
import { requirePcmAccess } from '../../lib/access';
import { submitHeartlinkReport } from '../../lib/heartlink-actions';
import { LegacyCard, PageHeader } from '../shared';

const PAGE_SIZE = 25;
const INPUT_CLASS = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal text-slate-800';

type MeetingPageProps = {
  searchParams: Promise<{
    flash?: string;
    message?: string;
    page?: string;
    topic?: string;
    venue?: string;
    date?: string;
  }>;
};

type HeartlinkOption = {
  id: string;
  name: string;
  network_id: string | null;
  network_name: string | null;
};

type HeartlinkReport = {
  id: string;
  category: string;
  topic: string;
  venue: string;
  report_date: string;
  status: 'draft' | 'published';
  created_at: string;
  heartlinks: { name: string | null } | null;
};

export const dynamic = 'force-dynamic';

export default async function MeetingsPage({ searchParams }: MeetingPageProps) {
  const params = await searchParams;
  const topic = cleanSearch(params.topic);
  const venue = cleanSearch(params.venue);
  const date = isDate(params.date) ? params.date ?? '' : '';
  const page = pageNumber(params.page);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  await requirePcmAccess(supabase);

  const { data: heartlinkData, error: heartlinksError } = await supabase.rpc('pcm_scoped_heartlinks');
  const heartlinks = (heartlinkData ?? []) as HeartlinkOption[];

  let reportsQuery = supabase
    .from('heartlink_reports')
    .select('id,category,topic,venue,report_date,status,created_at,heartlinks(name)')
    .order('report_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (topic) reportsQuery = reportsQuery.ilike('topic', `%${topic}%`);
  if (venue) reportsQuery = reportsQuery.ilike('venue', `%${venue}%`);
  if (date) reportsQuery = reportsQuery.eq('report_date', date);

  const { data: reportData, error: reportsError } = await reportsQuery.range(from, from + PAGE_SIZE);
  // PostgREST's generated relation type is an array, while this embed is a nullable object.
  const reportRows = (reportData ?? []) as unknown as HeartlinkReport[];
  const reports = reportRows.slice(0, PAGE_SIZE);
  const hasNextPage = reportRows.length > PAGE_SIZE;
  const flashTone = params.flash === 'success' || params.flash === 'error' ? params.flash : null;
  const formUnavailable = Boolean(heartlinksError) || heartlinks.length === 0;

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="HeartLink Reports"
        subtitle="Record meeting details and attendees for HeartLinks in your current scope."
        action={<Link href="/dashboard" className="text-sm font-semibold text-[#16858a] hover:underline">Back to dashboard</Link>}
      />

      {flashTone && params.message ? <ActionFlash tone={flashTone} message={params.message} /> : null}

      <LegacyCard>
        <h2 className="font-serif text-xl text-[#147f84]">Encode HeartLink report</h2>
        <p className="mt-1 text-sm text-slate-500">Required fields are marked by the browser before the report is sent for server-side validation.</p>
        {heartlinksError ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">HeartLinks could not be loaded. Please refresh and try again.</p> : null}
        {!heartlinksError && heartlinks.length === 0 ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">No HeartLinks are available in your current role scope.</p> : null}

        <form action={submitHeartlinkReport} className="mt-5">
          <fieldset disabled={formUnavailable} className="space-y-6 disabled:opacity-60">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                HeartLink
                <select name="heartlinkId" required className={INPUT_CLASS} defaultValue="">
                  <option value="" disabled>Select a HeartLink</option>
                  {heartlinks.map((heartlink) => <option key={heartlink.id} value={heartlink.id}>{heartlink.name}{heartlink.network_name ? ` (${heartlink.network_name})` : ''}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Category
                <select name="category" required className={INPUT_CLASS} defaultValue="">
                  <option value="" disabled>Select a category</option>
                  <option value="weekly">Weekly gathering</option>
                  <option value="prayer">Prayer meeting</option>
                  <option value="discipleship">Discipleship</option>
                  <option value="outreach">Outreach</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Topic
                <input name="topic" required className={INPUT_CLASS} placeholder="e.g., Red Book Chapter 1" />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Venue
                <input name="venue" required className={INPUT_CLASS} placeholder="Meeting location" />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Meeting date
                <input name="reportDate" type="date" required className={INPUT_CLASS} />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-sm font-semibold text-slate-700">
                  Started at
                  <input name="startedAt" type="time" className={INPUT_CLASS} />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Ended at
                  <input name="endedAt" type="time" className={INPUT_CLASS} />
                </label>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-serif text-xl text-[#147f84]">Leadership and notes</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Area pastor
                  <input name="pastor" className={INPUT_CLASS} placeholder="Optional" />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Coordinator
                  <input name="coordinator" className={INPUT_CLASS} placeholder="Optional" />
                </label>
              </div>
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Notes, testimonies, and recommendations
                <textarea name="notes" rows={5} className={INPUT_CLASS} placeholder="Optional notes for this report" />
              </label>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-serif text-xl text-[#147f84]">Attendees</h3>
              <p className="mt-1 text-sm text-slate-500">Enter one name per line. These are saved with the report.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <AttendeeField name="regularAttendees" label="Regular attendees" />
                <AttendeeField name="firstTimeAttendees" label="First-time attendees" />
                <AttendeeField name="childAttendees" label="Children" />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Link href="/dashboard" className="rounded-xl border border-[#299496] px-4 py-2 text-sm font-semibold text-[#16858a] hover:bg-teal-50">Cancel</Link>
              <button type="submit" name="mode" value="draft" className="rounded-xl border border-[#299496] px-4 py-2 text-sm font-semibold text-[#16858a] hover:bg-teal-50">Save draft</button>
              <button type="submit" name="mode" value="publish" className="rounded-xl bg-[#299496] px-4 py-2 text-sm font-semibold text-white hover:bg-[#147f84]">Publish report</button>
            </div>
          </fieldset>
        </form>
      </LegacyCard>

      <LegacyCard>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl text-[#147f84]">Saved reports</h2>
            <p className="mt-1 text-sm text-slate-500">Reports visible within your current HeartLink scope.</p>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Search HeartLink reports">
            <label className="text-sm font-semibold text-slate-700">Topic<input name="topic" defaultValue={topic} className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">Venue<input name="venue" defaultValue={venue} className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">Date<input name="date" type="date" defaultValue={date} className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal" /></label>
            <button type="submit" className="rounded-lg bg-[#299496] px-3 py-2 text-sm font-semibold text-white hover:bg-[#147f84]">Search</button>
          </form>
        </div>

        <div className="mt-5 overflow-x-auto">
          {reportsError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Reports could not be loaded. Please refresh and try again.</p> : reports.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No saved reports match these filters.</p> : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500"><tr><th className="px-3 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">HeartLink</th><th className="px-3 py-3 font-medium">Topic</th><th className="px-3 py-3 font-medium">Venue</th><th className="px-3 py-3 font-medium">Status</th></tr></thead>
              <tbody>{reports.map((report) => <tr key={report.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 text-slate-600">{report.report_date}</td><td className="px-3 py-3 font-medium text-slate-800">{report.heartlinks?.name ?? 'HeartLink unavailable'}</td><td className="px-3 py-3 text-slate-700">{report.topic}</td><td className="px-3 py-3 text-slate-600">{report.venue}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${report.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{report.status}</span></td></tr>)}</tbody>
            </table>
          )}
        </div>

        {!reportsError ? <nav aria-label="HeartLink report pages" className="mt-5 flex items-center justify-between gap-3 text-sm"><span>{page > 1 ? <Link href={reportHref(topic, venue, date, page - 1)} className="rounded-lg border border-teal-100 px-3 py-2 font-medium text-[#16858a] hover:bg-teal-50">Previous</Link> : null}</span><span className="text-slate-500">Page {page}</span><span>{hasNextPage ? <Link href={reportHref(topic, venue, date, page + 1)} className="rounded-lg border border-teal-100 px-3 py-2 font-medium text-[#16858a] hover:bg-teal-50">Next</Link> : null}</span></nav> : null}
      </LegacyCard>
    </section>
  );
}

function AttendeeField({ name, label }: { name: string; label: string }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<textarea name={name} rows={5} className={INPUT_CLASS} placeholder="One name per line" /></label>;
}

function cleanSearch(value?: string) {
  return value?.trim().slice(0, 100) ?? '';
}

function isDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function pageNumber(value?: string) {
  const page = Number(value ?? '1');
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function reportHref(topic: string, venue: string, date: string, page: number) {
  const params = new URLSearchParams();
  if (topic) params.set('topic', topic);
  if (venue) params.set('venue', venue);
  if (date) params.set('date', date);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/dashboard/meetings?${query}` : '/dashboard/meetings';
}
