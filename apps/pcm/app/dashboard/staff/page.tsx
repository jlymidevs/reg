import { createAdminClient } from '@jlycc/supabase/admin';
import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requirePcmAccess } from '../../lib/access';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const supabase = await createClient();
  const { roles } = await requirePcmAccess(supabase);
  if (!roles.includes('admin') && !roles.includes('super_admin')) return null;
  const admin = createAdminClient();
  const [{ data: users }, { data: grants }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('user_roles').select('user_id,is_active,roles(code)').order('granted_at', { ascending: false }),
  ]);
  const rows = (users?.users ?? []).map((user) => {
    const grant = (grants ?? []).find((item) => item.user_id === user.id) as { roles?: { code?: string } | null; is_active?: boolean } | undefined;
    return { id: user.id, name: (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? 'User', email: user.email ?? 'No email', role: grant?.roles?.code?.replaceAll('_', ' ') ?? 'member', active: grant?.is_active !== false };
  });
  return <section className="space-y-6"><PageHeader title="Staff & Roles" subtitle="Manage team members and their access levels." action={<button className="rounded-xl bg-[#299496] px-4 py-2 text-sm font-semibold text-white">＋ Invite Staff</button>} /><LegacyCard><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-[11px] font-bold uppercase tracking-wide text-[#22a995]"><tr className="border-b border-slate-200"><th className="px-3 py-3">User</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-4"><p className="font-semibold text-slate-800">{row.name}</p><p className="text-xs text-[#22b8a4]">✉ {row.email}</p></td><td className="px-3 py-4"><span className="rounded-full bg-[#e4f3f2] px-3 py-1 text-[10px] font-bold uppercase text-[#16858a]">◉ {row.role}</span></td><td className="px-3 py-4"><span className="text-sm"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-500" />{row.active ? 'Active' : 'Inactive'}</span></td><td className="px-3 py-4 text-right text-[#20aaa0]">♧　▢</td></tr>)}</tbody></table>{rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No staff accounts found.</p> : null}</div></LegacyCard></section>;
}
