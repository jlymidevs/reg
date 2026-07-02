# Public Event Registration Flow — Design

**Date:** 2026-07-02
**App:** `apps/registration` (registration.jlycc.org) in `jlycc-platform` monorepo
**Supabase project:** `gadjquxavyxsftnwurfo` (existing prod — additive changes only)

## Goal

Let anyone — existing member or first-time visitor — register for a published event from a public page, without creating duplicate member records and without exposing member data to the public.

## Context (verified 2026-07-02)

- Migrations 001–013 applied to prod (verified live via REST: `events`, `event_registrations`, `attendance_logs`, journey/network/ministry tables exist; `members` has `journey_status`, `member_code`, `qr_code_value`).
- Built already: `/` (event list w/ scan buttons), `/login`, `/auth/callback`, `/my-qr`, `/events/[id]/scan`, `/events/[id]/manual`.
- Gaps this design fills: `event_registrations.member_id` is NOT NULL (no guest support); RLS has no anon insert path; middleware blocks all routes except `/login` + `/auth`; no public detail/register/success pages.

## Decisions

| Decision | Choice |
|---|---|
| Guest registrations | Nullable `member_id` + guest columns; unmatched guests saved as `pending_review` for admin resolution. No auto-creation of member rows. |
| URL scheme | `/events/[id]` (UUID) — consistent with existing scan/manual routes. No slug column. |
| Member matching | Exact lowercased email OR normalized phone only. Single match → link. No match or multiple matches → guest + `pending_review`. No fuzzy name matching. |
| Write path | Next.js Server Action with service-role client. No anon RLS insert policy. |

## Architecture

### Write path

`registerForEvent` Server Action (server-only file, `import 'server-only'`):

1. Zod-validate payload.
2. Reject if `consent_given` false.
3. Verify event exists, `is_published && is_active`, `requires_registration`, and `starts_at` not past.
4. Service-role query on `public.members`: exact match on `lower(email)` or normalized phone (strip non-digits, compare last 10 digits).
5. Exactly one match → insert registration with `member_id`, `status='registered'`.
6. Zero or 2+ matches → insert guest registration, `status='pending_review'`.
7. Unique-violation (23505) → return friendly "already registered for this event" result, not an error page.
8. Return `{ ok, matched: boolean, registrationId }` → redirect to `/register/success?matched=…`.

Rationale for service role over anon RLS insert: matching/dedup logic stays server-controlled; anon key can never write registrations directly; no member data (email/phone existence) leaks through RLS probing.

`SUPABASE_SERVICE_ROLE_KEY` server env var only (Vercel project env; never `NEXT_PUBLIC_`).

### Migration 014 — `014_guest_registrations.sql` (idempotent, additive)

- `alter table public.event_registrations alter column member_id drop not null;` (wrapped in DO block, only if currently NOT NULL)
- Add columns (`if not exists`): `guest_first_name text`, `guest_last_name text`, `guest_email text`, `guest_mobile text`, `guest_address text`, `is_first_time boolean not null default false`, `heard_about text`, `consent_given boolean not null default false`
- Replace `status` check constraint to add `'pending_review'` (drop+recreate inside DO block guarded by constraint-name lookup)
- Check constraint `event_registrations_identity_check`: `member_id is not null or (guest_first_name is not null and guest_last_name is not null)`
- Partial unique indexes:
  - `create unique index if not exists event_reg_guest_email_uniq on public.event_registrations (event_id, lower(guest_email)) where guest_email is not null and member_id is null;`
  - `create unique index if not exists event_reg_guest_mobile_uniq on public.event_registrations (event_id, guest_mobile) where guest_mobile is not null and member_id is null;`
- No RLS changes needed for insert (service role bypasses RLS). Existing select policies still hold: guests' rows visible only to staff.

### Middleware

`publicPaths` additions: `/`, `/events` (prefix — covers `/events/[id]` and `/events/[id]/register`; scan/manual under same prefix become public *routes* but their data calls still fail without auth — acceptable, they redirect to login on action), `/register`.

If prefix matching makes `/events/[id]/scan` render UI to anon users, gate those two pages with a server-side session check that redirects to `/login`.

### Pages

| Route | Type | Content |
|---|---|---|
| `/` (rework) | server | Public listing: published+active upcoming events; card = title, date/time, venue, type badge, network/ministry badge, "View" link. Scan/Manual buttons removed. |
| `/scanner` (new) | server, auth-gated | Current `/` content (event list with Scan/Manual buttons). Existing scanner users land here. |
| `/events/[id]` | server | Detail: title, description, schedule, venue, badges (event type, network, ministry, journey requirement), Register button (shown when `requires_registration`, published, active, not past). Not-found for unpublished. |
| `/events/[id]/register` | client form | Fields: first/last name (req), middle/nickname (opt), mobile (req), email (req), gender/birthday/address/emergency contact (opt), "first time at JLYCC?" toggle, "how did you hear?" select, consent checkbox (req). React Hook Form + Zod. Submits server action. |
| `/register/success` | server | Confirmation. `matched=true`: "You're registered — see you there." `matched=false`: "Registration received — our team will confirm shortly." Never reveal whether email/phone exists in DB beyond this. |

### Types

Extend `packages/types`: `EventRegistration` row type incl. guest fields + `'pending_review'` status; `RegistrationFormInput` Zod-inferred type in app (Zod schema lives beside server action, shared with client form).

## Error handling

- Zod failure → inline field errors (client) + server re-validation.
- Event closed/unpublished/past → server action returns typed error; form shows banner.
- Duplicate (23505) → success-style message "already registered", no data leak.
- Service-role env missing → action throws at import time (fail fast in build/boot, not per-request).

## Testing checklist (manual)

1. Anon visitor opens `/`, sees only published+active events.
2. Unpublished event id direct URL → 404.
3. Guest registers w/ unknown email → row w/ `pending_review`, null member_id; success page shows "will confirm" variant.
4. Registrant w/ email matching exactly one member → row linked to member_id, `status='registered'`.
5. Same guest submits twice for same event → friendly duplicate message, single row.
6. Consent unchecked → blocked client and server side.
7. Past event → Register button hidden; direct action call rejected.
8. `/events/[id]/scan` as anon → redirected to `/login`.
9. `/scanner` as authenticated staff → old scan workflow intact.

## Out of scope (later specs)

Admin dashboard (event CRUD, pending_review resolution UI, reports, watchlist), `/my-registrations`, `/my-attendance`, D-Journey evidence rows, CSV export.
