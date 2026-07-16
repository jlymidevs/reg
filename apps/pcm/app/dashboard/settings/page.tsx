import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requirePcmAccess } from '../../lib/access';
import { saveDashboardPreferences } from '../../lib/settings-actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const supabase = await createClient();
  const { user } = await requirePcmAccess(supabase);
  const { data, error } = await supabase.from('dashboard_preferences').select('preferences,updated_at').eq('user_id', user.id).maybeSingle();
  const preferences = (data?.preferences ?? {}) as Record<string, unknown>;
  const params = await searchParams;
  return <section className="space-y-6"><PageHeader title="Dashboard Settings" subtitle="Your saved portal display preferences." /><LegacyCard><h2 className="font-serif text-xl text-[#147f84]">Personal preferences</h2>{params.message ? <p className="mt-4 rounded-xl border border-[#8bcfc7] bg-[#eef9f7] px-4 py-3 text-sm text-[#16858a]">{decodeURIComponent(params.message)}</p> : null}{error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Preferences could not be loaded.</p> : <><p className="mt-3 text-sm text-slate-600">Preferences are private to your account and never change access permissions.</p><form action={saveDashboardPreferences} className="mt-5 space-y-4"><label className="flex items-center gap-3 text-sm font-semibold text-slate-700"><input name="showCompletedTasks" type="checkbox" defaultChecked={preferences.showCompletedTasks === true} className="h-4 w-4 accent-[#299496]" />Show completed tasks in task lists</label><button type="submit" className="rounded-xl bg-[#299496] px-4 py-2 text-sm font-semibold text-white">Save preferences</button></form><p className="mt-5 text-xs text-slate-400">{data?.updated_at ? `Last updated ${new Date(data.updated_at).toLocaleString()}` : 'No preferences have been saved yet.'}</p></>}</LegacyCard></section>;
}
