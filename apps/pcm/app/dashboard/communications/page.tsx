import Link from 'next/link';
import { createClient } from '@jlycc/supabase/server';
import { ActionFlash } from '../../components/action-flash';
import { requirePcmAccess } from '../../lib/access';
import { submitAnnouncement, submitArchiveAnnouncement } from '../../lib/announcement-actions';
import { LegacyCard, PageHeader } from '../shared';

const PAGE_SIZE = 20;
const INPUT_CLASS = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal text-slate-800';

type CommunicationsPageProps = {
  searchParams: Promise<{ flash?: string; message?: string; page?: string; q?: string }>;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: 'church' | 'network' | 'ministry' | 'role';
  target_role_code: string | null;
  published_at: string | null;
  created_at: string;
  networks: { name: string | null } | null;
  ministries: { name: string | null } | null;
};

type TargetOption = {
  audience: 'network' | 'ministry';
  id: string;
  name: string;
};

export const dynamic = 'force-dynamic';

export default async function CommunicationsPage({ searchParams }: CommunicationsPageProps) {
  const params = await searchParams;
  const search = params.q?.trim().slice(0, 100) ?? '';
  const page = pageNumber(params.page);
  const from = (page - 1) * PAGE_SIZE;
  const supabase = await createClient();
  const { roles } = await requirePcmAccess(supabase);
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const canAnnounce = isAdmin || roles.includes('network_head') || roles.includes('ministry_head');
  const canTargetNetwork = isAdmin || roles.includes('network_head');
  const canTargetMinistry = canTargetNetwork || roles.includes('ministry_head');

  const { data: targetData, error: targetsError } = await supabase.rpc('pcm_scoped_announcement_targets');
  const targets = (targetData ?? []) as TargetOption[];
  const networkTargets = targets.filter((target) => target.audience === 'network');
  const ministryTargets = targets.filter((target) => target.audience === 'ministry');

  let announcementsQuery = supabase
    .from('announcements')
    .select('id,title,body,audience,target_role_code,published_at,created_at,networks(name),ministries(name)')
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (search) announcementsQuery = announcementsQuery.ilike('title', `%${search}%`);

  const { data: announcementData, error: announcementsError } = await announcementsQuery.range(from, from + PAGE_SIZE);
  // PostgREST's generated relation type is an array, while these embeds are nullable objects.
  const announcementRows = (announcementData ?? []) as unknown as Announcement[];
  const announcements = announcementRows.slice(0, PAGE_SIZE);
  const hasNextPage = announcementRows.length > PAGE_SIZE;
  const flashTone = params.flash === 'success' || params.flash === 'error' ? params.flash : null;

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Communications"
        subtitle="Publish scoped updates that members can see through the announcements channel."
        action={<Link href="/dashboard" className="text-sm font-semibold text-[#16858a] hover:underline">Back to dashboard</Link>}
      />

      {flashTone && params.message ? <ActionFlash tone={flashTone} message={params.message} /> : null}

      {canAnnounce ? (
        <LegacyCard>
          <h2 className="font-serif text-xl text-[#147f84]">Create announcement</h2>
          <p className="mt-1 text-sm text-slate-500">Your role and target scope are checked again when this form is submitted.</p>
          {targetsError ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Available targets could not be loaded. Church-wide announcements remain available only to administrators.</p> : null}
          <form action={submitAnnouncement} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Audience
                <select name="audience" required className={INPUT_CLASS} defaultValue="">
                  <option value="" disabled>Select an audience</option>
                  {isAdmin ? <option value="church">Entire church</option> : null}
                  {canTargetNetwork ? <option value="network">A network</option> : null}
                  {canTargetMinistry ? <option value="ministry">A ministry</option> : null}
                  {isAdmin ? <option value="role">A role</option> : null}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Network or ministry target
                <select name="targetId" className={INPUT_CLASS} defaultValue="">
                  <option value="">Select when targeting a network or ministry</option>
                  {networkTargets.length > 0 ? <optgroup label="Networks">{networkTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</optgroup> : null}
                  {ministryTargets.length > 0 ? <optgroup label="Ministries">{ministryTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</optgroup> : null}
                </select>
              </label>
              {isAdmin ? <label className="text-sm font-semibold text-slate-700 md:col-span-2">Role target<select name="targetRoleCode" className={INPUT_CLASS} defaultValue=""><option value="">Select when targeting a role</option><option value="pcm_staff">PCM staff</option><option value="network_head">Network heads</option><option value="ministry_head">Ministry heads</option><option value="admin">Administrators</option><option value="super_admin">Super administrators</option></select></label> : null}
            </div>
            <label className="block text-sm font-semibold text-slate-700">Title<input name="title" required className={INPUT_CLASS} placeholder="Announcement title" /></label>
            <label className="block text-sm font-semibold text-slate-700">Message<textarea name="body" required rows={6} className={INPUT_CLASS} placeholder="Write the announcement" /></label>
            <div className="flex flex-wrap justify-end gap-3"><button type="submit" name="mode" value="draft" className="rounded-xl border border-[#299496] px-4 py-2 text-sm font-semibold text-[#16858a] hover:bg-teal-50">Save draft</button><button type="submit" name="mode" value="publish" className="rounded-xl bg-[#299496] px-4 py-2 text-sm font-semibold text-white hover:bg-[#147f84]">Publish announcement</button></div>
          </form>
        </LegacyCard>
      ) : null}

      <LegacyCard>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="font-serif text-xl text-[#147f84]">Active announcements</h2><p className="mt-1 text-sm text-slate-500">Announcements available to your current role and scope.</p></div>
          <form method="get" className="flex items-end gap-3" aria-label="Search announcements"><label className="text-sm font-semibold text-slate-700">Search title<input name="q" defaultValue={search} className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal" /></label><button type="submit" className="rounded-lg bg-[#299496] px-3 py-2 text-sm font-semibold text-white hover:bg-[#147f84]">Search</button></form>
        </div>

        <div className="mt-5 space-y-3">
          {announcementsError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Announcements could not be loaded. Please refresh and try again.</p> : announcements.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No active announcements match your search.</p> : announcements.map((announcement) => <article key={announcement.id} className="rounded-xl border border-slate-200 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-serif text-lg text-[#147f84]">{announcement.title}</h3><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#16858a]">{audienceLabel(announcement)}</p></div><time dateTime={announcement.published_at ?? announcement.created_at} className="text-sm text-slate-500">{new Date(announcement.published_at ?? announcement.created_at).toLocaleDateString()}</time></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{announcement.body}</p>{canAnnounce ? <form action={submitArchiveAnnouncement} className="mt-4"><input type="hidden" name="announcementId" value={announcement.id} /><button type="submit" className="text-sm font-semibold text-rose-700 hover:underline">Archive if you manage this announcement</button></form> : null}</article>)}
        </div>

        {!announcementsError ? <nav aria-label="Announcement pages" className="mt-5 flex items-center justify-between gap-3 text-sm"><span>{page > 1 ? <Link href={communicationsHref(search, page - 1)} className="rounded-lg border border-teal-100 px-3 py-2 font-medium text-[#16858a] hover:bg-teal-50">Previous</Link> : null}</span><span className="text-slate-500">Page {page}</span><span>{hasNextPage ? <Link href={communicationsHref(search, page + 1)} className="rounded-lg border border-teal-100 px-3 py-2 font-medium text-[#16858a] hover:bg-teal-50">Next</Link> : null}</span></nav> : null}
      </LegacyCard>
    </section>
  );
}

function audienceLabel(announcement: Announcement) {
  if (announcement.audience === 'network') return `Network: ${announcement.networks?.name ?? 'Unavailable'}`;
  if (announcement.audience === 'ministry') return `Ministry: ${announcement.ministries?.name ?? 'Unavailable'}`;
  if (announcement.audience === 'role') return `Role: ${announcement.target_role_code ?? 'Unavailable'}`;
  return 'Entire church';
}

function pageNumber(value?: string) {
  const page = Number(value ?? '1');
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function communicationsHref(search: string, page: number) {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/dashboard/communications?${query}` : '/dashboard/communications';
}
