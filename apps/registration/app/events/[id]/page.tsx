import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@jlycc/supabase/server';
import type { ChurchEvent } from '@jlycc/types';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('events').select('*').eq('id', id).single();
  if (!data) notFound(); // RLS hides unpublished events from anon → same 404
  const event = data as ChurchEvent;

  const past = event.ends_at
    ? new Date(event.ends_at).getTime() < Date.now()
    : new Date(event.starts_at).getTime() < Date.now() - 6 * 3600_000;
  const canRegister = event.requires_registration && !past;

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/" className="text-sm text-[#1F8A8B] hover:underline">← All events</Link>
      <h1 className="mt-2 text-2xl font-bold">{event.title}</h1>
      <p className="mt-1 text-sm uppercase tracking-wide text-gray-500">{event.event_type}</p>

      <dl className="mt-4 space-y-2 rounded-xl border bg-white p-4 text-sm shadow-sm">
        <div><dt className="font-semibold">When</dt>
          <dd>{new Date(event.starts_at).toLocaleString()}
            {event.ends_at ? ` – ${new Date(event.ends_at).toLocaleString()}` : ''}</dd></div>
        <div><dt className="font-semibold">Where</dt><dd>{event.venue ?? 'To be announced'}</dd></div>
      </dl>

      {event.description && <p className="mt-4 whitespace-pre-wrap text-gray-700">{event.description}</p>}

      <div className="mt-6">
        {canRegister ? (
          <Link href={`/events/${event.id}/register`}
            className="inline-block rounded-lg bg-[#1F8A8B] px-6 py-3 font-semibold text-white hover:opacity-90">
            Register
          </Link>
        ) : (
          <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-600">
            {past ? 'This event has ended.' : 'No registration needed — just come!'}
          </p>
        )}
      </div>
    </div>
  );
}
