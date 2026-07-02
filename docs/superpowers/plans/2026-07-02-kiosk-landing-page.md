# Kiosk Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `apps/registration`'s homepage into a flyer-forward landing page with a signed-in kiosk zone: QR self-check-in to today's event + advance registration by member QR scan.

**Architecture:** Zone 1 (public flyer cards) is a server component; zones 2–3 (check-in scanner, register-via-QR) live in one client `KioskZone` component rendered only when the session passes `can_scan()`. New server action `registerByQr` re-verifies auth server-side, then uses the service-role client to resolve `members.qr_code_value` → insert `event_registrations`. Existing `qr-checkin` edge function and `/events/[id]/scan` page are untouched.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Supabase (`@jlycc/supabase/{client,server,admin}`), BarcodeDetector API, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-02-kiosk-landing-page-design.md`

**Verified facts (do not re-derive):**
- `event_registrations` has `unique (event_id, member_id)` (migration 004) → duplicate insert returns Postgres error code `23505`.
- `public.can_scan()` RPC exists (migration 013), `security definer`, granted to `authenticated`, returns boolean.
- `members.qr_code_value` is the opaque QR token column (used by `supabase/functions/qr-checkin/index.ts`).
- `events.image_url` does NOT exist yet (ships later with migration 015 from the admin-dashboard spec) — all code must treat it as optional.
- Repo has git; commit after each task. Push only when the user asks.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/types/src/index.ts` | modify | Add optional `image_url` to `ChurchEvent` |
| `apps/registration/lib/kiosk/today.ts` | create | Pure helpers: today's events, registrable events (testable) |
| `apps/registration/lib/kiosk/today.test.ts` | create | Unit tests for helpers |
| `apps/registration/lib/kiosk/actions.ts` | create | `registerByQr` server action |
| `apps/registration/components/qr-scanner.tsx` | create | Reusable camera scanner (BarcodeDetector + manual fallback) |
| `apps/registration/components/kiosk-zone.tsx` | create | Signed-in zone: Check-in / Register tabs |
| `apps/registration/app/page.tsx` | rewrite | Flyer cards + `<KioskZone>` mount |

---

### Task 1: Types + pure helpers (TDD)

**Files:**
- Modify: `packages/types/src/index.ts` (ChurchEvent interface)
- Create: `apps/registration/lib/kiosk/today.ts`
- Create: `apps/registration/lib/kiosk/today.test.ts`

- [ ] **Step 1: Add `image_url` to `ChurchEvent`** — in `packages/types/src/index.ts`, inside the existing `ChurchEvent` interface, after `requirement_id: string | null;` add:

```ts
  image_url?: string | null;
```

(Optional because the DB column doesn't exist until migration 015; `select('*')` simply won't return it.)

- [ ] **Step 2: Write failing tests** — `apps/registration/lib/kiosk/today.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findTodayEvents, findRegistrableEvents } from './today';
import type { ChurchEvent } from '@jlycc/types';

function ev(overrides: Partial<ChurchEvent>): ChurchEvent {
  return {
    id: 'e1', title: 'T', description: null, event_type: 'service', venue: null,
    starts_at: '2026-07-02T10:00:00+08:00', ends_at: null,
    is_published: true, is_active: true, requires_registration: false,
    allow_walk_in: true, capacity: null, network_id: null, ministry_id: null,
    requirement_id: null,
    ...overrides,
  };
}

const NOW = new Date('2026-07-02T09:00:00+08:00');

describe('findTodayEvents', () => {
  it('includes an event starting later today', () => {
    expect(findTodayEvents([ev({})], NOW)).toHaveLength(1);
  });
  it('excludes tomorrow', () => {
    expect(findTodayEvents([ev({ starts_at: '2026-07-03T10:00:00+08:00' })], NOW)).toHaveLength(0);
  });
  it('includes an event that started earlier today (still checking in)', () => {
    expect(findTodayEvents([ev({ starts_at: '2026-07-02T07:00:00+08:00' })], NOW)).toHaveLength(1);
  });
});

describe('findRegistrableEvents', () => {
  it('includes upcoming requires_registration events', () => {
    expect(
      findRegistrableEvents([ev({ requires_registration: true, starts_at: '2026-07-04T09:00:00+08:00' })], NOW)
    ).toHaveLength(1);
  });
  it('excludes events not requiring registration', () => {
    expect(findRegistrableEvents([ev({})], NOW)).toHaveLength(0);
  });
  it('excludes events already ended (6h grace)', () => {
    expect(
      findRegistrableEvents([ev({ requires_registration: true, starts_at: '2026-07-01T09:00:00+08:00' })], NOW)
    ).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run to verify failure** — `cd apps/registration && pnpm test`. Expected: FAIL (`./today` not found).

- [ ] **Step 4: Implement** — `apps/registration/lib/kiosk/today.ts`:

```ts
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
```

- [ ] **Step 5: Run tests** — `pnpm test`. Expected: all PASS (existing 6 schema tests + 6 new).
- [ ] **Step 6: Typecheck** — `pnpm typecheck`. Expected: PASS.
- [ ] **Step 7: Commit**

```bash
git add packages/types/src/index.ts apps/registration/lib/kiosk/
git commit -m "Add kiosk event helpers and optional event image_url type"
```

---

### Task 2: `registerByQr` server action

**Files:**
- Create: `apps/registration/lib/kiosk/actions.ts`

- [ ] **Step 1: Write the action** — exact content:

```ts
'use server';

import { createAdminClient } from '@jlycc/supabase/admin';
import { createClient } from '@jlycc/supabase/server';

export type QrRegisterResult =
  | { ok: true; memberName: string; duplicate?: boolean }
  | { ok: false; error: string };

export async function registerByQr(eventId: string, qrValue: string): Promise<QrRegisterResult> {
  // security boundary: caller must be signed in AND pass can_scan()
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { ok: false, error: 'Not signed in.' };
  const { data: allowed } = await supabase.rpc('can_scan');
  if (!allowed) return { ok: false, error: 'Not authorized.' };

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select('id, is_published, is_active, requires_registration, starts_at')
    .eq('id', eventId)
    .single();
  if (!event || !event.is_published || !event.is_active)
    return { ok: false, error: 'This event is not open for registration.' };
  if (!event.requires_registration)
    return { ok: false, error: 'This event does not require registration.' };
  if (new Date(event.starts_at).getTime() < Date.now() - 6 * 3600_000)
    return { ok: false, error: 'This event has already ended.' };

  const { data: member } = await admin
    .from('members')
    .select('id, name')
    .eq('qr_code_value', qrValue.trim())
    .maybeSingle();
  if (!member) return { ok: false, error: 'QR code not recognized.' };

  const { error: insErr } = await admin.from('event_registrations').insert({
    event_id: eventId,
    member_id: member.id,
    status: 'registered',
    registered_by: userData.user.id,
  } as never);

  if (insErr) {
    if (insErr.code === '23505') return { ok: true, memberName: member.name, duplicate: true };
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
  return { ok: true, memberName: member.name };
}
```

Note: `as never` on insert matches the existing codebase convention where the row shape can't be inferred (see `lib/registration/actions.ts:71` which uses `as Partial<EventRegistration>`); here the row includes `registered_by` which isn't on `EventRegistration`, so `as never` is acceptable — do not add `registered_by` to the shared type for this.

- [ ] **Step 2: Typecheck** — `pnpm typecheck`. Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add apps/registration/lib/kiosk/actions.ts
git commit -m "Add registerByQr server action for kiosk registration"
```

---

### Task 3: Reusable QR scanner component

**Files:**
- Create: `apps/registration/components/qr-scanner.tsx`

This extracts the camera pattern from `app/events/[id]/scan/page.tsx` into a reusable component. **Do not modify the existing scan page** — it stays as-is (working in prod).

- [ ] **Step 1: Write component** — exact content:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
  detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]>;
};

/**
 * Continuous QR camera scanner with manual-entry fallback.
 * Fires onScan(value) for each detected code; caller handles debouncing duplicates.
 */
export function QrScanner({ onScan, disabled }: { onScan: (value: string) => void; disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (disabled) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function start() {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Detector) {
        setCameraError('This browser has no QR support — use manual entry below (Chrome on Android recommended).');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector({ formats: ['qr_code'] });
        timer = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) onScan(codes[0].rawValue);
          } catch {
            /* frame decode error — keep scanning */
          }
        }, 400);
      } catch {
        setCameraError('Camera unavailable or permission denied — use manual entry below.');
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan, disabled]);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border bg-black">
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
      </div>
      {cameraError && <p className="mt-2 text-sm text-amber-700">{cameraError}</p>}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manualCode.trim()) {
            onScan(manualCode.trim());
            setManualCode('');
          }
        }}
      >
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Paste QR code value manually"
          className="flex-1 rounded-lg border px-3 py-2"
        />
        <button className="rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white">Go</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** — `pnpm typecheck`. Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add apps/registration/components/qr-scanner.tsx
git commit -m "Add reusable QrScanner component"
```

---

### Task 4: KioskZone component (check-in + register tabs)

**Files:**
- Create: `apps/registration/components/kiosk-zone.tsx`

- [ ] **Step 1: Write component** — exact content:

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@jlycc/supabase/client';
import type { ChurchEvent, CheckinResponse } from '@jlycc/types';
import { findTodayEvents, findRegistrableEvents } from '../lib/kiosk/today';
import { registerByQr } from '../lib/kiosk/actions';
import { QrScanner } from './qr-scanner';

type Flash =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; title: string; detail?: string }
  | { kind: 'warn'; title: string; detail?: string }
  | { kind: 'err'; title: string };

const RESET_MS = 3000;

export function KioskZone({ events }: { events: ChurchEvent[] }) {
  const [canScan, setCanScan] = useState(false);
  const [tab, setTab] = useState<'checkin' | 'register'>('checkin');
  const [flash, setFlash] = useState<Flash>({ kind: 'idle' });
  const [checkinEventId, setCheckinEventId] = useState<string | null>(null);
  const [registerEventId, setRegisterEventId] = useState<string | null>(null);
  const lastScanned = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayEvents = findTodayEvents(events, new Date());
  const registrable = findRegistrableEvents(events, new Date());
  const activeCheckinEvent =
    todayEvents.length === 1 ? todayEvents[0] : todayEvents.find((e) => e.id === checkinEventId) ?? null;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) return;
      const { data: allowed } = await supabase.rpc('can_scan');
      if (allowed) setCanScan(true);
    });
  }, []);

  const showFlash = useCallback((f: Flash) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setFlash(f);
    if (f.kind !== 'busy' && f.kind !== 'idle') {
      resetTimer.current = setTimeout(() => setFlash({ kind: 'idle' }), RESET_MS);
    }
  }, []);

  const debounced = useCallback((value: string): boolean => {
    const now = Date.now();
    if (lastScanned.current.code === value && now - lastScanned.current.at < 5000) return true;
    lastScanned.current = { code: value, at: now };
    return false;
  }, []);

  const onCheckinScan = useCallback(
    async (value: string) => {
      if (!activeCheckinEvent || debounced(value)) return;
      showFlash({ kind: 'busy' });
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke<CheckinResponse>('qr-checkin', {
        body: { event_id: activeCheckinEvent.id, qr_code_value: value },
      });
      if (error || !data) return showFlash({ kind: 'err', title: error?.message ?? 'Check-in failed' });
      if (!data.success) return showFlash({ kind: 'err', title: data.error ?? 'Check-in failed' });
      if (data.duplicate)
        return showFlash({
          kind: 'warn',
          title: 'Already checked in',
          detail: data.member?.name,
        });
      showFlash({ kind: 'ok', title: `Welcome, ${data.member?.name ?? 'member'}!`, detail: 'Checked in' });
    },
    [activeCheckinEvent, debounced, showFlash]
  );

  const onRegisterScan = useCallback(
    async (value: string) => {
      if (!registerEventId || debounced(value)) return;
      showFlash({ kind: 'busy' });
      const res = await registerByQr(registerEventId, value);
      if (!res.ok) return showFlash({ kind: 'err', title: res.error });
      if (res.duplicate)
        return showFlash({ kind: 'warn', title: 'Already registered', detail: res.memberName });
      showFlash({ kind: 'ok', title: `Registered: ${res.memberName}`, detail: 'See you there!' });
    },
    [registerEventId, debounced, showFlash]
  );

  if (!canScan) return null;

  return (
    <section className="mt-10 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('checkin')}
          className={`flex-1 rounded-lg px-4 py-3 font-semibold ${tab === 'checkin' ? 'bg-violet-700 text-white' : 'bg-gray-100'}`}
        >
          Check-in
        </button>
        <button
          onClick={() => setTab('register')}
          className={`flex-1 rounded-lg px-4 py-3 font-semibold ${tab === 'register' ? 'bg-[#1F8A8B] text-white' : 'bg-gray-100'}`}
        >
          Register
        </button>
      </div>

      <div className="mb-3 min-h-20">
        {flash.kind === 'busy' && (
          <div className="rounded-xl bg-gray-200 p-4 text-center font-semibold">Working…</div>
        )}
        {flash.kind === 'ok' && (
          <div className="rounded-xl bg-green-600 p-4 text-center text-white">
            <p className="text-xl font-bold">✓ {flash.title}</p>
            {flash.detail && <p className="text-sm opacity-90">{flash.detail}</p>}
          </div>
        )}
        {flash.kind === 'warn' && (
          <div className="rounded-xl bg-amber-500 p-4 text-center text-white">
            <p className="text-xl font-bold">{flash.title}</p>
            {flash.detail && <p className="text-sm opacity-90">{flash.detail}</p>}
          </div>
        )}
        {flash.kind === 'err' && (
          <div className="rounded-xl bg-red-600 p-4 text-center text-white">
            <p className="font-bold">{flash.title}</p>
          </div>
        )}
      </div>

      {tab === 'checkin' &&
        (todayEvents.length === 0 ? (
          <p className="rounded-lg bg-gray-100 p-4 text-center text-gray-500">No event today.</p>
        ) : !activeCheckinEvent ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Which event?</p>
            {todayEvents.map((e) => (
              <button
                key={e.id}
                onClick={() => setCheckinEventId(e.id)}
                className="w-full rounded-lg border p-3 text-left hover:bg-gray-50"
              >
                {e.title} — {new Date(e.starts_at).toLocaleTimeString()}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <p className="mb-2 text-center text-sm text-gray-500">
              Checking in: <span className="font-semibold">{activeCheckinEvent.title}</span>
            </p>
            <QrScanner onScan={onCheckinScan} />
          </div>
        ))}

      {tab === 'register' &&
        (registrable.length === 0 ? (
          <p className="rounded-lg bg-gray-100 p-4 text-center text-gray-500">
            No upcoming events open for registration.
          </p>
        ) : !registerEventId ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Register for which event?</p>
            {registrable.map((e) => (
              <button
                key={e.id}
                onClick={() => setRegisterEventId(e.id)}
                className="w-full rounded-lg border p-3 text-left hover:bg-gray-50"
              >
                {e.title} — {new Date(e.starts_at).toLocaleDateString()}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setRegisterEventId(null)}
              className="mb-2 text-sm text-[#1F8A8B] underline"
            >
              ← change event
            </button>
            <p className="mb-2 text-center text-sm text-gray-500">
              Scan member QR to register for{' '}
              <span className="font-semibold">{registrable.find((e) => e.id === registerEventId)?.title}</span>
            </p>
            <QrScanner onScan={onRegisterScan} />
          </div>
        ))}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck** — `pnpm typecheck`. Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add apps/registration/components/kiosk-zone.tsx
git commit -m "Add KioskZone with check-in and register-by-QR tabs"
```

---

### Task 5: Homepage rebuild (flyer cards + kiosk mount)

**Files:**
- Rewrite: `apps/registration/app/page.tsx`

- [ ] **Step 1: Rewrite** — exact content:

```tsx
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
```

Note: plain `<img>` (not `next/image`) is deliberate — `image_url` will point at Supabase Storage public URLs whose host isn't in `next.config.ts` `images.remotePatterns`; adding that config belongs to the admin-dashboard image-upload work, not this task.

- [ ] **Step 2: Typecheck + tests** — `pnpm typecheck && pnpm test`. Expected: both PASS.
- [ ] **Step 3: Commit**

```bash
git add apps/registration/app/page.tsx
git commit -m "Rebuild homepage as flyer landing with kiosk zone"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1:** `pnpm --filter registration dev` (port 3005).
- [ ] **Step 2:** Anon (incognito): `/` shows flyer/text cards + "Staff sign in" link; NO kiosk zone.
- [ ] **Step 3:** Existing routes still work: `/events/<id>` detail, `/scanner` still redirects anon → login.
- [ ] **Step 4:** Signed in as a scan-rights user: kiosk zone renders with Check-in/Register tabs.
- [ ] **Step 5:** Check-in tab: with a today event present, scanner targets it; scan a member QR (or paste `qr_code_value` manually) → green success flash → auto-resets in ~3s; repeat same QR → amber "Already checked in".
- [ ] **Step 6:** Register tab: pick upcoming `requires_registration` event → scan/paste member QR → green "Registered"; verify `event_registrations` row (`member_id` set, `status='registered'`); repeat → amber "Already registered", still one row.
- [ ] **Step 7:** `registerByQr` with unknown QR value → red "QR code not recognized."
- [ ] **Step 8:** `pnpm build` → succeeds.
- [ ] **Step 9:** Report results; ask user before pushing.

---

## Self-review notes

- Spec coverage: zones 1–3 (Tasks 4–5), auth model incl. server-side re-verification (Task 2), defensive `image_url` (Tasks 1, 5), helpers + tests (Task 1), dedupe via verified 23505 (Task 2), scanner reuse without touching existing scan page (Task 3), E2E checklist mirrors spec's (Task 6). No gaps found.
- Test-data caveat for Task 6: prod DB likely has no today-event or registrable event; creating temp test events in prod requires the user's explicit approval first (same procedure as the previous feature's Task 9).
