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
