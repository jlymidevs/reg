import { useEffect, useState } from 'react';
import { Calendar, MapPin, Clock, Users, ArrowRight, CheckCircle, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { getActiveEvents, registerForEvent, getEventFormFields } from '../lib/api';
import type { Event } from '../lib/api';
import Turnstile from '../components/Turnstile';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

// Curated event/gathering photos (stable Unsplash IDs — easy to replace later)
const EVENT_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87', // conference audience
  'https://images.unsplash.com/photo-1511578314322-379afb476865', // event hall lights
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2', // speaker on stage
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94', // seminar crowd
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678', // stage presentation
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1', // community gathering
];

function eventImage(id: string, width = 800) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const base = EVENT_IMAGES[hash % EVENT_IMAGES.length];
  return `${base}?q=80&w=${width}&auto=format&fit=crop`;
}

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Registration state
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    surname: '',
    address: '',
    phone: '',
    email: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, string | number | boolean>>({});

  useEffect(() => {
    getActiveEvents()
      // Server already filters to active, published, not-yet-ended events
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRegister = (event: Event) => {
    setSelectedEvent(event);
    setSuccess(false);
    setEmailSent(false);
    setTurnstileToken('');
    setCustomAnswers({});
    setFormData({
      first_name: '',
      surname: '',
      address: '',
      phone: '',
      email: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    
    setSubmitting(true);
    setErrorMsg('');
    
    try {
      const result = await registerForEvent({
        event_id: selectedEvent.id,
        first_name: formData.first_name,
        surname: formData.surname,
        address: formData.address,
        phone: formData.phone,
        email: formData.email || undefined,
        turnstile_token: turnstileToken || undefined,
        form_response: customAnswers,
      });

      setEmailSent(result.emailSent);
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async (event: Event) => {
    const text = `Join us for ${event.title}!\n\n📅 Date: ${format(new Date(event.starts_at), 'MMM d, yyyy')}\n⏰ Time: ${format(new Date(event.starts_at), 'h:mm a')}\n📍 Venue: ${event.venue || 'TBA'}\n\nRegister here: ${window.location.href}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: text,
        });
      } catch (err) {
        console.error('Error sharing', err);
      }
    } else {
      navigator.clipboard.writeText(text);
      alert('Event details copied to clipboard! You can now paste it in your Facebook Group.');
    }
  };

  const nextEvent = events.length > 0 ? events[0] : null;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-primary/95 mix-blend-multiply z-10"></div>
          <img 
            src={nextEvent ? eventImage(nextEvent.id, 2070) : "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070&auto=format&fit=crop"}
            alt="Event background" 
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="container relative z-20 text-center text-white">
          {nextEvent ? <span className="inline-block py-1 px-3 rounded-full bg-white/10 border border-white/20 text-blue-200 text-sm font-medium mb-6 backdrop-blur-sm">Next Upcoming Event</span> : <span className="inline-block py-1 px-3 rounded-full bg-white/10 border border-white/20 text-blue-200 text-sm font-medium mb-6 backdrop-blur-sm">Join Our Next Gathering</span>}
          {nextEvent ? <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight">{nextEvent.title}</h1> : <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight">Event Registration <span className="text-secondary italic">Platform</span></h1>}
          <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            Secure your spot at our upcoming events, conferences, and workshops. Discover what's happening and register in seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {nextEvent ? (<><button onClick={() => handleRegister(nextEvent)} className="btn btn-primary text-white font-bold px-8 py-4 rounded-full shadow-lg hover:-translate-y-1 transition-all">Register Here</button><a href="#events" className="btn btn-secondary text-primary font-bold px-8 py-4 rounded-full shadow-lg shadow-secondary/20 hover:shadow-secondary/40 hover:-translate-y-1 transition-all ml-4">Check Incoming Events</a></>) : <a href="#events" className="btn btn-secondary text-primary font-bold px-8 py-4 rounded-full shadow-lg shadow-secondary/20 hover:shadow-secondary/40 hover:-translate-y-1 transition-all">Check Incoming Events</a>}
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section id="events" className="py-20 bg-background flex-1">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">Upcoming Events</h2>
            <div className="w-16 h-1 bg-secondary mx-auto rounded-full"></div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-pulse flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-muted font-medium">Loading amazing events...</p>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="card p-12 text-center max-w-2xl mx-auto">
              <Calendar size={48} className="mx-auto text-muted mb-4 opacity-50" />
              <h3 className="text-xl font-medium text-text mb-2">No upcoming events</h3>
              <p className="text-muted">Check back later for new events and gatherings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {events.map(event => (
                <div key={event.id} className="card group hover:-translate-y-2 hover:shadow-xl transition-all duration-300 border border-border/50 overflow-hidden flex flex-col h-full">
                  <div className="h-48 bg-gray-100 relative overflow-hidden">
                    <img 
                      src={eventImage(event.id)}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511578314322-379fffb2cbac?q=80&w=800&auto=format&fit=crop';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <h3 className="text-xl font-bold line-clamp-1">{event.title}</h3>
                    </div>
                    {event.capacity && (
                      <div className="absolute top-4 right-4 badge badge-secondary shadow-lg">
                        Limited Space
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="space-y-3 mb-6 flex-1">
                      <div className="flex items-start gap-3 text-sm text-text">
                        <Calendar className="text-primary mt-0.5 shrink-0" size={16} />
                        <div>
                          <span className="font-medium block">{format(new Date(event.starts_at), 'EEEE, MMMM d, yyyy')}</span>
                          <span className="text-muted block mt-0.5 flex items-center gap-1">
                            <Clock size={12} /> {format(new Date(event.starts_at), 'h:mm a')} - {format(new Date(event.ends_at), 'h:mm a')}
                          </span>
                        </div>
                      </div>
                      
                      {event.venue && (
                        <div className="flex items-start gap-3 text-sm text-text">
                          <MapPin className="text-primary mt-0.5 shrink-0" size={16} />
                          <span className="leading-snug">{event.venue}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 text-sm text-text">
                        <Users className="text-primary shrink-0" size={16} />
                        <span>{event.capacity ? `${event.capacity} spots maximum` : 'Unlimited capacity'}</span>
                      </div>
                    </div>
                    
                    {event.description && (
                      <p className="text-muted text-sm line-clamp-2 mb-6">
                        {event.description}
                      </p>
                    )}
                    
                    <div className="flex gap-2 mt-auto"><button onClick={() => handleRegister(event)} className="btn btn-primary flex-1 group-hover:bg-primary-light">Register Here</button><button onClick={() => handleShare(event)} className="btn btn-secondary px-3" title="Share Event" style={{ padding: '0.75rem' }}><Share2 size={20} /></button></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Registration Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-secondary to-primary"></div>
            
            <div className="p-8">
              {!success && (
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="absolute top-6 right-6 text-muted hover:text-error transition-colors"
                >
                  ✕
                </button>
              )}
              
              {success ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="text-success" size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-text mb-2">Registration Complete!</h3>
                  <p className="text-muted mb-8">
                    You have successfully registered for <br/>
                    <span className="font-semibold text-primary">{selectedEvent.title}</span>.
                    {emailSent && <><br/><span className="text-sm">A confirmation email is on its way to your inbox.</span></>}
                  </p>
                  
                  <div className="bg-gray-50 rounded-xl p-4 text-left text-sm text-text mb-8 border border-border">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted block text-xs uppercase tracking-wider">Date</span>
                        <span className="font-medium">{format(new Date(selectedEvent.starts_at), 'MMM d, yyyy')}</span>
                      </div>
                      <div>
                        <span className="text-muted block text-xs uppercase tracking-wider">Time</span>
                        <span className="font-medium">{format(new Date(selectedEvent.starts_at), 'h:mm a')}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted block text-xs uppercase tracking-wider">Location</span>
                        <span className="font-medium">{selectedEvent.venue || 'No venue set'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3"><a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedEvent.title)}&dates=${new Date(selectedEvent.starts_at).toISOString().replace(/-|:|\.\d\d\d/g, '')}/${new Date(selectedEvent.ends_at).toISOString().replace(/-|:|\.\d\d\d/g, '')}&details=${encodeURIComponent(selectedEvent.description || '')}&location=${encodeURIComponent(selectedEvent.venue || '')}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full"><Calendar size={18} className="mr-2 text-secondary" /> Add to Calendar</a><button onClick={() => setSelectedEvent(null)} className="btn btn-primary w-full">Return to Events</button></div>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold text-primary mb-2">Register for Event</h3>
                    <p className="text-text font-medium text-lg border-l-4 border-secondary pl-3">{selectedEvent.title}</p>
                  </div>
                  
                  {errorMsg && (
                    <div className="mb-6 p-4 bg-error/10 border border-error/20 text-error rounded-md text-sm">
                      {errorMsg}
                    </div>
                  )}
                  
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="form-group mb-0">
                        <label className="label" htmlFor="first_name">First Name *</label>
                        <input 
                          id="first_name"
                          type="text" 
                          required
                          className="input" 
                          placeholder="John"
                          value={formData.first_name}
                          onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                        />
                      </div>
                      <div className="form-group mb-0">
                        <label className="label" htmlFor="surname">Last Name *</label>
                        <input
                          id="surname"
                          type="text"
                          required
                          className="input"
                          placeholder="Doe"
                          value={formData.surname}
                          onChange={(e) => setFormData({...formData, surname: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="form-group mb-0">
                      <label className="label" htmlFor="address">City Address *</label><input id="address" type="text" required className="input" placeholder="e.g. Quezon City" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                    </div>
                    
                    <div className="form-group mb-0">
                      <label className="label" htmlFor="phone">Phone Number *</label>
                      <input 
                        id="phone"
                        type="tel" 
                        required
                        pattern="^\+639\d{9}$"
                        title="Must be in format +639XXXXXXXXX"
                        className="input" 
                        placeholder="+639171234567"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                      <p className="text-xs text-muted mt-1">Format: +639171234567</p>
                    </div>

                    <div className="form-group mb-0">
                      <label className="label" htmlFor="email">Email <span className="text-muted font-normal">(optional — get a confirmation email)</span></label>
                      <input
                        id="email"
                        type="email"
                        className="input"
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>

                    {getEventFormFields(selectedEvent).map((field) => (
                      <div key={field.id} className="form-group mb-0">
                        <label className="label" htmlFor={field.id}>
                          {field.label} {field.required && '*'}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea
                            id={field.id}
                            required={field.required}
                            className="input resize-none"
                            rows={3}
                            value={String(customAnswers[field.id] ?? '')}
                            onChange={(e) => setCustomAnswers((a) => ({ ...a, [field.id]: e.target.value }))}
                          />
                        ) : field.type === 'dropdown' ? (
                          <select
                            id={field.id}
                            required={field.required}
                            className="input"
                            value={String(customAnswers[field.id] ?? '')}
                            onChange={(e) => setCustomAnswers((a) => ({ ...a, [field.id]: e.target.value }))}
                          >
                            <option value="">Select...</option>
                            {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : field.type === 'radio' ? (
                          <div className="flex flex-wrap gap-4">
                            {(field.options || []).map((opt) => (
                              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="radio"
                                  name={field.id}
                                  required={field.required}
                                  checked={customAnswers[field.id] === opt}
                                  onChange={() => setCustomAnswers((a) => ({ ...a, [field.id]: opt }))}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        ) : field.type === 'checkbox' ? (
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(customAnswers[field.id])}
                              onChange={(e) => setCustomAnswers((a) => ({ ...a, [field.id]: e.target.checked }))}
                            />
                            Yes
                          </label>
                        ) : (
                          <input
                            id={field.id}
                            type={field.type === 'phone' ? 'tel' : field.type}
                            required={field.required}
                            className="input"
                            value={String(customAnswers[field.id] ?? '')}
                            onChange={(e) => setCustomAnswers((a) => ({ ...a, [field.id]: e.target.value }))}
                          />
                        )}
                        {field.helpText && <p className="text-xs text-muted mt-1">{field.helpText}</p>}
                      </div>
                    ))}

                    {TURNSTILE_SITE_KEY && (
                      <Turnstile
                        siteKey={TURNSTILE_SITE_KEY}
                        onVerify={setTurnstileToken}
                        onExpire={() => setTurnstileToken('')}
                      />
                    )}

                    <button
                      type="submit"
                      className="btn btn-primary w-full mt-6"
                      disabled={submitting || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
                    >
                      {submitting ? 'Processing...' : (
                        <span className="flex items-center justify-center gap-2">
                          Confirm Registration <ArrowRight size={18} />
                        </span>
                      )}
                    </button>
                    
                    <p className="text-xs text-center text-muted mt-4">
                      By registering, you agree to our terms of service and privacy policy.
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
