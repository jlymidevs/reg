import { notFound } from 'next/navigation';
import { createClient } from '@jlycc/supabase/server';
import type { ChurchEvent } from '@jlycc/types';
import { RegistrationForm } from './registration-form';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('events')
    .select('id, title, starts_at, requires_registration')
    .eq('id', id)
    .single();
  if (!data || !data.requires_registration) notFound();
  const event = data as Pick<ChurchEvent, 'id' | 'title' | 'starts_at' | 'requires_registration'>;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">Register — {event.title}</h1>
      <p className="mb-4 text-sm text-gray-500">{new Date(event.starts_at).toLocaleString()}</p>
      <RegistrationForm eventId={event.id} />
    </div>
  );
}
