-- 006_member_profile_extensions.sql
-- Normalized storage for Member Information Card fields not already in members.

create table if not exists public.member_spiritual_profiles (
  id                     uuid primary key default gen_random_uuid(),
  member_id              uuid not null unique references public.members(id) on delete cascade,
  year_saved             integer,
  year_water_baptized    integer,
  year_holy_spirit_baptized integer,
  places                 text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.member_education_profiles (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null unique references public.members(id) on delete cascade,
  highest_education  text,
  school_name        text,
  course             text,
  year_completed     text,
  school_address     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.member_work_profiles (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null unique references public.members(id) on delete cascade,
  occupation    text,
  office_name   text,
  office_address text,
  office_phone  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.skills (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,   -- singing, dancing, teaching, ...
  name       text not null,
  category   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.member_skills (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  skill_id   uuid not null references public.skills(id) on delete cascade,
  proficiency text,
  notes      text,
  created_at timestamptz not null default now(),
  unique (member_id, skill_id)
);
create index if not exists member_skills_member_idx on public.member_skills (member_id);

create table if not exists public.member_consents (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  consent_type text not null default 'data_privacy',
  granted      boolean not null default false,
  granted_at   timestamptz,
  revoked_at   timestamptz,
  signature_ref text,               -- scan/photo reference of signed card
  version      text,               -- privacy policy version
  created_at   timestamptz not null default now(),
  unique (member_id, consent_type)
);
