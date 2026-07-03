import { useEffect, useState } from 'react';
import { AlertTriangle, Mail, RefreshCw, Send, Star } from 'lucide-react';
import {
  getAllEvents, generateFeedbackBatch, getFeedbackBatchRecipients, getLatestFeedbackBatch,
  sendFeedbackBatch, getFeedbackResponses,
} from '../../lib/api';
import type { Event, FeedbackBatch, FeedbackRecipient, FeedbackResponse, Member } from '../../lib/api';

type RecipientRow = FeedbackRecipient & { members: Pick<Member, 'first_name' | 'surname'> | null };

export default function FeedbackManager() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [batch, setBatch] = useState<FeedbackBatch | null>(null);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  useEffect(() => {
    getAllEvents().then(setEvents).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    setSendResult(null);
    refresh();
  }, [selectedEventId]);

  const refresh = async () => {
    const [latestBatch, feedbackResponses] = await Promise.all([
      getLatestFeedbackBatch(selectedEventId).catch(() => null),
      getFeedbackResponses(selectedEventId).catch(() => []),
    ]);
    setBatch(latestBatch);
    setResponses(feedbackResponses);
    if (latestBatch) {
      const r = await getFeedbackBatchRecipients(latestBatch.id).catch(() => []);
      setRecipients(r as RecipientRow[]);
    } else {
      setRecipients([]);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setWarning(null);
    try {
      const preview = await generateFeedbackBatch(selectedEventId);
      setWarning(preview.warning);
      await refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to generate feedback sample.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!batch) return;
    if (!confirm(`Send feedback request to ${recipients.length} recipients?`)) return;
    setSending(true);
    try {
      const result = await sendFeedbackBatch(batch.id);
      setSendResult(result);
      await refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to send feedback emails.');
    } finally {
      setSending(false);
    }
  };

  const avgRating = responses.length > 0
    ? (responses.reduce((sum, r) => sum + (r.overall_rating ?? 0), 0) / responses.length).toFixed(1)
    : null;

  const isDraft = batch?.status === 'draft';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text mb-1">Feedback</h2>
        <p className="text-sm text-text-muted">Sampled from regular members who checked in — never sent to everyone.</p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-card border border-border">
        <select
          className="input bg-background/50 border-border/50 text-sm rounded-xl cursor-pointer hover:bg-white w-full md:w-auto"
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
        >
          <option value="">Select an event</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      {selectedEventId && (
        <>
          {responses.length > 0 && (
            <div className="card shadow-card p-6 flex items-center gap-4">
              <Star className="text-secondary fill-secondary" size={28} />
              <div>
                <div className="text-2xl font-bold text-text">{avgRating} / 5</div>
                <div className="text-sm text-text-muted">Average rating from {responses.length} response{responses.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}

          <div className="card shadow-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 className="font-bold text-text">Feedback Sample</h3>
                {batch ? (
                  <p className="text-sm text-text-muted">
                    {batch.eligible_count} eligible · {batch.selected_count} selected · status: <span className="font-semibold">{batch.status}</span>
                  </p>
                ) : (
                  <p className="text-sm text-text-muted">No sample generated yet for this event.</p>
                )}
              </div>
              <div className="flex gap-2">
                {isDraft || !batch ? (
                  <button onClick={handleGenerate} disabled={generating} className="btn btn-secondary text-sm px-4 py-2 rounded-xl flex items-center gap-2">
                    <RefreshCw size={16} /> {batch ? 'Regenerate Sample' : 'Generate Feedback Sample'}
                  </button>
                ) : null}
                {isDraft && recipients.length > 0 && (
                  <button onClick={handleSend} disabled={sending} className="btn btn-primary text-sm px-4 py-2 rounded-xl flex items-center gap-2">
                    <Send size={16} /> {sending ? 'Sending...' : 'Send Feedback Request'}
                  </button>
                )}
              </div>
            </div>

            {warning && (
              <div className="p-3 bg-accent/10 border border-accent/30 text-accent rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle size={16} /> {warning}
              </div>
            )}

            {sendResult && (
              <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] rounded-lg text-sm flex items-center gap-2">
                <Mail size={16} /> Sent {sendResult.sent}{sendResult.failed > 0 ? `, ${sendResult.failed} failed` : ''}.
              </div>
            )}

            {recipients.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs text-text-muted uppercase tracking-wider font-semibold border-b border-border">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {recipients.map((r) => (
                      <tr key={r.id} className="text-sm">
                        <td className="py-2 pr-4 font-medium text-text">{r.members?.first_name} {r.members?.surname}</td>
                        <td className="py-2 pr-4 text-text-muted">{r.email}</td>
                        <td className="py-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 uppercase rounded-md ${
                            r.status === 'responded' ? 'bg-[#10B981]/10 text-[#10B981]' :
                            r.status === 'sent' ? 'bg-secondary text-primary' :
                            r.status === 'failed' ? 'bg-error/10 text-error' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
