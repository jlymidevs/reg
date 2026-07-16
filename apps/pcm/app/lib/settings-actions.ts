'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@jlycc/supabase/server';
import { requirePcmAccess } from './access';

export async function saveDashboardPreferences(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requirePcmAccess(supabase);
  const showCompletedTasks = formData.get('showCompletedTasks') === 'on';
  const { error } = await supabase.from('dashboard_preferences').upsert({
    user_id: user.id,
    preferences: { showCompletedTasks },
    updated_at: new Date().toISOString(),
  });
  redirect(`/dashboard/settings?message=${encodeURIComponent(error ? 'Preferences could not be saved.' : 'Preferences saved.')}`);
}
