# Public Event Registration Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public visitors and members can register for published events at registration.jlycc.org, with server-side member matching and guest `pending_review` fallback.

**Architecture:** Next.js Server Action using a service-role Supabase client performs matching + insert (no anon RLS writes). Migration 014 adds guest columns to `event_registrations` and a security-definer matching RPC. Public pages open via middleware `publicPaths`; scanner routes stay auth-gated.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Zod, React Hook Form, Supabase (pnpm/Turborepo monorepo at `C:\Users\Admin\Desktop\App\jlycc-platform`).

**Spec:** `docs/superpowers/specs/2026-07-02-public-registration-flow-design.md`

> **Commit policy note:** This repo has NO git repository, and the user's global rules forbid auto-commits. Tasks therefore end with a **Checkpoint** (typecheck/test/build) instead of a commit. After the user reviews the finished work, they may `git init` and commit once.
>
> **Prod DB note:** Task 8 applies migration 014 to the live Supabase project `gadjquxavyxsftnwurfo`. STOP and get explicit user confirmation before running it. Everything in 014 is additive/idempotent.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/014_guest_registrations.sql` | create | Guest columns, `pending_review` status, dup indexes, match RPC |
| `packages/supabase/src/admin.ts` | create | Server-only service-role client |
| `packages/supabase/package.json` | modify | Export `./admin` |
| `packages/types/src/index.ts` | modify | `EventRegistration`, extended `ChurchEvent` fields used by detail page |
| `apps/registration/lib/registration/schema.ts` | create | Zod schema + `normalizePhone` (pure, testable) |
| `apps/registration/lib/registration/schema.test.ts` | create | Unit tests |
| `apps/registration/lib/registration/actions.ts` | create | `registerForEvent` server action |
| `apps/registration/middleware.ts` | modify | Public paths + scanner protection |
| `apps/registration/app/scanner/page.tsx` | create | Old home content (staff event list w/ Scan/Manual) |
| `apps/registration/app/page.tsx` | rewrite | Public event listing |
| `apps/registration/app/events/[id]/page.tsx` | create | Public event detail |
| `apps/registration/app/events/[id]/register/page.tsx` | create | Server wrapper fetching event |
| `apps/registration/app/events/[id]/register/registration-form.tsx` | create | Client form (RHF + Zod) |
| `apps/registration/app/register/success/page.tsx` | create | Confirmation page |
| `apps/registration/package.json` | modify | Add zod, react-hook-form, @hookform/resolvers, vitest |
| `apps/registration/.env.local` | modify | Add `SUPABASE_SERVICE_ROLE_KEY` (user supplies value) |

---

### Task 1: Migration 014 (file only — applied in Task 8)

**Files:**
- Create: `supabase/migrations/014_guest_registrations.sql`

- [ ] **Step 1: Write migration**

```sql
-- 014_guest_registrations.sql
-- Guest (non-member) event registrations. Additive + idempotent.
-- Spec: docs/superpowers/specs/2026-07-02-public-registration-flow-design.md

-- member_id becomes nullable (guests have no member row yet)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'event_registrations'
      and column_name = 'member_id' and is_nullable = 'NO'
  ) then
    alter table public.event_registrations alter column member_id drop not null;
  end if;
end $$;

alter table public.event_registrations add column if not exists guest_first_name text;
alter table public.event_registrations add column if not exists guest_last_name  text;
alter table public.event_registrations add column if not exists guest_middle_name text;
alter table public.event_registrations add column if not exists guest_nickname  text;
alter table public.event_registrations add column if not exists guest_email     text;
alter table public.event_registrations add column if not exists guest_mobile    text;
alter table public.event_registrations add column if not exists guest_gender    text;
alter table public.event_registrations add column if not exists guest_birthday  date;
alter table public.event_registrations add column if not exists guest_address   text;
alter table public.event_registrations add column if not exists emergency_contact text;
alter table public.event_registrations add column if not exists is_first_time   boolean not null default false;
alter table public.event_registrations add column if not exists heard_about     text;
alter table public.event_registrations add column if not exists consent_given   boolean not null default false;

-- status: add 'pending_review'
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'event_registrations_status_check'
      and conrelid = 'public.event_registrations'::regclass
  ) then
    alter table public.event_registrations drop constraint event_registrations_status_check;
  end if;
  alter table public.event_registrations add constraint event_registrations_status_check
    check (status in ('registered','waitlisted','cancelled','attended','no_show','pending_review'));
end $$;

-- a row must identify someone: linked member OR guest name
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_registrations_identity_check'
      and conrelid = 'public.event_registrations'::regclass
  ) then
    alter table public.event_registrations add constraint event_registrations_identity_check
      check (member_id is not null or (guest_first_name is not null and guest_last_name is not null));
  end if;
end $$;

-- duplicate guest submissions blocked per event
create unique index if not exists event_reg_guest_email_uniq
  on public.event_registrations (event_id, lower(guest_email))
  where guest_email is not null and member_id is null;
create unique index if not exists event_reg_guest_mobile_uniq
  on public.event_registrations (event_id, guest_mobile)
  where guest_mobile is not null and member_id is null;

-- exact email OR normalized-phone member matching (service role only)
create or replace function public.match_registration_member(p_email text, p_phone text)
returns table (id uuid)
language sql stable security definer set search_path = public as $$
  select m.id from public.members m
  where (nullif(trim(p_email), '') is not null
         and lower(m.email) = lower(trim(p_email)))
     or (length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 7
         and right(regexp_replace(coalesce(m.phone, ''), '\D', '', 'g'), 10)
           = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
         and length(regexp_replace(coalesce(m.phone, ''), '\D', '', 'g')) >= 7)
$$;
revoke execute on function public.match_registration_member(text, text) from public, anon, authenticated;
```

- [ ] **Step 2: Sanity-check SQL is idempotent** — read it back; every statement guarded (`if not exists` / DO block / `create or replace`). Do NOT apply yet.

---

### Task 2: Service-role admin client

**Files:**
- Create: `packages/supabase/src/admin.ts`
- Modify: `packages/supabase/package.json`

- [ ] **Step 1: Write `admin.ts`**

```ts
import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client. Server Actions / route handlers ONLY.
 * Bypasses RLS — never let values derived from it leak member PII to responses.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY / URL not configured');
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 2: Add export to `packages/supabase/package.json`** — in `exports`, add `"./admin": "./src/admin.ts"`, and add `"server-only": "^0.0.1"` to `dependencies`.

- [ ] **Step 3: Install** — run `pnpm install` at repo root. Expected: lockfile updated, no errors.

- [ ] **Step 4: Checkpoint** — `cd apps/registration && pnpm typecheck`. Expected: PASS (no consumers yet).

---

### Task 3: Types + validation schema (TDD)

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `apps/registration/package.json`
- Create: `apps/registration/lib/registration/schema.ts`
- Create: `apps/registration/lib/registration/schema.test.ts`

- [ ] **Step 1: Add deps** — in `apps/registration`: `pnpm add zod react-hook-form @hookform/resolvers && pnpm add -D vitest`. Add script `"test": "vitest run"`.

- [ ] **Step 2: Extend `packages/types/src/index.ts`** — append:

```ts
export type RegistrationStatus =
  | 'registered' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show' | 'pending_review';

export interface EventRegistration {
  id: string;
  event_id: string;
  member_id: string | null;
  status: RegistrationStatus;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_mobile: string | null;
  is_first_time: boolean;
  heard_about: string | null;
  consent_given: boolean;
  registered_at: string;
}
```

Also extend `ChurchEvent` with fields the detail page renders: add `venue: string | null` (exists), plus `capacity: number | null; network_id: string | null; ministry_id: string | null; requirement_id: string | null;`.

- [ ] **Step 3: Write failing tests** — `lib/registration/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizePhone, registrationSchema } from './schema';

describe('normalizePhone', () => {
  it('strips non-digits and keeps last 10', () => {
    expect(normalizePhone('+63 917-123-4567')).toBe('9171234567');
  });
  it('returns short numbers as-is (digits only)', () => {
    expect(normalizePhone('12345')).toBe('12345');
  });
});

describe('registrationSchema', () => {
  const valid = {
    first_name: 'Ana', last_name: 'Cruz', mobile: '09171234567',
    email: 'ana@example.com', is_first_time: true, consent_given: true,
  };
  it('accepts a minimal valid payload', () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects when consent is false', () => {
    expect(registrationSchema.safeParse({ ...valid, consent_given: false }).success).toBe(false);
  });
  it('rejects invalid email', () => {
    expect(registrationSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
  });
  it('rejects mobile with fewer than 7 digits', () => {
    expect(registrationSchema.safeParse({ ...valid, mobile: '123' }).success).toBe(false);
  });
});
```

- [ ] **Step 4: Run to verify failure** — `pnpm test`. Expected: FAIL (`./schema` not found).

- [ ] **Step 5: Implement `lib/registration/schema.ts`**

```ts
import { z } from 'zod';

/** Digits only, last 10 (PH numbers: 0917... / +63917... both → 9171234567). */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(-10);
}

export const registrationSchema = z.object({
  first_name: z.string().trim().min(1, 'Required'),
  last_name: z.string().trim().min(1, 'Required'),
  middle_name: z.string().trim().optional().or(z.literal('')),
  nickname: z.string().trim().optional().or(z.literal('')),
  mobile: z.string().refine((v) => v.replace(/\D/g, '').length >= 7, 'Enter a valid mobile number'),
  email: z.string().trim().email('Enter a valid email'),
  gender: z.enum(['male', 'female']).optional(),
  birthday: z.string().optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
  emergency_contact: z.string().trim().optional().or(z.literal('')),
  is_first_time: z.boolean(),
  heard_about: z.string().trim().optional().or(z.literal('')),
  consent_given: z.literal(true, { errorMap: () => ({ message: 'Consent is required' }) }),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
```

- [ ] **Step 6: Run tests** — `pnpm test`. Expected: all PASS.
- [ ] **Step 7: Checkpoint** — `pnpm typecheck`. Expected: PASS.

---

### Task 4: Server action

**Files:**
- Create: `apps/registration/lib/registration/actions.ts`
- Modify: `apps/registration/.env.local` (add `SUPABASE_SERVICE_ROLE_KEY=` — **ask user for the value**; do not invent it)

- [ ] **Step 1: Write `lib/registration/actions.ts`**

```ts
'use server';

import { createAdminClient } from '@jlycc/supabase/admin';
import { registrationSchema, type RegistrationInput } from './schema';

export type RegisterResult =
  | { ok: true; matched: boolean; duplicate?: boolean }
  | { ok: false; error: string };

export async function registerForEvent(
  eventId: string,
  input: RegistrationInput
): Promise<RegisterResult> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the form and try again.' };
  const data = parsed.data;

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select('id, is_published, is_active, requires_registration, starts_at')
    .eq('id', eventId)
    .single();
  if (!event || !event.is_published || !event.is_active)
    return { ok: false, error: 'This event is not open for registration.' };
  if (!event.requires_registration)
    return { ok: false, error: 'This event does not require registration — just come!' };
  if (new Date(event.starts_at).getTime() < Date.now() - 6 * 3600_000)
    return { ok: false, error: 'This event has already ended.' };

  const { data: matches, error: matchErr } = await admin.rpc('match_registration_member', {
    p_email: data.email,
    p_phone: data.mobile,
  });
  if (matchErr) return { ok: false, error: 'Something went wrong. Please try again.' };

  const matchedId = matches?.length === 1 ? (matches[0] as { id: string }).id : null;

  const row = matchedId
    ? { event_id: eventId, member_id: matchedId, status: 'registered',
        is_first_time: data.is_first_time, heard_about: data.heard_about || null,
        consent_given: true }
    : { event_id: eventId, member_id: null, status: 'pending_review',
        guest_first_name: data.first_name, guest_last_name: data.last_name,
        guest_middle_name: data.middle_name || null, guest_nickname: data.nickname || null,
        guest_email: data.email.toLowerCase(), guest_mobile: data.mobile,
        guest_gender: data.gender ?? null, guest_birthday: data.birthday || null,
        guest_address: data.address || null, emergency_contact: data.emergency_contact || null,
        is_first_time: data.is_first_time, heard_about: data.heard_about || null,
        consent_given: true };

  const { error: insErr } = await admin.from('event_registrations').insert(row);
  if (insErr) {
    if (insErr.code === '23505')
      return { ok: true, matched: !!matchedId, duplicate: true }; // already registered — treat as success
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
  return { ok: true, matched: !!matchedId };
}
```

- [ ] **Step 2: Ask user for `SUPABASE_SERVICE_ROLE_KEY`** and append to `apps/registration/.env.local`. (Blocking — cannot test the action live without it. File-writing tasks 5–7 can proceed while waiting.)

- [ ] **Step 3: Checkpoint** — `pnpm typecheck`. Expected: PASS.

---

### Task 5: Middleware + route split (`/` public, `/scanner` gated)

**Files:**
- Modify: `apps/registration/middleware.ts`
- Create: `apps/registration/app/scanner/page.tsx`
- Rewrite: `apps/registration/app/page.tsx`

- [ ] **Step 1: Rewrite `middleware.ts`**

```ts
import { updateSession } from '@jlycc/supabase/middleware';
import type { NextRequest } from 'next/server';

// scanner tooling stays auth-gated even though /events/* is public
const PROTECTED = [/^\/scanner(\/|$)/, /^\/events\/[^/]+\/(scan|manual)(\/|$)/, /^\/my-/];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((r) => r.test(path));
  return updateSession(request, {
    publicPaths: isProtected ? ['/login', '/auth'] : ['/login', '/auth', '/', '/events', '/register'],
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

Note: when `isProtected`, `/` is not in publicPaths but the regexes only match protected routes, so the narrow list only applies to them. `/my-qr` was previously gated by default-deny; keep it gated via the `/my-` regex.

- [ ] **Step 2: Create `app/scanner/page.tsx`** — move the ENTIRE current contents of `app/page.tsx` here unchanged, except: rename component to `ScannerHomePage`, change heading to `Scanner — events next 7 days`, and drop the `is_active` filter change (keep query identical).

- [ ] **Step 3: Rewrite `app/page.tsx`** (public listing)

```tsx
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
```

- [ ] **Step 4: Checkpoint** — `pnpm typecheck && pnpm dev` (port 3005): `/` renders anonymously (published events only), `/scanner` redirects anon → `/login?next=/scanner`, `/events/<id>/scan` redirects anon → login.

---

### Task 6: Event detail page

**Files:**
- Create: `apps/registration/app/events/[id]/page.tsx`

- [ ] **Step 1: Write page**

```tsx
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
```

- [ ] **Step 2: Checkpoint** — typecheck; in dev, published event renders w/ Register button; `requires_registration=false` event shows "just come"; random UUID → 404.

---

### Task 7: Registration form + success page

**Files:**
- Create: `apps/registration/app/events/[id]/register/page.tsx`
- Create: `apps/registration/app/events/[id]/register/registration-form.tsx`
- Create: `apps/registration/app/register/success/page.tsx`

- [ ] **Step 1: Server wrapper `register/page.tsx`**

```tsx
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
```

- [ ] **Step 2: Client form `registration-form.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registrationSchema, type RegistrationInput } from '../../../../lib/registration/schema';
import { registerForEvent } from '../../../../lib/registration/actions';

const HEARD_OPTIONS = ['Friend or family', 'Facebook', 'Church announcement', 'Walked by', 'Other'];

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

const input = 'w-full rounded-lg border px-3 py-2';

export function RegistrationForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<RegistrationInput>({
      resolver: zodResolver(registrationSchema),
      defaultValues: { is_first_time: false },
    });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const res = await registerForEvent(eventId, values);
    if (!res.ok) { setServerError(res.error); return; }
    router.push(`/register/success?matched=${res.matched}${res.duplicate ? '&dup=1' : ''}`);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      {serverError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name *" error={errors.first_name?.message}>
          <input className={input} {...register('first_name')} /></Field>
        <Field label="Last name *" error={errors.last_name?.message}>
          <input className={input} {...register('last_name')} /></Field>
        <Field label="Middle name"><input className={input} {...register('middle_name')} /></Field>
        <Field label="Nickname"><input className={input} {...register('nickname')} /></Field>
      </div>

      <Field label="Mobile number *" error={errors.mobile?.message}>
        <input className={input} type="tel" placeholder="0917 123 4567" {...register('mobile')} /></Field>
      <Field label="Email *" error={errors.email?.message}>
        <input className={input} type="email" {...register('email')} /></Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Gender">
          <select className={input} {...register('gender')}>
            <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
          </select></Field>
        <Field label="Birthday"><input className={input} type="date" {...register('birthday')} /></Field>
      </div>

      <Field label="Address"><input className={input} {...register('address')} /></Field>
      <Field label="Emergency contact (name & number)">
        <input className={input} {...register('emergency_contact')} /></Field>

      <Field label="How did you hear about this event?">
        <select className={input} {...register('heard_about')}>
          <option value="">—</option>
          {HEARD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select></Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('is_first_time')} />
        This is my first time attending JLYCC
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" {...register('consent_given')} />
        <span>I consent to JLYCC collecting and using my information for event registration and
          follow-up, in line with the Data Privacy Act. *</span>
      </label>
      {errors.consent_given && <p className="text-sm text-red-600">{errors.consent_given.message}</p>}

      <button disabled={isSubmitting}
        className="w-full rounded-lg bg-[#1F8A8B] px-6 py-3 font-semibold text-white disabled:opacity-50">
        {isSubmitting ? 'Submitting…' : 'Submit registration'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Success page `app/register/success/page.tsx`**

```tsx
import Link from 'next/link';

export default async function SuccessPage({
  searchParams,
}: { searchParams: Promise<{ matched?: string; dup?: string }> }) {
  const { matched, dup } = await searchParams;
  const isDup = dup === '1';
  const isMatched = matched === 'true';

  return (
    <div className="mx-auto max-w-xl rounded-xl border bg-white p-8 text-center shadow-sm">
      <p className="text-4xl">🎉</p>
      <h1 className="mt-2 text-2xl font-bold text-[#1F8A8B]">
        {isDup ? "You're already registered!" : 'Registration received!'}
      </h1>
      <p className="mt-2 text-gray-600">
        {isDup
          ? 'We already have your registration for this event — see you there.'
          : isMatched
            ? "You're all set — see you at the event!"
            : 'Thank you! Our team will confirm your registration shortly.'}
      </p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-[#1F8A8B] px-6 py-3 font-semibold text-white">
        Back to events
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Checkpoint** — `pnpm typecheck && pnpm test`. Expected: PASS.

---

### Task 8: Apply migration to prod — **USER GATE**

- [ ] **Step 1: STOP. Show the user migration 014 and get explicit confirmation** to apply against live project `gadjquxavyxsftnwurfo`.

- [ ] **Step 2: Apply** the same way migrations 001–013 were applied (Supabase SQL editor by the user, or `npx supabase db push` if CLI is linked). If no CLI link exists, hand the user the SQL to paste into the SQL editor.

- [ ] **Step 3: Verify live** (anon key, should show new columns exist but rows hidden by RLS):

```bash
curl -s "https://gadjquxavyxsftnwurfo.supabase.co/rest/v1/event_registrations?select=id,guest_email,is_first_time&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -w "\nHTTP:%{http_code}\n"
```
Expected: `[] HTTP:200` (columns valid, no anon-readable rows). A 400 mentioning an unknown column means the migration didn't apply.

---

### Task 9: End-to-end verification (spec testing checklist)

- [ ] **Step 1:** `pnpm dev` in `apps/registration`; ensure `.env.local` has the service-role key.
- [ ] **Step 2:** Anon `/`: only published+active events listed.
- [ ] **Step 3:** Unpublished event direct URL → 404.
- [ ] **Step 4:** Register with an email that matches NO member → success page "will confirm" variant; verify row: `status='pending_review'`, `member_id is null` (check via service-role query or dashboard).
- [ ] **Step 5:** Register with an email matching exactly ONE member → "all set" variant; row has `member_id`, `status='registered'`.
- [ ] **Step 6:** Submit the same guest again for the same event → "already registered" page, still one row.
- [ ] **Step 7:** Consent unchecked → client blocks; also POST action directly with `consent_given:false` → `{ok:false}`.
- [ ] **Step 8:** Anon `/scanner`, `/events/<id>/scan`, `/my-qr` → all redirect to `/login`.
- [ ] **Step 9:** Logged-in staff `/scanner` → old scan/manual flow works unchanged.
- [ ] **Step 10:** `pnpm build` → succeeds. Report results to user; offer git init + reviewed commit.
