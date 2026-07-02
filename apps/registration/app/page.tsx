import Link from 'next/link';
import { createClient } from '@jlycc/supabase/server';
import type { ChurchEvent } from '@jlycc/types';
import { KioskZone } from '../components/kiosk-zone';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .gte('starts_at', new Date(Date.now() - 6 * 3600_000).toISOString())
    .eq('is_active', true)
    .eq('is_published', true)
    .order('starts_at')
    .limit(50);

  const list = (events ?? []) as ChurchEvent[];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-[#1F8A8B]">Announcements & Events</h1>
      <p className="mb-4 text-sm text-gray-500">Jesus Loves You Christian Church</p>

      {list.length === 0 && (
        <p className="rounded-lg border border-dashed bg-white p-6 text-center text-gray-500">
          No upcoming events right now — check back soon.
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {list.map((e) => (
          <li key={e.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <Link href={`/events/${e.id}`} className="block cursor-pointer hover:opacity-95">
              {e.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.image_url} alt={e.title} className="aspect-[3/4] w-full object-cover" />
              ) : (
                <div className="flex aspect-[3/2] w-full flex-col items-center justify-center bg-gradient-to-br from-[#1F8A8B] to-violet-700 p-4 text-center text-white">
                  <p className="text-xl font-bold">{e.title}</p>
                  <p className="mt-1 text-sm opacity-90">
                    {new Date(e.starts_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                  </p>
                </div>
              )}
              <div className="p-3">
                <p className="font-semibold">{e.title}</p>
                <p className="text-sm text-gray-500">
                  {new Date(e.starts_at).toLocaleString()} · {e.venue ?? 'TBA'} ·{' '}
                  <span className="uppercase">{e.event_type}</span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <KioskZone events={list} />

      <p className="mt-8 text-center text-sm text-gray-400">
        <Link href="/login" className="underline hover:text-gray-600">
          Staff sign in
        </Link>
      </p>
    </div>
  );
}
