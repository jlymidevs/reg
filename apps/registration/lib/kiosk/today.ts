import type { ChurchEvent } from '@jlycc/types';

const GRACE_MS = 6 * 3600_000;

/** Events whose start falls on the same local calendar day as `now`. */
export function findTodayEvents(events: ChurchEvent[], now: Date): ChurchEvent[] {
  return events.filter((e) => {
    const d = new Date(e.starts_at);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });
}

/** Upcoming events open for registration (same 6h-past-start grace as registerForEvent). */
export function findRegistrableEvents(events: ChurchEvent[], now: Date): ChurchEvent[] {
  return events.filter(
    (e) => e.requires_registration && new Date(e.starts_at).getTime() >= now.getTime() - GRACE_MS
  );
}
