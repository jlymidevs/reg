import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requirePcmAccess } from '../../lib/access';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { user } = await requirePcmAccess(supabase);
  const { data, error } = await supabase.from('dashboard_preferences').select('preferences,updated_at').eq('user_id', user.id).maybeSingle();
  const preferences = (data?.preferences ?? {}) as Record<string, unknown>;
  return <section className="space-y-6"><PageHeader title="Dashboard Settings" subtitle="Your saved portal display preferences." /><LegacyCard><h2 className="font-serif text-xl text-[#147f84]">Personal preferences</h2>{error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Preferences could not be loaded.</p> : <><p className="mt-3 text-sm text-slate-600">Preferences are private to your account and never change access permissions.</p><pre className="mt-5 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-600">{JSON.stringify(preferences, null, 2)}</pre><p className="mt-3 text-xs text-slate-400">{data?.updated_at ? `Last updated ${new Date(data.updated_at).toLocaleString()}` : 'No preferences have been saved yet.'}</p></>}</LegacyCard></section>;
}
