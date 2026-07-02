-- 002_networks_ministries_heartlinks.sql
-- Organization structure: networks, ministries, member_ministries, heartlinks, member_heartlinks.

create table if not exists public.networks (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  head_member_id uuid references public.members(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.ministries (
  id          uuid primary key default gen_random_uuid(),
  network_id  uuid not null references public.networks(id) on delete restrict,
  code        text not null unique,
  name        text not null,
  description text,
  head_member_id uuid references public.members(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ministries_network_id_idx on public.ministries (network_id);

-- member can belong to multiple ministries, with priority 1..3
create table if not exists public.member_ministries (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  priority    smallint not null default 1 check (priority between 1 and 3),
  is_active   boolean not null default true,
  joined_on   date default current_date,
  left_on     date,
  assigned_by uuid references auth.users(id),
  notes       text,
  import_source text,
  created_at  timestamptz not null default now(),
  unique (member_id, ministry_id)
);
create index if not exists member_ministries_member_idx on public.member_ministries (member_id);
create index if not exists member_ministries_ministry_idx on public.member_ministries (ministry_id);
-- one active assignment per priority slot per member
create unique index if not exists member_ministries_priority_slot_key
  on public.member_ministries (member_id, priority) where is_active;

-- HeartLink small groups
create table if not exists public.heartlinks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  network_id  uuid references public.networks(id) on delete set null,
  leader_member_id uuid references public.members(id) on delete set null,
  schedule    text,
  location    text,
  is_active   boolean not null default true,
  import_source text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists heartlinks_name_key on public.heartlinks (lower(name));
create index if not exists heartlinks_network_idx on public.heartlinks (network_id);

-- history preserved: one row per membership period; left_on null = current
create table if not exists public.member_heartlinks (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  heartlink_id uuid not null references public.heartlinks(id) on delete cascade,
  is_primary   boolean not null default true,
  joined_on    date default current_date,
  left_on      date,
  assigned_by  uuid references auth.users(id),
  notes        text,
  import_source text,
  created_at   timestamptz not null default now()
);
create index if not exists member_heartlinks_member_idx on public.member_heartlinks (member_id);
create index if not exists member_heartlinks_heartlink_idx on public.member_heartlinks (heartlink_id);
-- at most one ACTIVE primary heartlink per member; history rows keep left_on set
create unique index if not exists member_heartlinks_one_active_primary_key
  on public.member_heartlinks (member_id) where is_primary and left_on is null;
