import { useEffect, useState } from 'react';
import { Calendar, MapPin, Clock, Users, ArrowRight, CheckCircle, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { getActiveEvents, createRegistration } from '../lib/api';
import type { Event } from '../lib/api';

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Registration state
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    city_address: '',
    phone: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getActiveEvents()
      .then(data => {
        // Only show future/ongoing events (optional)
        const futureEvents = data.filter(e => new Date(e.ends_at) > new Date());
        setEvents(futureEvents.length > 0 ? futureEvents : data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRegister = (event: Event) => {
    setSelectedEvent(event);
    setSuccess(false);
    setFormData({
      first_name: '',
      last_name: '',
      city_address: '',
      phone: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    
    setSubmitting(true);
    setErrorMsg('');
    
    try {
      await createRegistration({
        event_id: selectedEvent.id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        city_address: formData.city_address,
        phone: formData.phone,
      });
      
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
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg">
          <div className="hero-overlay"></div>
          <img 
            src={nextEvent ? `https://images.unsplash.com/photo-[RANDOM]?q=80&w=2070&auto=format&fit=crop`.replace('[RANDOM]', nextEvent.id.substring(0, 8) + '123') : "https://images.unsplash.com/photo-1540575467063-118cb10f643c?q=80&w=2070&auto=format&fit=crop"} 
            alt="Event background" 
            className="hero-image"
          />
        </div>
        
        <div className="container hero-content">
          {nextEvent ? (
            <>
              <span className="hero-badge">Next Upcoming Event</span>
              <h1 className="hero-title">{nextEvent.title}</h1>
              <div className="flex items-center justify-center gap-6 text-blue-100 mb-8 flex-wrap" style={{ fontSize: '1.125rem' }}>
                <div className="flex items-center gap-2">
                  <Calendar size={20} />
                  <span>{format(new Date(nextEvent.starts_at), 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={20} />
                  <span>{format(new Date(nextEvent.starts_at), 'h:mm a')}</span>
                </div>
                {nextEvent.venue && (
                  <div className="flex items-center gap-2">
                    <MapPin size={20} />
                    <span>{nextEvent.venue}</span>
                  </div>
                )}
              </div>
              <div className="hero-actions" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => handleRegister(nextEvent)}
                  className="btn btn-primary hero-btn"
                >
                  Register Here
                </button>
                <a href="#events" className="btn btn-secondary hero-btn" style={{ background: 'transparent', color: 'white', border: '2px solid rgba(255,255,255,0.4)', boxShadow: 'none' }}>
                  Check Incoming Events
                </a>
              </div>
            </>
          ) : (
            <>
              <span className="hero-badge">Join Our Next Gathering</span>
              <h1 className="hero-title">Event Registration <span className="hero-title-accent">Platform</span></h1>
              <p className="hero-subtitle">Secure your spot at our upcoming events, conferences, and workshops.</p>
              <div className="hero-actions">
                <a href="#events" className="btn btn-primary hero-btn">
                  Check Incoming Events
                </a>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Events Section */}
      <section id="events" className="events-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Upcoming Events</h2>
            <div className="section-divider"></div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading amazing events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="card empty-state">
              <Calendar size={48} className="empty-icon" />
              <h3>No upcoming events</h3>
              <p>Check back later for new events and gatherings.</p>
            </div>
          ) : (
            <div className="events-grid">
              {events.map(event => (
                <div key={event.id} className="card event-card">
                  <div className="event-card-header">
                    <img 
                      src={`https://images.unsplash.com/photo-[RANDOM]?q=80&w=800&auto=format&fit=crop`.replace('[RANDOM]', event.id.substring(0, 8) + '123')} 
                      alt={event.title}
                      className="event-image"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511578314322-379fffb2cbac?q=80&w=800&auto=format&fit=crop';
                      }}
                    />
                    <div className="event-image-overlay"></div>
                    <div className="event-title-container">
                      <h3 className="event-title">{event.title}</h3>
                    </div>
                    {event.capacity && (
                      <div className="badge badge-secondary event-capacity-badge">
                        Limited Space
                      </div>
                    )}
                  </div>
                  
                  <div className="event-card-body">
                    <div className="event-details">
                      <div className="event-detail-item">
                        <Calendar className="detail-icon text-primary" size={16} />
                        <div>
                          <span className="detail-text-main">{format(new Date(event.starts_at), 'EEEE, MMMM d, yyyy')}</span>
                          <span className="detail-text-sub">
                            <Clock size={12} /> {format(new Date(event.starts_at), 'h:mm a')} - {format(new Date(event.ends_at), 'h:mm a')}
                          </span>
                        </div>
                      </div>
                      
                      {event.venue && (
                        <div className="event-detail-item">
                          <MapPin className="detail-icon text-primary" size={16} />
                          <span className="detail-text-main">{event.venue}</span>
                        </div>
                      )}
                      
                      <div className="event-detail-item">
                        <Users className="detail-icon text-primary" size={16} />
                        <span className="detail-text-main">{event.capacity ? `${event.capacity} spots maximum` : 'Unlimited capacity'}</span>
                      </div>
                    </div>
                    
                    {event.description && (
                      <p className="event-description text-muted">
                        {event.description}
                      </p>
                    )}
                    
                    <div className="flex gap-2 mt-auto">
                      <button 
                        onClick={() => handleRegister(event)}
                        className="btn btn-primary flex-1"
                      >
                        Register Here
                      </button>
                      <button 
                        onClick={() => handleShare(event)}
                        className="btn btn-secondary px-3"
                        title="Share Event"
                        style={{ padding: '0.75rem' }}
                      >
                        <Share2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Registration Modal */}
      {selectedEvent && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header-accent"></div>
            
            <div className="modal-body">
              {!success && (
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="modal-close"
                >
                  ✕
                </button>
              )}
              
              {success ? (
                <div className="success-state text-center">
                  <div className="success-icon-container">
                    <CheckCircle className="text-success" size={40} />
                  </div>
                  <h3 className="success-title">Registration Complete!</h3>
                  <p className="success-message">
                    You have successfully registered for <br/>
                    <span className="text-primary font-semibold">{selectedEvent.title}</span>.
                  </p>
                  
                  <div className="success-details">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="detail-label">Date</span>
                        <span className="detail-value">{format(new Date(selectedEvent.starts_at), 'MMM d, yyyy')}</span>
                      </div>
                      <div>
                        <span className="detail-label">Time</span>
                        <span className="detail-value">{format(new Date(selectedEvent.starts_at), 'h:mm a')}</span>
                      </div>
                      <div className="full-width">
                        <span className="detail-label">Location</span>
                        <span className="detail-value">{selectedEvent.venue || 'No venue set'}</span>
                      </div>
                    </div>
                  </div>
                  
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a 
                      href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedEvent.title)}&dates=${new Date(selectedEvent.starts_at).toISOString().replace(/-|:|\.\d\d\d/g, '')}/${new Date(selectedEvent.ends_at).toISOString().replace(/-|:|\.\d\d\d/g, '')}&details=${encodeURIComponent(selectedEvent.description || '')}&location=${encodeURIComponent(selectedEvent.venue || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary w-full"
                    >
                      <Calendar size={18} className="mr-2 text-secondary" /> Add to Calendar
                    </a>
                    <button 
                      onClick={() => setSelectedEvent(null)}
                      className="btn btn-primary w-full"
                    >
                      Return to Events
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-header">
                    <h3 className="form-title">Register for Event</h3>
                    <p className="form-subtitle">{selectedEvent.title}</p>
                  </div>
                  
                  {errorMsg && (
                    <div className="error-message">
                      {errorMsg}
                    </div>
                  )}
                  
                  <form onSubmit={handleSubmit} className="registration-form">
                    <div className="form-row">
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
                        <label className="label" htmlFor="last_name">Last Name *</label>
                        <input 
                          id="last_name"
                          type="text" 
                          required
                          className="input" 
                          placeholder="Doe"
                          value={formData.last_name}
                          onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="form-group mb-0">
                      <label className="label" htmlFor="city_address">City Address *</label>
                      <input 
                        id="city_address"
                        type="text" 
                        required
                        className="input" 
                        placeholder="e.g. Quezon City"
                        value={formData.city_address}
                        onChange={(e) => setFormData({...formData, city_address: e.target.value})}
                      />
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
                      <p className="input-hint">Format: +639171234567</p>
                    </div>
                    
                    <button 
                      type="submit" 
                      className="btn btn-primary w-full mt-6 form-submit"
                      disabled={submitting}
                    >
                      {submitting ? 'Processing...' : (
                        <span className="flex items-center justify-center gap-2">
                          Confirm Registration <ArrowRight size={18} />
                        </span>
                      )}
                    </button>
                    
                    <p className="terms-text">
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
