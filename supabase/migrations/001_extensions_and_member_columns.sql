-- 001_extensions_and_member_columns.sql
-- Safe, idempotent. Extends public.members without touching existing columns.
-- Does NOT modify members.status (member_status enum) — journey uses new journey_status column.

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- The migration chain must bootstrap a fresh database before extending members.
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  surname text,
  email text,
  phone text,
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- These tables are legacy sources referenced by later hardening/report migrations.
-- Create only when absent; existing production tables are extended in place.
create table if not exists public.offerings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  giving_date date,
  name text,
  email text
);

create table if not exists public.follow_up_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  logged_by uuid references auth.users(id) on delete set null,
  date date not null default current_date,
  method text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- members: new columns (all additive)
-- ---------------------------------------------------------------------------
alter table public.members add column if not exists auth_user_id uuid;
alter table public.members add column if not exists journey_status text;          -- FTV / OGV / RM / AM
alter table public.members add column if not exists member_code text;             -- human-readable id e.g. JLY-00001
alter table public.members add column if not exists qr_code_value text;           -- opaque token, no PII
alter table public.members add column if not exists current_journey_stage_id uuid; -- FK added in 003
alter table public.members add column if not exists surname text;
alter table public.members add column if not exists first_name text;
alter table public.members add column if not exists middle_name text;
alter table public.members add column if not exists nickname text;
alter table public.members add column if not exists zip_code text;
alter table public.members add column if not exists telephone text;

-- journey_status check constraint (nullable — unknown until synced/assigned)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'members_journey_status_check' and conrelid = 'public.members'::regclass
  ) then
    alter table public.members
      add constraint members_journey_status_check
      check (journey_status is null or journey_status in ('FTV','OGV','RM','AM'));
  end if;
end $$;

-- link future auth users to members (nullable; matched by email or admin action)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'members_auth_user_id_fkey' and conrelid = 'public.members'::regclass
  ) then
    alter table public.members
      add constraint members_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

create unique index if not exists members_member_code_key
  on public.members (member_code) where member_code is not null;
create unique index if not exists members_qr_code_value_key
  on public.members (qr_code_value) where qr_code_value is not null;
create unique index if not exists members_auth_user_id_key
  on public.members (auth_user_id) where auth_user_id is not null;
create index if not exists members_journey_status_idx on public.members (journey_status);
create index if not exists members_email_lower_idx on public.members (lower(email)) where email is not null;
