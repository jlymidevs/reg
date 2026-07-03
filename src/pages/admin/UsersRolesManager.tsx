import { useEffect, useState } from 'react';
import { UserPlus, Shield, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { getAdminUsers, addAdminUser, updateAdminUserRole, removeAdminUser, ADMIN_ROLES } from '../../lib/api';
import type { AdminUser, AdminRole } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  event_manager: 'Event Manager',
  checkin_staff: 'Check-in Staff',
  finance: 'Finance',
  viewer: 'Viewer',
  volunteer: 'Volunteer',
};

export default function UsersRolesManager() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('viewer');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      setAdmins(await getAdminUsers());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      await addAdminUser(newEmail, newRole);
      await fetchAdmins();
      setIsModalOpen(false);
      setNewEmail('');
      setNewRole('viewer');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add user. They may already have access, or you may not have super admin rights.');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (id: string, role: AdminRole) => {
    try {
      await updateAdminUserRole(id, role);
      await fetchAdmins();
    } catch (err) {
      console.error(err);
      alert('Failed to update role. Only super admins can change roles.');
    }
  };

  const handleRemove = async (admin: AdminUser) => {
    if (!confirm(`Remove admin access for ${admin.email}?`)) return;
    try {
      await removeAdminUser(admin.id);
      await fetchAdmins();
    } catch (err) {
      console.error(err);
      alert('Failed to remove user. Only super admins can remove access.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text mb-1">Users &amp; Roles</h2>
          <p className="text-sm text-text-muted">Grant staff access by email — no code or SQL needed.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary rounded-xl px-5 shadow-md shadow-primary/20 whitespace-nowrap">
          <UserPlus size={18} className="mr-2" /> Add User
        </button>
      </div>

      <div className="card shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted">Loading users...</div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center">
            <Shield size={48} className="mx-auto text-text-muted mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-text mb-2">No admin users yet</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background/80 border-b border-border text-xs text-text-muted uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Added</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-text">{admin.email}</div>
                      {admin.email === user?.email && <span className="text-[10px] text-primary font-semibold uppercase">You</span>}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className="text-xs font-medium border border-border/50 rounded-lg px-2 py-1.5 bg-background/50 hover:bg-white focus:outline-none focus:border-primary cursor-pointer transition-colors"
                        value={admin.role}
                        onChange={(e) => handleRoleChange(admin.id, e.target.value as AdminRole)}
                      >
                        {ADMIN_ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted">
                      {admin.created_at ? format(new Date(admin.created_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemove(admin)}
                        className="p-2 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                        title="Remove access"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h3 className="text-xl font-bold text-primary">Add User</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-error transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-5">
              {errorMsg && (
                <div className="p-4 bg-error/10 border border-error/20 text-error rounded-md text-sm">{errorMsg}</div>
              )}
              <div className="form-group mb-0">
                <label className="label" htmlFor="new-email">Email *</label>
                <input
                  id="new-email"
                  type="email"
                  required
                  className="input"
                  placeholder="staff@jlycc.org"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <p className="text-xs text-muted mt-1">They sign in with Google using this email — no separate password setup.</p>
              </div>
              <div className="form-group mb-0">
                <label className="label" htmlFor="new-role">Role *</label>
                <select id="new-role" className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as AdminRole)}>
                  {ADMIN_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={saving}>
                {saving ? 'Adding...' : 'Add User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
