import Link from 'next/link';
import { createClient } from '@jlycc/supabase/server';
import type { ChurchEvent } from '@jlycc/types';

export const dynamic = 'force-dynamic';

export default async function ScannerHomePage() {
  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekAhead = new Date(todayStart.getTime() + 7 * 86400_000);

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .gte('starts_at', todayStart.toISOString())
    .lt('starts_at', weekAhead.toISOString())
    .eq('is_active', true)
    .order('starts_at');

  const list = (events ?? []) as ChurchEvent[];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Scanner — events next 7 days</h1>
      {list.length === 0 && (
        <p className="rounded-lg border border-dashed bg-white p-6 text-center text-gray-500">
          No upcoming events. Create events in the admin portal.
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
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/events/${e.id}/scan`}
                  className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
                >
                  Scan
                </Link>
                <Link
                  href={`/events/${e.id}/manual`}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                >
                  Manual
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
