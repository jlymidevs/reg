import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Star } from 'lucide-react';
import { getFeedbackContext, submitFeedback } from '../lib/api';
import { FEEDBACK_QUESTIONS } from '../lib/feedbackQuestions';

function StarRating({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className="p-1"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star size={32} className={n <= value ? 'fill-secondary text-secondary' : 'text-border'} />
        </button>
      ))}
    </div>
  );
}

export default function Feedback() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState('');
  const [alreadyResponded, setAlreadyResponded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [overallRating, setOverallRating] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    getFeedbackContext(token)
      .then((ctx) => {
        setEventTitle(ctx.event_title);
        setAlreadyResponded(ctx.already_responded);
      })
      .catch((err) => setErrorMsg(err.message || 'This feedback link is not valid.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (overallRating === 0) {
      setErrorMsg('Please give an overall rating.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      await submitFeedback({
        token,
        overall_rating: overallRating,
        answers,
        is_anonymous: isAnonymous,
        follow_up_requested: answers['q11_follow_up'] === 'yes',
      });
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading...</div>;
  }

  if (errorMsg && !eventTitle) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-md">
          <p className="text-error font-medium">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (success || alreadyResponded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-10 text-center max-w-md">
          <CheckCircle className="text-success mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-text mb-2">
            {success ? 'Thank you!' : "You've already responded"}
          </h2>
          <p className="text-muted">
            {success
              ? 'Your feedback helps us serve every member better. We appreciate you taking the time.'
              : 'Thanks again for sharing your feedback on this event.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto card p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-primary mb-1">Feedback: {eventTitle}</h1>
          <p className="text-sm text-muted">Takes about 3 minutes. Your honest thoughts help us improve for everyone — kids, youth, adults, and seniors alike.</p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-error/10 border border-error/20 text-error rounded-md text-sm">{errorMsg}</div>
        )}

        <div className="form-group mb-0">
          <label className="label mb-3">Overall, how would you rate the event? *</label>
          <StarRating value={overallRating} onChange={setOverallRating} disabled={submitting} />
        </div>

        {FEEDBACK_QUESTIONS.map((q) => (
          <div key={q.id} className="form-group mb-0">
            <label className="label mb-3">{q.label}</label>
            {q.type === 'rating' && (
              <StarRating
                value={Number(answers[q.id]) || 0}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                disabled={submitting}
              />
            )}
            {q.type === 'textarea' && (
              <textarea
                className="input resize-none"
                rows={3}
                disabled={submitting}
                value={String(answers[q.id] ?? '')}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              />
            )}
            {q.type === 'yesno' && (
              <div className="flex gap-3">
                {['yes', 'no'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={submitting}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                    className={`btn ${answers[q.id] === opt ? 'btn-primary' : 'btn-secondary'} capitalize`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="form-group mb-0">
          <label className="label mb-3">Can your feedback be reviewed with your name attached?</label>
          <div className="flex gap-3">
            <button type="button" disabled={submitting} onClick={() => setIsAnonymous(false)} className={`btn ${!isAnonymous ? 'btn-primary' : 'btn-secondary'}`}>
              Yes, include my name
            </button>
            <button type="button" disabled={submitting} onClick={() => setIsAnonymous(true)} className={`btn ${isAnonymous ? 'btn-primary' : 'btn-secondary'}`}>
              No, keep anonymous
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>
    </div>
  );
}
