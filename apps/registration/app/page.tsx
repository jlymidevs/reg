import Link from 'next/link';
import { createClient } from '@jlycc/supabase/server';
import type { ChurchEvent } from '@jlycc/types';

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
      <h1 className="mb-1 text-2xl font-bold text-[#1F8A8B]">Upcoming Events</h1>
      <p className="mb-4 text-sm text-gray-500">Jesus Loves You Christian Church</p>
      {list.length === 0 && (
        <p className="rounded-lg border border-dashed bg-white p-6 text-center text-gray-500">
          No upcoming events right now — check back soon.
        </p>
      )}
      <ul className="space-y-3">
        {list.map((e) => (
          <li key={e.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{e.title}</p>
                <p className="text-sm text-gray-500">
                  {new Date(e.starts_at).toLocaleString()} · {e.venue ?? 'TBA'} ·{' '}
                  <span className="uppercase">{e.event_type}</span>
                </p>
              </div>
              <Link
                href={`/events/${e.id}`}
                className="shrink-0 rounded-lg bg-[#1F8A8B] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                View
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
