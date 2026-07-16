import type { ChurchEvent } from '@jlycc/types';

const GRACE_MS = 6 * 3600_000;
const APP_TIME_ZONE = 'Asia/Manila';

function calendarDay(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

/** Events whose start falls on the same product-local calendar day as `now`. */
export function findTodayEvents(events: ChurchEvent[], now: Date): ChurchEvent[] {
  const today = calendarDay(now);
  return events.filter((e) => calendarDay(new Date(e.starts_at)) === today);
}

/** Upcoming events open for registration (same 6h-past-start grace as registerForEvent). */
export function findRegistrableEvents(events: ChurchEvent[], now: Date): ChurchEvent[] {
  return events.filter(
    (e) => e.requires_registration && new Date(e.starts_at).getTime() >= now.getTime() - GRACE_MS
  );
}
