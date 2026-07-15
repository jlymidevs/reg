import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getMyRoles } from '@jlycc/permissions';
import type { RoleCode } from '@jlycc/types';

export const PCM_ALLOWED_ROLES: RoleCode[] = [
  'pcm_staff',
  'network_head',
  'ministry_head',
  'admin',
  'super_admin',
];

export async function requirePcmAccess(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const roles = await getMyRoles(supabase);
  const allowed = roles.some((role) => PCM_ALLOWED_ROLES.includes(role));

  if (!allowed) redirect('/forbidden');

  return { user, roles };
}

export async function requireAdminAccess(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const roles = await getMyRoles(supabase);
  const allowed = roles.some((role) => role === 'admin' || role === 'super_admin');

  if (!allowed) throw new Error("Admin access is required");

  return { user, roles };
}
