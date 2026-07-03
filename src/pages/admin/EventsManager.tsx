import { useEffect, useState } from 'react';
import { getAllEvents, createEvent, updateEvent } from '../../lib/api';
import type { Event } from '../../lib/api';
import { Plus, Edit2, CheckCircle2, XCircle, Calendar as CalendarIcon, Clock, Users, MapPin } from 'lucide-react';
import { format } from 'date-fns';

export default function EventsManager() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  
  // Form state (using datetime-local compatible format YYYY-MM-DDThh:mm)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    starts_at: '',
    ends_at: '',
    venue: '',
    capacity: 0,
    requires_registration: true,
    allow_walk_in: true,
    is_published: true,
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await getAllEvents();
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toDateTimeLocal = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // Adjust to local timezone format YYYY-MM-DDThh:mm
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleOpenModal = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        description: event.description || '',
        starts_at: toDateTimeLocal(event.starts_at),
        ends_at: toDateTimeLocal(event.ends_at),
        venue: event.venue || '',
        capacity: event.capacity || 0,
        requires_registration: event.requires_registration,
        allow_walk_in: event.allow_walk_in,
        is_published: event.is_published,
        is_active: event.is_active
      });
    } else {
      setEditingEvent(null);
      const now = new Date();
      now.setMinutes(0);
      const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      
      setFormData({
        title: '',
        description: '',
        starts_at: toDateTimeLocal(now.toISOString()),
        ends_at: toDateTimeLocal(later.toISOString()),
        venue: '',
        capacity: 100,
        requires_registration: true,
        allow_walk_in: true,
        is_published: true,
        is_active: true
      });
    }
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      const payload = {
        ...formData,
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: new Date(formData.ends_at).toISOString(),
        capacity: formData.capacity > 0 ? formData.capacity : null,
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
      } else {
        await createEvent(payload);
      }
      
      await fetchEvents();
      handleCloseModal();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const toggleEventStatus = async (event: Event) => {
    try {
      await updateEvent(event.id, { is_active: !event.is_active });
      await fetchEvents();
    } catch (err) {
      console.error(err);
      alert('Failed to update event status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-primary mb-2">Events Management</h2>
          <p className="text-muted">Create and manage your organization's events.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="btn btn-primary whitespace-nowrap"
        >
          <Plus size={18} className="mr-2" /> Create New Event
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarIcon size={48} className="mx-auto text-muted mb-4 opacity-50" />
            <h3 className="text-xl font-medium text-text mb-2">No events found</h3>
            <p className="text-muted mb-6">You haven't created any events yet.</p>
            <button onClick={() => handleOpenModal()} className="btn btn-secondary">
              Create your first event
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-border text-sm text-muted">
                  <th className="px-6 py-4 font-medium">Event</th>
                  <th className="px-6 py-4 font-medium">Date & Time</th>
                  <th className="px-6 py-4 font-medium">Capacity</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-primary">{event.title}</div>
                      <div className="text-xs text-muted flex items-center gap-1 mt-1">
                        <MapPin size={12} /> {event.venue || 'No venue set'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div>{format(new Date(event.starts_at), 'MMM d, yyyy')}</div>
                      <div className="text-muted text-xs flex items-center gap-1 mt-1">
                        <Clock size={12} /> {format(new Date(event.starts_at), 'h:mm a')} - {format(new Date(event.ends_at), 'h:mm a')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Users size={14} className="text-muted" /> {event.capacity || 'Unlimited'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleEventStatus(event)}
                        className={`badge transition-colors hover:opacity-80 ${event.is_active ? 'badge-success' : 'badge-neutral'}`}
                        title={event.is_active ? "Click to deactivate" : "Click to activate"}
                      >
                        {event.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleOpenModal(event)}
                        className="p-2 text-muted hover:text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                        title="Edit Event"
                      >
                        <Edit2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
            <div className="p-6 border-b border-border flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="text-xl font-bold text-primary">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h3>
              <button 
                onClick={handleCloseModal}
                className="text-muted hover:text-error transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="mb-6 p-4 bg-error/10 border border-error/20 text-error rounded-md text-sm">
                  {errorMsg}
                </div>
              )}
              
              <form id="event-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="form-group mb-0">
                  <label className="label" htmlFor="title">Event Title *</label>
                  <input 
                    id="title"
                    type="text" 
                    required
                    className="input" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                
                <div className="form-group mb-0">
                  <label className="label" htmlFor="description">Description</label>
                  <textarea 
                    id="description"
                    rows={4}
                    className="input resize-none" 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  ></textarea>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="form-group mb-0">
                    <label className="label" htmlFor="starts_at">Starts At *</label>
                    <input 
                      id="starts_at"
                      type="datetime-local" 
                      required
                      className="input" 
                      value={formData.starts_at}
                      onChange={(e) => setFormData({...formData, starts_at: e.target.value})}
                    />
                  </div>
                  <div className="form-group mb-0">
                    <label className="label" htmlFor="ends_at">Ends At *</label>
                    <input 
                      id="ends_at"
                      type="datetime-local" 
                      required
                      className="input" 
                      value={formData.ends_at}
                      onChange={(e) => setFormData({...formData, ends_at: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="form-group mb-0">
                  <label className="label" htmlFor="venue">Venue / Location</label>
                  <select 
                    id="venue"
                    className="input" 
                    value={formData.venue}
                    onChange={(e) => setFormData({...formData, venue: e.target.value})}
                  >
                    <option value="">Select a Venue</option>
                    <optgroup label="3rd Floor">
                      <option value="Main Hall">Main Hall (450 sqm)</option>
                      <option value="Lower Balcony">Lower Balcony (250 sqm)</option>
                      <option value="Prayer Room">Prayer Room (65 sqm)</option>
                    </optgroup>
                    <optgroup label="2nd Floor">
                      <option value="Conference Room (Whole)">Conference Room (Whole) (90 sqm)</option>
                      <option value="Conference A">Conference A (30 sqm)</option>
                      <option value="Conference B">Conference B (30 sqm)</option>
                      <option value="Conference C">Conference C (30 sqm)</option>
                      <option value="Library">Library (25 sqm)</option>
                    </optgroup>
                    <optgroup label="1st Floor">
                      <option value="Events Place">Events Place (578 sqm)</option>
                      <option value="Patio">Patio (43 sqm)</option>
                    </optgroup>
                  </select>
                </div>
                
                <div className="form-group mb-0">
                  <label className="label" htmlFor="capacity">Capacity (0 for unlimited)</label>
                  <input 
                    id="capacity"
                    type="number" 
                    min="0"
                    className="input max-w-xs" 
                    value={formData.capacity}
                    onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                  />
                </div>
                
                <div className="pt-2 space-y-3 border-t border-border mt-4">
                  <div className="flex items-center gap-3">
                    <input 
                      id="is_active"
                      type="checkbox" 
                      className="w-5 h-5 accent-secondary rounded border-gray-300 focus:ring-secondary"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    />
                    <label htmlFor="is_active" className="font-medium text-text cursor-pointer">
                      Event is active
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      id="is_published"
                      type="checkbox" 
                      className="w-5 h-5 accent-secondary rounded border-gray-300 focus:ring-secondary"
                      checked={formData.is_published}
                      onChange={(e) => setFormData({...formData, is_published: e.target.checked})}
                    />
                    <label htmlFor="is_published" className="font-medium text-text cursor-pointer">
                      Event is published publicly
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      id="requires_registration"
                      type="checkbox" 
                      className="w-5 h-5 accent-secondary rounded border-gray-300 focus:ring-secondary"
                      checked={formData.requires_registration}
                      onChange={(e) => setFormData({...formData, requires_registration: e.target.checked})}
                    />
                    <label htmlFor="requires_registration" className="font-medium text-text cursor-pointer">
                      Requires Registration
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      id="allow_walk_in"
                      type="checkbox" 
                      className="w-5 h-5 accent-secondary rounded border-gray-300 focus:ring-secondary"
                      checked={formData.allow_walk_in}
                      onChange={(e) => setFormData({...formData, allow_walk_in: e.target.checked})}
                    />
                    <label htmlFor="allow_walk_in" className="font-medium text-text cursor-pointer">
                      Allow Walk-ins
                    </label>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl z-10">
              <button 
                type="button" 
                onClick={handleCloseModal}
                className="btn btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="event-form"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : (
                  <><CheckCircle2 size={18} className="mr-2" /> Save Event</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
