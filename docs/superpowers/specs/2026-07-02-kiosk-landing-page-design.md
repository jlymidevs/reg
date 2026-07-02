# Kiosk Landing Page — Design Spec

**Date:** 2026-07-02
**Status:** Approved by user, ready for implementation plan
**Repo:** `jlycc-platform` monorepo, `apps/registration` (rebuilds the existing public homepage — no new repo).

## Goal

The church has a kiosk device (tablet/PC) at the entrance. Rebuild the registration app's homepage (`/`) into a flyer-forward landing page that serves three audiences from one URL:

1. **Everyone** — sees event announcements as flyer images (like the church's Canva posters), taps through to register.
2. **Entrance kiosk (signed-in device)** — members self-scan their QR to check in to today's event, replacing the staff-held-scanner flow at the door.
3. **Members at the kiosk** — advance-register for upcoming events by scanning their QR. No typing.

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| Which event does a kiosk scan check into? | Auto-detect today's event; if 2+ today, staff picks once per session |
| Kiosk auth | Device signed in once with a scan-rights Google account (existing `can_scan()` RPC). No backend auth changes. |
| Announcement images source | Upcoming published events' `image_url` (from admin-dashboard spec's migration 015) — no separate announcements table |
| Advance registration flow | Separate "Register" tab in the kiosk zone, not a post-check-in prompt — keeps the entrance line moving |
| Page structure | Single adaptive homepage (approach A) — not a separate `/kiosk` route |

## Page structure (`app/page.tsx` rebuild)

**Zone 1 — Announcements (public, always rendered):**
- Grid of upcoming published+active events (same query as the current homepage).
- Card = full flyer image when `events.image_url` is set; text-only card (title/date/venue/type, current visual style) when null or when the column doesn't exist yet.
- Tap → `/events/[id]` → existing detail/register flow, unchanged.
- Small "Staff sign in" link for kiosk/staff bootstrap.

**Zone 2 — Check-in scanner (rendered only when the session user passes `can_scan()`):**
- Continuous QR scanner reusing the BarcodeDetector pattern from `app/events/[id]/scan/page.tsx` (including the manual-code-entry fallback for browsers without BarcodeDetector).
- Targets **today's event**: derived client-side from the zone-1 events list (event where `starts_at` falls on today, with a grace window consistent with the existing 6-hour convention). No event today → "No event today" placeholder. Two or more → one-time event picker, choice held in component state for the session.
- Calls the existing `qr-checkin` edge function unchanged.
- Result states (success / already-checked-in / not-recognized / error) flash large, then auto-reset to scanning after ~3 seconds — entrance-line friendly, no tap needed between people.

**Zone 3 — Register via QR (tab within the same signed-in section):**
- Tab switch: `Check-in | Register`.
- Register flow: staff/member picks an upcoming `requires_registration` event from a list → scanner activates → member scans their QR → registered.
- New server action `registerByQr(eventId, qrValue)`:
  - Same event guards as `registerForEvent` (published, active, requires_registration, not past).
  - Resolves member via `members.qr_code_value` using the service-role admin client (same opaque-token lookup the `qr-checkin` function does).
  - Inserts `event_registrations` row with `member_id`, `status = 'registered'`.
  - Duplicate (same member, same event) → friendly `{ ok: true, duplicate: true }`, mirroring `registerForEvent`'s duplicate handling. Dedupe mechanism: the existing unique constraint on `(event_id, member_id)` if one exists — **the implementation plan must verify this constraint in migration 004**; if absent, use a pre-insert check.
  - Unknown QR → `{ ok: false, error: 'QR not recognized' }`.
- Guests (no QR) still use the existing phone-based form — kiosk register mode is members-only by nature.

## Auth model

- `/` remains public in middleware — **no middleware changes**.
- Zones 2–3 are client-gated: render only when a Supabase session exists AND the `can_scan()` RPC returns true for the user. Signed-in users without scan rights see the same page as anon.
- The `registerByQr` server action independently re-verifies the caller's session + `can_scan()` server-side before doing anything (client-side gating is cosmetic, not the security boundary).
- The kiosk device signs in once via the existing `/login` Google OAuth; the session persists on the device.

## Dependencies & build order

- `events.image_url` ships in migration 015 (admin-dashboard spec, `2026-07-02-admin-events-dashboard-design.md`). This landing page **does not depend on it**: v1 code must select defensively and fall back to text cards, so it works both before and after 015 is applied. Real flyers appear once the admin dashboard exists and staff upload images.
- No new tables, no new migrations in this spec.

## Error handling

- Camera permission denied / no BarcodeDetector → manual code entry fallback (existing pattern).
- All `registerByQr` outcomes are typed results (`{ ok: ... }`), never thrown to the UI.
- Scanner debounce: same 5-second same-code ignore as the existing scan page, to handle cameras firing repeatedly.

## Testing

- Vitest: `registerByQr` guard logic — closed/unpublished event, unknown QR value, duplicate registration, past event.
- Manual E2E checklist:
  1. Anon phone: flyers/text cards only, no scanner zone, staff sign-in link visible.
  2. Signed-in scan-rights device: scanner zone renders, targets today's event.
  3. Member QR scan → check-in success flash → auto-reset.
  4. Same QR again → "already checked in" flash.
  5. Register tab → pick upcoming event → scan QR → `event_registrations` row with `status='registered'` and correct `member_id`.
  6. Same QR again for same event → "already registered" message, still one row.
  7. No-event-today state renders when applicable.

## Out of scope (v1)

- Fullscreen/idle-loop kiosk mode, screen wake lock, auto-advancing carousel
- Post-check-in "register for upcoming?" prompt
- Guest QR issuance
- Separate `/kiosk` route (revisit if the entrance line needs a dedicated fullscreen UX)
