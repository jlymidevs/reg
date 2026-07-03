import { useEffect, useMemo, useState } from 'react';
import { Download, BarChart3 } from 'lucide-react';
import { getAllEvents, getAllRegistrations, getMemberMetaMap, getMemberActivitySummary } from '../../lib/api';
import type { Event, RegistrationWithRelations, MemberMeta, MemberActivity } from '../../lib/api';

const GENDER_LABELS: Record<string, string> = {
  male: 'Male', female: 'Female', 'prefer not to say': 'Prefer not to say',
};

function bucketGender(raw: string | null | undefined) {
  if (!raw) return 'Unspecified';
  const lower = raw.trim().toLowerCase();
  return GENDER_LABELS[lower] ?? (raw.trim() || 'Unspecified');
}

function toCsv(rows: Record<string, string | number>[]) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h] ?? '')).join(','))].join('\n');
}

function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function BreakdownTable({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <div className="card shadow-card p-6">
      <h3 className="font-bold text-text mb-4">{title}</h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 text-text-muted capitalize truncate">{r.label.replace(/_/g, ' ')}</span>
            <div className="flex-1 bg-background rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: total ? `${(r.count / total) * 100}%` : '0%' }} />
            </div>
            <span className="w-10 text-right font-semibold text-text">{r.count}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-text-muted">No data.</p>}
      </div>
    </div>
  );
}

export default function Reports() {
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationWithRelations[]>([]);
  const [metaByMember, setMetaByMember] = useState<Record<string, MemberMeta>>({});
  const [activity, setActivity] = useState<MemberActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const [eventFilter, setEventFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    Promise.all([getAllEvents(), getAllRegistrations(), getMemberMetaMap(), getMemberActivitySummary()])
      .then(([e, r, m, a]) => {
        setEvents(e);
        setRegistrations(r);
        setMetaByMember(m);
        setActivity(a);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return registrations.filter((r) => {
      if (eventFilter !== 'all' && r.event_id !== eventFilter) return false;
      const regDate = new Date(r.registered_at);
      if (dateFrom && regDate < new Date(dateFrom)) return false;
      if (dateTo && regDate > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [registrations, eventFilter, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { registered: 0, attended: 0, cancelled: 0 };
    filtered.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
    return Object.entries(counts).map(([label, count]) => ({ label, count }));
  }, [filtered]);

  const ageBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((r) => {
      const bracket = metaByMember[r.member_id]?.age_bracket ?? 'unspecified';
      counts[bracket] = (counts[bracket] ?? 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [filtered, metaByMember]);

  const genderBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((r) => {
      const g = bucketGender(r.members?.gender);
      counts[g] = (counts[g] ?? 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const memberTypeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((r) => {
      const t = metaByMember[r.member_id]?.member_type ?? 'regular_member';
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [filtered, metaByMember]);

  const activeInactive = useMemo(() => {
    const highly = activity.filter((a) => a.activity_status === 'highly_active').length;
    const act = activity.filter((a) => a.activity_status === 'active').length;
    const occ = activity.filter((a) => a.activity_status === 'occasional').length;
    const inact = activity.filter((a) => a.activity_status === 'inactive').length;
    return [
      { label: 'highly active', count: highly },
      { label: 'active', count: act },
      { label: 'occasional', count: occ },
      { label: 'inactive', count: inact },
    ];
  }, [activity]);

  const eventComparison = useMemo(() => {
    const byEvent: Record<string, { title: string; registered: number; attended: number; cancelled: number }> = {};
    registrations.forEach((r) => {
      const key = r.event_id;
      if (!byEvent[key]) byEvent[key] = { title: r.events?.title ?? 'Unknown', registered: 0, attended: 0, cancelled: 0 };
      byEvent[key][r.status as 'registered' | 'attended' | 'cancelled'] = (byEvent[key][r.status as 'registered' | 'attended' | 'cancelled'] ?? 0) + 1;
    });
    return Object.values(byEvent);
  }, [registrations]);

  const handleExport = () => {
    const rows = filtered.map((r) => ({
      first_name: r.members?.first_name ?? '',
      surname: r.members?.surname ?? '',
      phone: r.members?.phone ?? '',
      event: r.events?.title ?? '',
      status: r.status,
      registered_at: r.registered_at,
      member_type: metaByMember[r.member_id]?.member_type ?? 'regular_member',
      age_bracket: metaByMember[r.member_id]?.age_bracket ?? '',
      gender: bucketGender(r.members?.gender),
    }));
    downloadCsv(`registrations-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (loading) return <div className="p-8 text-center text-text-muted">Loading reports...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text mb-1">Reports</h2>
          <p className="text-sm text-text-muted">Filtered breakdowns and CSV export.</p>
        </div>
        <button onClick={handleExport} className="btn btn-primary rounded-xl px-5 flex items-center gap-2">
          <Download size={16} /> Export CSV ({filtered.length})
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-card border border-border">
        <select className="input bg-background/50 border-border/50 text-sm rounded-xl cursor-pointer" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
          <option value="all">All Events</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <input type="date" className="input text-sm rounded-xl" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="input text-sm rounded-xl" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BreakdownTable title="Registration Status" rows={statusCounts} />
        <BreakdownTable title="Member Type" rows={memberTypeBreakdown} />
        <BreakdownTable title="Age Bracket" rows={ageBreakdown} />
        <BreakdownTable title="Gender" rows={genderBreakdown} />
        <BreakdownTable title="Member Activity (all-time)" rows={activeInactive} />
      </div>

      <div className="card shadow-card p-6">
        <h3 className="font-bold text-text mb-4 flex items-center gap-2"><BarChart3 size={18} /> Event Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-text-muted uppercase tracking-wider font-semibold border-b border-border">
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Registered</th>
                <th className="py-2 pr-4">Attended</th>
                <th className="py-2">Cancelled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {eventComparison.map((e) => (
                <tr key={e.title} className="text-sm">
                  <td className="py-2 pr-4 font-medium text-text">{e.title}</td>
                  <td className="py-2 pr-4">{e.registered}</td>
                  <td className="py-2 pr-4 text-[#10B981] font-semibold">{e.attended}</td>
                  <td className="py-2 text-error">{e.cancelled}</td>
                </tr>
              ))}
              {eventComparison.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-text-muted">No events yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
