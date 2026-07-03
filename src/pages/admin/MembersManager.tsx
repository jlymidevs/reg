import { useEffect, useState } from 'react';
import { getAllRegistrations } from '../../lib/api';
import { Search, User, MapPin, Phone, Calendar, History, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function MembersManager() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected Member State
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await getAllRegistrations();

      // Group registrations by member to form the directory
      const membersMap = new Map();

      data.forEach((reg) => {
        const key = reg.member_id;
        const fullName = `${reg.members?.first_name ?? ''} ${reg.members?.surname ?? ''}`.trim() || 'Unknown';
        if (!membersMap.has(key)) {
          membersMap.set(key, {
            member_id: key,
            full_name: fullName,
            phone: reg.members?.phone ?? '',
            address: reg.members?.address ?? '',
            total_events_registered: 0,
            total_events_attended: 0,
            total_events_cancelled: 0,
            event_history: []
          });
        }

        const member = membersMap.get(key);
        member.total_events_registered++;
        if (reg.status === 'attended') member.total_events_attended++;
        if (reg.status === 'cancelled') member.total_events_cancelled++;

        member.event_history.push({
          registration_id: reg.id,
          event_id: reg.event_id,
          event_title: reg.events?.title,
          status: reg.status,
          registered_at: reg.registered_at,
          notes: reg.notes
        });
      });

      const membersArray = Array.from(membersMap.values());
      membersArray.sort((a, b) => b.total_events_registered - a.total_events_registered);

      setMembers(membersArray);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(m => {
    const searchLower = searchTerm.toLowerCase();
    return m.full_name.toLowerCase().includes(searchLower) || (m.phone || '').toLowerCase().includes(searchLower);
  });

  if (selectedMember) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <button 
          onClick={() => setSelectedMember(null)}
          className="flex items-center gap-2 text-muted hover:text-primary transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} /> Back to Members List
        </button>
        
        <div className="card overflow-hidden">
          <div className="bg-primary p-8 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                <User size={32} className="text-secondary" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">{selectedMember.full_name}</h2>
                <div className="flex gap-4 mt-2 text-white/70 text-sm">
                  {selectedMember.address && (
                    <span className="flex items-center gap-1">
                      <MapPin size={14} /> {selectedMember.address}
                    </span>
                  )}
                  {selectedMember.phone && (
                    <a href={`tel:${selectedMember.phone}`} className="flex items-center gap-1 hover:text-white transition-colors">
                      <Phone size={14} /> {selectedMember.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/20">
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Registered</p>
                <p className="text-2xl font-bold">{selectedMember.total_events_registered} <span className="text-base font-normal text-white/70">events</span></p>
              </div>
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Attended</p>
                <p className="text-2xl font-bold text-success flex items-center gap-2">
                  {selectedMember.total_events_attended} <CheckCircle2 size={20} className="opacity-80" />
                </p>
              </div>
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Cancelled</p>
                <p className="text-2xl font-bold text-error flex items-center gap-2">
                  {selectedMember.total_events_cancelled} <XCircle size={20} className="opacity-80" />
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-8 bg-gray-50/50">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
              <History size={20} /> Event History
            </h3>
            
            <div className="space-y-4">
              {selectedMember.event_history.map((historyItem: any) => (
                <div key={historyItem.registration_id} className="bg-white p-5 rounded-xl border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-text">{historyItem.event_title}</h4>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted">
                      <Calendar size={14} /> Registered on {format(new Date(historyItem.registered_at), 'MMM d, yyyy')}
                    </div>
                    {historyItem.notes && (
                      <p className="text-sm text-muted mt-2 italic bg-gray-50 p-2 rounded">
                        " {historyItem.notes} "
                      </p>
                    )}
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 uppercase rounded-md ${
                      historyItem.status === 'registered' ? 'bg-secondary text-primary' : 
                      historyItem.status === 'attended' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {historyItem.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text mb-1">Members Directory</h2>
        <p className="text-sm text-text-muted">View a complete list of attendees and their event history.</p>
      </div>

      <div className="flex bg-white p-4 rounded-2xl shadow-card border border-border">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input 
            type="text" 
            placeholder="Search members by name or phone..."
            className="input pl-10 bg-background/50 border-border/50 text-sm rounded-xl focus:bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Loading members...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-12 text-center">
            <User size={48} className="mx-auto text-text-muted mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-text mb-2">No members found</h3>
            <p className="text-sm text-text-muted">Try adjusting your search terms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y md:divide-y-0 md:border-t md:border-l border-border/50">
            {filteredMembers.map((member) => (
              <div 
                key={member.member_id}
                className="p-6 md:border-b md:border-r border-border hover:bg-gray-50 transition-colors cursor-pointer group"
                onClick={() => setSelectedMember(member)}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-secondary text-primary font-bold flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="text-lg">
                      {member.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-text truncate group-hover:text-primary transition-colors">{member.full_name}</h4>
                    <p className="text-xs text-text-muted truncate mt-0.5">{member.phone}</p>
                    <div className="mt-3 flex gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 uppercase rounded-md bg-secondary text-primary">
                        {member.total_events_registered} Events
                      </span>
                      {member.total_events_attended > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 uppercase rounded-md bg-[#10B981]/10 text-[#10B981]">
                          {member.total_events_attended} Attended
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
