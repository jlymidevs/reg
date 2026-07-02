-- 003_djourney.sql
-- D-Journey Guide: stages, requirements, per-member progress, requirement completions, certificates.
-- Completion is MANUAL-approval based; QR attendance is supporting evidence only.

create table if not exists public.journey_stages (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- GOOD_NEWS, SAINT, SHEEP, SON, SERVANT, SOJOURNER
  name        text not null,
  tagline     text,                          -- e.g. "Engage Christ and Community"
  sort_order  integer not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.journey_requirements (
  id          uuid primary key default gen_random_uuid(),
  stage_id    uuid not null references public.journey_stages(id) on delete cascade,
  code        text not null unique,          -- e.g. WATER_BAPTISM
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  is_required boolean not null default true,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists journey_requirements_stage_idx on public.journey_requirements (stage_id);

-- one row per member per stage
create table if not exists public.member_journey_progress (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  stage_id     uuid not null references public.journey_stages(id) on delete cascade,
  status       text not null default 'in_progress'
               check (status in ('not_started','in_progress','completed')),
  started_at   date,
  completed_at date,
  approved_by  uuid references auth.users(id),   -- manual stage-completion approval
  approval_request_id uuid,                      -- FK added in 008
  notes        text,
  import_source text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (member_id, stage_id)
);
create index if not exists mjp_member_idx on public.member_journey_progress (member_id);

create table if not exists public.member_requirement_completions (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.members(id) on delete cascade,
  requirement_id uuid not null references public.journey_requirements(id) on delete cascade,
  completed_on   date default current_date,
  evidence_type  text check (evidence_type in ('attendance','certificate','manual','import')),
  evidence_ref   text,                          -- e.g. attendance_logs.id, note, doc link
  approved_by    uuid references auth.users(id),
  approval_request_id uuid,                     -- FK added in 008
  notes          text,
  import_source  text,
  created_at     timestamptz not null default now(),
  unique (member_id, requirement_id)
);
create index if not exists mrc_member_idx on public.member_requirement_completions (member_id);
create index if not exists mrc_requirement_idx on public.member_requirement_completions (requirement_id);

-- optional certificates
create table if not exists public.journey_certificates (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  stage_id    uuid references public.journey_stages(id) on delete set null,
  requirement_id uuid references public.journey_requirements(id) on delete set null,
  title       text not null,
  issued_on   date default current_date,
  issued_by   uuid references auth.users(id),
  file_url    text,
  created_at  timestamptz not null default now()
);
create index if not exists journey_certificates_member_idx on public.journey_certificates (member_id);

-- now that journey_stages exists, wire members.current_journey_stage_id
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'members_current_journey_stage_fkey' and conrelid = 'public.members'::regclass
  ) then
    alter table public.members
      add constraint members_current_journey_stage_fkey
      foreign key (current_journey_stage_id) references public.journey_stages(id) on delete set null;
  end if;
end $$;
create index if not exists members_current_stage_idx on public.members (current_journey_stage_id);
