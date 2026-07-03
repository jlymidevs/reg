import { useEffect, useState } from 'react';
import { getAllRegistrations, updateRegistrationStatus } from '../../lib/api';
import type { RegistrationWithRelations } from '../../lib/api';
import { Search, Filter, Phone, Calendar, User, MapPin } from 'lucide-react';
import { format } from 'date-fns';

export default function RegistrationsManager() {
  const [registrations, setRegistrations] = useState<RegistrationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const data = await getAllRegistrations();
      setRegistrations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: 'registered' | 'cancelled' | 'attended') => {
    setUpdating(id);
    try {
      await updateRegistrationStatus(id, status);
      await fetchRegistrations();
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const filteredRegistrations = registrations.filter(reg => {
    const matchesFilter = filter === 'all' || reg.status === filter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (reg.members?.first_name || '').toLowerCase().includes(searchLower) ||
      (reg.members?.surname || '').toLowerCase().includes(searchLower) ||
      (reg.members?.phone || '').toLowerCase().includes(searchLower) ||
      (reg.events?.title || '').toLowerCase().includes(searchLower);
      
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary mb-2">Registrations</h2>
        <p className="text-muted">View and manage attendees across all your events.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-border">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email, or event..." 
            className="input pl-10 bg-gray-50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-muted" />
          <select 
            className="input bg-gray-50 cursor-pointer"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="registered">Registered</option>
            <option value="attended">Attended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted">Loading registrations...</div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="p-12 text-center">
            <User size={48} className="mx-auto text-muted mb-4 opacity-50" />
            <h3 className="text-xl font-medium text-text mb-2">No registrations found</h3>
            <p className="text-muted mb-6">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-border text-sm text-muted">
                  <th className="px-6 py-4 font-medium">Attendee</th>
                  <th className="px-6 py-4 font-medium">Event Details</th>
                  <th className="px-6 py-4 font-medium">Date Registered</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRegistrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-text">{reg.members?.first_name} {reg.members?.surname}</div>
                      <div className="flex flex-col gap-1 mt-1">
                        {reg.members?.address && (
                          <div className="text-xs text-muted flex items-center gap-1">
                            <MapPin size={12} /> {reg.members.address}
                          </div>
                        )}
                        {reg.members?.phone && (
                          <a href={`tel:${reg.members.phone}`} className="text-xs text-secondary hover:underline flex items-center gap-1">
                            <Phone size={12} /> {reg.members.phone}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-primary text-sm">{reg.events?.title}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {format(new Date(reg.registered_at), 'MMM d, yyyy h:mm a')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${
                        reg.status === 'registered' ? 'badge-primary' : 
                        reg.status === 'attended' ? 'badge-success' : 'badge-neutral'
                      }`}>
                        {reg.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {updating === reg.id ? (
                        <span className="text-xs text-muted">Updating...</span>
                      ) : (
                        <select 
                          className="text-sm border border-border rounded-md px-2 py-1 bg-white focus:outline-none focus:border-secondary cursor-pointer"
                          value={reg.status}
                          onChange={(e) => handleStatusChange(reg.id, e.target.value as 'registered' | 'cancelled' | 'attended')}
                        >
                          <option value="registered">Registered</option>
                          <option value="attended">Attended</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
