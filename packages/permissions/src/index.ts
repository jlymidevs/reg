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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', user.id)
    .eq('is_active', true);
  const roles = (error || !data ? [] : data)
    .map((r) => (r.roles as unknown as { code: RoleCode } | null)?.code)
    .filter((c): c is RoleCode => Boolean(c));

  if (roles.length > 0) return roles;

  // Keep authorization working when nested table reads are blocked by RLS.
  const fallbackCodes: RoleCode[] = [
    'member',
    'network_head',
    'ministry_head',
    'pcm_staff',
    'admin',
    'super_admin',
  ];
  const fallback = await Promise.all(
    fallbackCodes.map(async (role_code) => {
      const { data: allowed, error: rpcError } = await supabase.rpc('has_role', { role_code });
      return !rpcError && allowed === true ? role_code : null;
    })
  );

  return fallback.filter((role): role is RoleCode => Boolean(role));
}

export function canScan(roles: RoleCode[]): boolean {
  return roles.some((r) => SCANNER_ROLES.includes(r));
}

export function isAdmin(roles: RoleCode[]): boolean {
  return roles.includes('admin') || roles.includes('super_admin');
}
