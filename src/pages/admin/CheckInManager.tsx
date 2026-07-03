import { useEffect, useMemo, useState } from 'react';
import { Search, UserCheck, RotateCcw, Phone } from 'lucide-react';
import { getAllEvents, getRegistrationsForEvent, checkInRegistration, undoCheckIn } from '../../lib/api';
import type { Event, RegistrationWithRelations } from '../../lib/api';

export default function CheckInManager() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [registrations, setRegistrations] = useState<RegistrationWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    getAllEvents().then((data) => {
      setEvents(data);
      // Default to the most recently-starting event — usually today's.
      if (data.length > 0) setSelectedEventId(data[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    setLoading(true);
    getRegistrationsForEvent(selectedEventId)
      .then(setRegistrations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedEventId]);

  const refresh = () => {
    if (!selectedEventId) return;
    getRegistrationsForEvent(selectedEventId).then(setRegistrations).catch(console.error);
  };

  const handleCheckIn = async (registrationId: string) => {
    setBusyId(registrationId);
    try {
      const result = await checkInRegistration(registrationId, 'manual');
      setToast(`Checked in: ${result.member_name}`);
      setTimeout(() => setToast(''), 3000);
      refresh();
    } catch (err: any) {
      alert(err.message || 'Check-in failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUndo = async (registrationId: string) => {
    if (!confirm('Undo this check-in?')) return;
    setBusyId(registrationId);
    try {
      await undoCheckIn(registrationId);
      refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to undo check-in.');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return registrations.filter((r) => {
      if (r.status === 'cancelled') return false;
      const name = `${r.members?.first_name ?? ''} ${r.members?.surname ?? ''}`.toLowerCase();
      const phone = (r.members?.phone ?? '').toLowerCase();
      return name.includes(term) || phone.includes(term);
    });
  }, [registrations, searchTerm]);

  const checkedInCount = registrations.filter((r) => r.status === 'attended').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text mb-1">Check-in</h2>
        <p className="text-sm text-text-muted">Search by name or phone, tap to check in.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-white p-4 rounded-2xl shadow-card border border-border">
        <select
          className="input bg-background/50 border-border/50 text-sm rounded-xl cursor-pointer hover:bg-white w-full md:w-auto"
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
        >
          <option value="">Select an event</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        {selectedEventId && (
          <span className="text-sm font-bold text-primary bg-secondary px-3 py-1.5 rounded-full whitespace-nowrap">
            {checkedInCount} / {registrations.length} checked in
          </span>
        )}
      </div>

      {selectedEventId && (
        <>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={22} />
            <input
              autoFocus
              type="text"
              placeholder="Type a name or phone number..."
              className="input pl-12 text-lg py-4 rounded-2xl shadow-card"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {toast && (
            <div className="p-4 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] rounded-xl text-sm font-bold flex items-center gap-2">
              <UserCheck size={18} /> {toast}
            </div>
          )}

          <div className="card shadow-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-text-muted text-sm">Loading attendees...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-sm">
                {searchTerm ? 'No matching attendees.' : 'No registrations for this event yet.'}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filtered.map((reg) => {
                  const isCheckedIn = reg.status === 'attended';
                  return (
                    <div key={reg.id} className="p-5 flex items-center justify-between gap-4 hover:bg-background/50 transition-colors">
                      <div className="min-w-0">
                        <div className="font-bold text-text">{reg.members?.first_name} {reg.members?.surname}</div>
                        {reg.members?.phone && (
                          <div className="text-sm text-text-muted flex items-center gap-1 mt-0.5">
                            <Phone size={12} /> {reg.members.phone}
                          </div>
                        )}
                      </div>
                      {isCheckedIn ? (
                        <button
                          onClick={() => handleUndo(reg.id)}
                          disabled={busyId === reg.id}
                          className="btn btn-secondary text-sm px-4 py-3 rounded-xl flex items-center gap-2 whitespace-nowrap"
                        >
                          <RotateCcw size={16} /> Checked in — undo
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCheckIn(reg.id)}
                          disabled={busyId === reg.id}
                          className="btn btn-primary text-sm px-5 py-3 rounded-xl flex items-center gap-2 whitespace-nowrap"
                        >
                          <UserCheck size={16} /> {busyId === reg.id ? 'Checking in...' : 'Check In'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
