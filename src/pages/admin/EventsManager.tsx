import { useEffect, useState } from 'react';
import { getAllEvents, createEvent, updateEvent, archiveEvent, getEventFormFields } from '../../lib/api';
import type { Event, CustomFormField, FormFieldType } from '../../lib/api';
import { Plus, Edit2, CheckCircle2, XCircle, Calendar as CalendarIcon, Clock, Users, MapPin, GripVertical, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio button' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Textarea' },
];

function newField(): CustomFormField {
  return { id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type: 'text', label: '', required: false };
}

// The public registration form already collects these — a custom field
// with a colliding label renders as a confusing duplicate for attendees.
const STANDARD_FIELD_LABELS = [
  'first name', 'last name', 'surname', 'city address', 'address',
  'phone number', 'phone', 'mobile number', 'mobile', 'email', 'birth date', 'date of birth',
];

function collidesWithStandardField(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return normalized.length > 0 && STANDARD_FIELD_LABELS.includes(normalized);
}

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
  const [customFields, setCustomFields] = useState<CustomFormField[]>([]);
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
      setCustomFields(getEventFormFields(event));
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
      setCustomFields([]);
    }
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const updateField = (id: string, updates: Partial<CustomFormField>) => {
    setCustomFields((fields) => fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setCustomFields((fields) => {
      const next = [...fields];
      const target = index + direction;
      if (target < 0 || target >= next.length) return fields;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeField = (id: string) => {
    setCustomFields((fields) => fields.filter((f) => f.id !== id));
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanFields = customFields.filter((f) => f.label.trim() !== '');
    const colliding = cleanFields.filter((f) => collidesWithStandardField(f.label));
    if (colliding.length > 0) {
      setErrorMsg(`Remove or rename these custom fields — the registration form already asks for them: ${colliding.map((f) => f.label).join(', ')}`);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...formData,
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: new Date(formData.ends_at).toISOString(),
        capacity: formData.capacity > 0 ? formData.capacity : null,
        form_fields: cleanFields as any,
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

  const handleArchive = async (event: Event) => {
    if (!confirm(`Archive "${event.title}"? It will be hidden from lists but not deleted — registrations and history are kept.`)) return;
    try {
      await archiveEvent(event.id);
      await fetchEvents();
    } catch (err) {
      console.error(err);
      alert('Failed to archive event');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text mb-1">Events Management</h2>
          <p className="text-sm text-text-muted">Create and manage your organization's events.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="btn btn-primary rounded-xl px-5 shadow-md shadow-primary/20 whitespace-nowrap"
        >
          <Plus size={18} className="mr-2" /> Create New Event
        </button>
      </div>

      <div className="card shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarIcon size={48} className="mx-auto text-text-muted mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-text mb-2">No events found</h3>
            <p className="text-sm text-text-muted mb-6">You haven't created any events yet.</p>
            <button onClick={() => handleOpenModal()} className="btn btn-primary">
              Create your first event
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background/80 border-b border-border text-xs text-text-muted uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Capacity</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-text">{event.title}</div>
                      <div className="text-xs text-text-muted flex items-center gap-1 mt-1">
                        <MapPin size={12} /> {event.venue || 'No venue set'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-text">{format(new Date(event.starts_at), 'MMM d, yyyy')}</div>
                      <div className="text-text-muted text-xs flex items-center gap-1 mt-1">
                        <Clock size={12} /> {format(new Date(event.starts_at), 'h:mm a')} - {format(new Date(event.ends_at), 'h:mm a')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-text">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-primary" /> {event.capacity || 'Unlimited'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleEventStatus(event)}
                        className={`text-xs font-bold px-3 py-1 uppercase rounded-md transition-colors hover:opacity-80 ${event.is_active ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-gray-100 text-gray-500'}`}
                        title={event.is_active ? "Click to deactivate" : "Click to activate"}
                      >
                        {event.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenModal(event)}
                          className="p-2 text-text-muted hover:text-primary hover:bg-secondary/50 rounded-lg transition-colors"
                          title="Edit Event"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleArchive(event)}
                          className="p-2 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                          title="Archive Event"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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

                <div className="pt-4 border-t border-border mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h4 className="font-bold text-text">Custom Registration Fields</h4>
                      <p className="text-xs text-muted">Added below the standard name/phone/email fields on the public form.</p>
                    </div>
                    <button type="button" onClick={() => setCustomFields((f) => [...f, newField()])} className="btn btn-secondary text-sm px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <Plus size={14} /> Add Field
                    </button>
                  </div>

                  <div className="space-y-3">
                    {customFields.map((field, index) => (
                      <div key={field.id} className="p-4 bg-background/50 rounded-xl border border-border/50">
                        <div className="flex items-start gap-3">
                          <GripVertical size={16} className="text-muted mt-3 shrink-0" />
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <input
                                type="text"
                                placeholder="Field label (e.g. T-shirt size)"
                                className="input text-sm"
                                value={field.label}
                                onChange={(e) => updateField(field.id, { label: e.target.value })}
                              />
                              {collidesWithStandardField(field.label) && (
                                <p className="text-xs text-accent mt-1">
                                  The registration form already asks for this — attendees would see it twice.
                                </p>
                              )}
                            </div>
                            <select
                              className="input text-sm"
                              value={field.type}
                              onChange={(e) => updateField(field.id, { type: e.target.value as FormFieldType })}
                            >
                              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            {(field.type === 'dropdown' || field.type === 'radio') && (
                              <input
                                type="text"
                                placeholder="Options, comma separated"
                                className="input text-sm sm:col-span-2"
                                value={(field.options || []).join(', ')}
                                onChange={(e) => updateField(field.id, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })}
                              />
                            )}
                            <label className="flex items-center gap-2 text-sm text-text cursor-pointer sm:col-span-2">
                              <input
                                type="checkbox"
                                className="w-4 h-4 accent-secondary"
                                checked={field.required}
                                onChange={(e) => updateField(field.id, { required: e.target.checked })}
                              />
                              Required
                            </label>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button type="button" onClick={() => moveField(index, -1)} disabled={index === 0} className="p-1.5 text-muted hover:text-primary disabled:opacity-30 rounded"><ArrowUp size={14} /></button>
                            <button type="button" onClick={() => moveField(index, 1)} disabled={index === customFields.length - 1} className="p-1.5 text-muted hover:text-primary disabled:opacity-30 rounded"><ArrowDown size={14} /></button>
                            <button type="button" onClick={() => removeField(field.id)} className="p-1.5 text-muted hover:text-error rounded"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {customFields.length === 0 && (
                      <p className="text-sm text-muted text-center py-4">No custom fields — registration form uses only the standard fields.</p>
                    )}
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
