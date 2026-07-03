import { useEffect, useState } from 'react';
import { Users, CalendarDays, UserCheck, UserX } from 'lucide-react';
import { getAllEvents, getAllRegistrations } from '../../lib/api';
import type { Event } from '../../lib/api';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function DashboardOverview() {
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6 border-l-4 border-l-secondary">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-muted mb-1">Active Events</p>
              <h3 className="text-3xl font-bold text-primary">{activeEventsCount}</h3>
            </div>
            <div className="p-3 bg-secondary/10 rounded-lg text-secondary">
              <CalendarDays size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6 border-l-4 border-l-primary">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-muted mb-1">Registered</p>
              <h3 className="text-3xl font-bold text-primary">{registeredCount}</h3>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6 border-l-4 border-l-success">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-muted mb-1">Attended</p>
              <h3 className="text-3xl font-bold text-primary">{attendedCount}</h3>
            </div>
            <div className="p-3 bg-success/10 rounded-lg text-success">
              <UserCheck size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6 border-l-4 border-l-error">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-muted mb-1">Cancelled</p>
              <h3 className="text-3xl font-bold text-primary">{cancelledCount}</h3>
            </div>
            <div className="p-3 bg-error/10 rounded-lg text-error">
              <UserX size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Events */}
        <div className="card">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h3 className="text-lg font-bold">Upcoming Events</h3>
            <Link to="/admin/events" className="text-sm text-secondary font-medium hover:underline">View all</Link>
          </div>
          <div className="p-0">
            {upcomingEvents.length === 0 ? (
              <div className="p-6 text-center text-muted">No upcoming events.</div>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingEvents.map(event => (
                  <li key={event.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-primary mb-1">{event.title}</h4>
                        <p className="text-sm text-muted">
                          {format(new Date(event.starts_at), 'MMM d, yyyy')} • {format(new Date(event.starts_at), 'h:mm a')}
                        </p>
                      </div>
                      <span className={`badge ${event.is_active ? 'badge-success' : 'badge-neutral'}`}>
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
        <div className="card">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h3 className="text-lg font-bold">Recent Registrations</h3>
            <Link to="/admin/registrations" className="text-sm text-secondary font-medium hover:underline">View all</Link>
          </div>
          <div className="p-0">
            {recentRegistrations.length === 0 ? (
              <div className="p-6 text-center text-muted">No registrations yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {recentRegistrations.map((reg: any) => (
                  <li key={reg.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium text-text">{reg.first_name} {reg.last_name}</h4>
                        <p className="text-xs text-muted mt-1 truncate max-w-[200px]">{reg.events?.title}</p>
                      </div>
                      <span className={`badge ${
                        reg.status === 'registered' ? 'badge-primary' : 
                        reg.status === 'attended' ? 'badge-success' : 'badge-neutral'
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
