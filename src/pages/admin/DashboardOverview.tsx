import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { getAllEvents, getAllRegistrations } from '../../lib/api';
import type { Event, RegistrationWithRelations } from '../../lib/api';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function DashboardOverview() {
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllEvents(), getAllRegistrations()])
      .then(([eventsData, registrationsData]) => {
        setEvents(eventsData);
        setRegistrations(registrationsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-muted">Loading overview data...</div>;
  }

  const activeEventsCount = events.filter(e => e.is_active).length;
  const registeredCount = registrations.filter(r => r.status === 'registered').length;
  const attendedCount = registrations.filter(r => r.status === 'attended').length;
  const cancelledCount = registrations.filter(r => r.status === 'cancelled').length;
  
  const upcomingEvents = events
    .filter(e => new Date(e.starts_at) >= new Date())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 3);

  const recentRegistrations = registrations.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-primary mb-2">Dashboard Overview</h2>
        <p className="text-muted">Welcome to your event management dashboard.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card shadow-card p-6 flex flex-col items-center justify-center text-center">
          <div className="progress-circle mb-4" style={{ background: `conic-gradient(var(--color-primary) ${activeEventsCount ? 100 : 0}%, var(--color-border) 0)` }}>
            <div className="progress-circle-inner">
              <span className="text-2xl font-bold text-text leading-none mt-2">{activeEventsCount}</span>
              <span className="text-[10px] text-text-muted mt-1 uppercase font-semibold">Events</span>
            </div>
          </div>
          <p className="font-semibold text-text text-sm">Active Events</p>
        </div>

        <div className="card shadow-card p-6 flex flex-col items-center justify-center text-center">
          <div className="progress-circle mb-4" style={{ background: `conic-gradient(var(--color-success) ${Math.min(100, (registeredCount / (registrations.length || 1)) * 100)}%, var(--color-border) 0)` }}>
            <div className="progress-circle-inner">
              <span className="text-2xl font-bold text-text leading-none mt-2">{registeredCount}</span>
              <span className="text-[10px] text-text-muted mt-1 uppercase font-semibold">Total</span>
            </div>
          </div>
          <p className="font-semibold text-text text-sm">Registered</p>
        </div>

        <div className="card shadow-card p-6 flex flex-col items-center justify-center text-center">
          <div className="progress-circle mb-4" style={{ background: `conic-gradient(var(--color-secondary) ${Math.min(100, (attendedCount / (registeredCount || 1)) * 100)}%, var(--color-border) 0)` }}>
            <div className="progress-circle-inner">
              <span className="text-2xl font-bold text-text leading-none mt-2">{attendedCount}</span>
              <span className="text-[10px] text-text-muted mt-1 uppercase font-semibold">Present</span>
            </div>
          </div>
          <p className="font-semibold text-text text-sm">Attended</p>
        </div>

        <div className="card shadow-card p-6 flex flex-col items-center justify-center text-center">
          <div className="progress-circle mb-4" style={{ background: `conic-gradient(var(--color-error) ${Math.min(100, (cancelledCount / (registrations.length || 1)) * 100)}%, var(--color-border) 0)` }}>
            <div className="progress-circle-inner">
              <span className="text-2xl font-bold text-text leading-none mt-2">{cancelledCount}</span>
              <span className="text-[10px] text-text-muted mt-1 uppercase font-semibold">Lost</span>
            </div>
          </div>
          <p className="font-semibold text-text text-sm">Cancelled</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Events */}
        <div className="card shadow-card">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h3 className="text-base font-bold text-text">Upcoming Events</h3>
            <Link to="/admin/events" className="text-xs text-primary font-bold hover:underline px-3 py-1 bg-secondary rounded-full">View all</Link>
          </div>
          <div className="p-0">
            {upcomingEvents.length === 0 ? (
              <div className="p-6 text-center text-text-muted text-sm">No upcoming events.</div>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingEvents.map(event => (
                  <li key={event.id} className="p-6 hover:bg-background/50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <CalendarDays size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-text mb-0.5">{event.title}</h4>
                          <p className="text-xs text-text-muted">
                            {format(new Date(event.starts_at), 'MMM d')} • {format(new Date(event.starts_at), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${event.is_active ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-gray-100 text-gray-500'}`}>
                        {event.is_active ? 'Active' : 'Draft'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent Registrations */}
        <div className="card shadow-card">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h3 className="text-base font-bold text-text">Recent Registrations</h3>
            <Link to="/admin/registrations" className="text-xs text-primary font-bold hover:underline px-3 py-1 bg-secondary rounded-full">View all</Link>
          </div>
          <div className="p-0">
            {recentRegistrations.length === 0 ? (
              <div className="p-6 text-center text-text-muted text-sm">No registrations yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {recentRegistrations.map((reg) => (
                  <li key={reg.id} className="p-6 hover:bg-background/50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-secondary text-primary font-bold flex items-center justify-center text-sm shrink-0">
                          {reg.members?.first_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-text mb-0.5">{reg.members?.first_name} {reg.members?.surname}</h4>
                          <p className="text-xs text-text-muted truncate max-w-[180px]">{reg.events?.title}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 uppercase rounded-md ${
                        reg.status === 'registered' ? 'bg-secondary text-primary' : 
                        reg.status === 'attended' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {reg.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
