-- 004_events_attendance.sql
-- Events, registrations, QR attendance. Duplicate check-in blocked by unique(event_id, member_id).

create table if not exists public.events (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  event_type     text not null default 'service'
                 check (event_type in ('service','class','conference','heartlink','outreach','training','other')),
  requirement_id uuid references public.journey_requirements(id) on delete set null, -- attendance = evidence for this requirement
  ministry_id    uuid references public.ministries(id) on delete set null,
  network_id     uuid references public.networks(id) on delete set null,
  heartlink_id   uuid references public.heartlinks(id) on delete set null,
  venue          text,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  capacity       integer,
  requires_registration boolean not null default false,
  allow_walk_in  boolean not null default true,
  is_published   boolean not null default false,
  is_active      boolean not null default true,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_requirement_idx on public.events (requirement_id);

create table if not exists public.event_registrations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  member_id     uuid not null references public.members(id) on delete cascade,
  status        text not null default 'registered'
                check (status in ('registered','waitlisted','cancelled','attended','no_show')),
  registered_at timestamptz not null default now(),
  registered_by uuid references auth.users(id),   -- null = self-registered
  notes         text,
  unique (event_id, member_id)
);
create index if not exists event_registrations_event_idx on public.event_registrations (event_id);
create index if not exists event_registrations_member_idx on public.event_registrations (member_id);

create table if not exists public.attendance_logs (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  member_id     uuid not null references public.members(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  method        text not null default 'qr' check (method in ('qr','manual','kiosk')),
  scanned_by    uuid references auth.users(id),
  device_info   text,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (event_id, member_id)                    -- prevents duplicate check-in
);
create index if not exists attendance_logs_member_idx on public.attendance_logs (member_id);
create index if not exists attendance_logs_event_idx on public.attendance_logs (event_id);
create index if not exists attendance_logs_checked_in_idx on public.attendance_logs (checked_in_at);
