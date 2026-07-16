import { createAdminClient } from '@jlycc/supabase/admin';
import { createClient } from '@jlycc/supabase/server';
import { PageHeader, LegacyCard } from '../shared';
import { requireAdminAccess } from '../../lib/access';
import { submitGrantStaffAccess, submitRemoveStaffAccess } from '../../lib/admin-actions';

export const dynamic = 'force-dynamic';

type RoleGrant = { user_id: string; is_active: boolean; roles?: { code?: string } | null };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; message?: string }>;
}) {
  const supabase = await createClient();
  await requireAdminAccess(supabase);
  const admin = createAdminClient();
  const [{ data: users }, { data: grants }, flash] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('user_roles').select('user_id,is_active,roles(code)').order('granted_at', { ascending: false }),
    searchParams,
  ]);
  const roleGrants = (grants ?? []) as RoleGrant[];
  const rows = (users?.users ?? []).map((user) => {
    const grant = roleGrants.find((item) => item.user_id === user.id && item.is_active) ?? roleGrants.find((item) => item.user_id === user.id);
    return {
      id: user.id,
      name: (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? 'User',
      email: user.email ?? 'No email',
      role: grant?.roles?.code ?? 'member',
      active: grant?.is_active === true,
    };
  });
  const message = flash.message ? decodeURIComponent(flash.message) : null;

  return (
    <section className="space-y-6">
      <PageHeader title="Staff & Roles" subtitle="Manage team members and their access levels." />
      {message ? <p className={`rounded-xl border px-4 py-3 text-sm ${flash.flash === 'success' ? 'border-[#8bcfc7] bg-[#eef9f7] text-[#16858a]' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{message}</p> : null}
      <LegacyCard>
        <h2 className="font-serif text-xl text-[#147f84]">Grant Staff Access</h2>
        <p className="mt-1 text-sm text-slate-500">Assign a portal role to an existing authenticated account. Network and ministry heads require the relevant scope ID.</p>
        <form action={submitGrantStaffAccess} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">Account<select name="userId" required className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal"><option value="">Select account...</option>{rows.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.email})</option>)}</select></label>
          <label className="text-sm font-semibold">Role<select name="role" required className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal"><option value="">Select role...</option><option value="pcm_staff">PCM Staff</option><option value="network_head">Network Head</option><option value="ministry_head">Ministry Head</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></label>
          <label className="text-sm font-semibold">Staff display name (optional)<input name="name" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal" placeholder="Shown in PCM assignments" /></label>
          <label className="text-sm font-semibold">Network scope ID (for Network Head)<input name="networkId" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal" placeholder="UUID" /></label>
          <label className="text-sm font-semibold">Ministry scope ID (for Ministry Head)<input name="ministryId" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal" placeholder="UUID" /></label>
          <div className="flex items-end"><button type="submit" className="w-full rounded-xl bg-[#299496] px-4 py-3 text-sm font-semibold text-white">Grant Access</button></div>
        </form>
      </LegacyCard>
      <LegacyCard>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] font-bold uppercase tracking-wide text-[#22a995]"><tr className="border-b border-slate-200"><th className="px-3 py-3">User</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-4"><p className="font-semibold text-slate-800">{row.name}</p><p className="text-xs text-[#22b8a4]">{row.email}</p></td><td className="px-3 py-4"><span className="rounded-full bg-[#e4f3f2] px-3 py-1 text-[10px] font-bold uppercase text-[#16858a]">{row.role.replaceAll('_', ' ')}</span></td><td className="px-3 py-4"><span className="text-sm"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${row.active ? 'bg-green-500' : 'bg-slate-300'}`} />{row.active ? 'Active' : 'No staff role'}</span></td><td className="px-3 py-4 text-right">{row.active ? <form action={submitRemoveStaffAccess} className="inline"><input type="hidden" name="userId" value={row.id} /><input type="hidden" name="role" value={row.role} /><button type="submit" className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Remove role</button></form> : null}</td></tr>)}</tbody>
          </table>
          {!rows.length ? <p className="py-8 text-center text-sm text-slate-400">No authenticated accounts found.</p> : null}
        </div>
      </LegacyCard>
    </section>
  );
}
