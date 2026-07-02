import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoleCode } from '@jlycc/types';

export const SCANNER_ROLES: RoleCode[] = [
  'pcm_staff',
  'network_head',
  'ministry_head',
  'admin',
  'super_admin',
];

export async function getMyRoles(supabase: SupabaseClient): Promise<RoleCode[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('roles(code)')
    .eq('is_active', true);
  if (error || !data) return [];
  return data
    .map((r) => (r.roles as unknown as { code: RoleCode } | null)?.code)
    .filter((c): c is RoleCode => Boolean(c));
}

export function canScan(roles: RoleCode[]): boolean {
  return roles.some((r) => SCANNER_ROLES.includes(r));
}

export function isAdmin(roles: RoleCode[]): boolean {
  return roles.includes('admin') || roles.includes('super_admin');
}
