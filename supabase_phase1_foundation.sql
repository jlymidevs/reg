-- JLYCC Reg — Phase 1: Foundation (roles, audit log, member classification,
-- activity scoring). Additive only. Run once in Supabase SQL editor AFTER
-- supabase_setup.sql and supabase_registration_v2.sql.
--
-- IMPORTANT — schema discovery: `members` here is the full JLYCC PCM church
-- CRM (44 columns), shared with JLYCC Admin/APP/Events, not an app-local
-- table. It already has its own (messy, legacy-import) classification:
-- `type` (OGV/FTV/AM/RA), `status_in_church`, `journey_status`,
-- `ministry_involvement`, and an `age_group` column that despite its name
-- holds free-text status labels ("Regular", "Seasonal", "Not Attending"),
-- not demographic age. None of that is touched by this migration.
--
-- Because that data is inconsistent and used by other apps, this migration
-- does NOT add columns to `members`. Instead, event-registration-specific
-- classification lives in a new linked table, `event_reg_member_meta`,
-- keyed by member_id. This is additive and fully isolated — zero risk to
-- the shared CRM table or the other apps reading it.
--
-- Assumptions (documented, revisit if wrong):
--   - "no-show" is approximated by status = 'cancelled' on event_registrations
--     until Phase 2 adds a real check_ins table with a distinct no-show state.
--   - Activity score weights are fixed constants in the view below, not yet
--     settings-driven (Phase 11 in the full spec).
--   - A member with no event_reg_member_meta row defaults to
--     member_type='regular_member', is_active=true, communication_consent=true
--     — i.e. everyone starts as a normal, contactable regular member until
--     an admin classifies them otherwise.

-- ---------------------------------------------------------------------------
-- 1. Roles on admin_users (reuses existing table — no new user_roles table)
-- ---------------------------------------------------------------------------
alter table admin_users add column if not exists role text not null default 'admin';
alter table admin_users add constraint admin_users_role_check
  check (role in ('super_admin','admin','event_manager','checkin_staff','finance','viewer','volunteer'));

-- Bootstrap: existing admins keep working. Promote at least one manually to
-- super_admin after running this, e.g.:
--   update admin_users set role = 'super_admin' where email = 'you@jlycc.org';

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'super_admin'
  );
$$;

grant execute on function public.is_super_admin to authenticated;

create or replace function public.get_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from admin_users
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

grant execute on function public.get_admin_role to authenticated;

drop policy if exists "super_admin_manage_admin_users" on admin_users;
create policy "super_admin_manage_admin_users" on admin_users
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 2. Event-registration member classification — isolated linked table,
--    NOT columns on the shared `members` CRM table (see note above).
-- ---------------------------------------------------------------------------
create table if not exists event_reg_member_meta (
  member_id uuid primary key references members(id) on delete cascade,
  member_type text not null default 'regular_member'
    check (member_type in ('regular_member','new_member','visitor','volunteer','leader','guest')),
  tags text[] not null default '{}',
  ministry_group text,
  age_bracket text
    check (age_bracket is null or age_bracket in ('child','youth','young_adult','adult','senior','prefer_not_to_say')),
  communication_consent boolean not null default true,
  unsubscribed boolean not null default false,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table event_reg_member_meta enable row level security;

drop policy if exists "reg_admin_manage_member_meta" on event_reg_member_meta;
create policy "reg_admin_manage_member_meta" on event_reg_member_meta
  for all to authenticated
  using (public.is_reg_admin()) with check (public.is_reg_admin());

-- ---------------------------------------------------------------------------
-- 3. Audit log (append-only; inserts happen via SECURITY DEFINER trigger,
--    so no direct insert policy is granted to any role)
-- ---------------------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  action_type text not null,
  target_type text not null,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);
create index if not exists audit_logs_target_idx on audit_logs (target_type, target_id);

alter table audit_logs enable row level security;

drop policy if exists "reg_admin_select_audit_logs" on audit_logs;
create policy "reg_admin_select_audit_logs" on audit_logs
  for select to authenticated using (public.is_reg_admin());
-- No insert/update/delete policy for any role — writes only via the
-- SECURITY DEFINER trigger function below, which bypasses RLS as the
-- function owner. Logs cannot be edited or deleted through the API.

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := coalesce(auth.jwt() ->> 'email', 'system');
begin
  if tg_op = 'INSERT' then
    insert into audit_logs (actor_email, action_type, target_type, target_id, new_value)
    values (v_actor, tg_op, tg_table_name, new.id, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_logs (actor_email, action_type, target_type, target_id, old_value, new_value)
    values (v_actor, tg_op, tg_table_name, new.id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into audit_logs (actor_email, action_type, target_type, target_id, old_value)
    values (v_actor, tg_op, tg_table_name, old.id, to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

-- event_reg_member_meta has no `id` column (member_id is the PK) — use a
-- dedicated trigger function so target_id resolves correctly.
create or replace function public.log_audit_event_member_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := coalesce(auth.jwt() ->> 'email', 'system');
begin
  if tg_op = 'INSERT' then
    insert into audit_logs (actor_email, action_type, target_type, target_id, new_value)
    values (v_actor, tg_op, tg_table_name, new.member_id, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_logs (actor_email, action_type, target_type, target_id, old_value, new_value)
    values (v_actor, tg_op, tg_table_name, new.member_id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into audit_logs (actor_email, action_type, target_type, target_id, old_value)
    values (v_actor, tg_op, tg_table_name, old.member_id, to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_admin_users on admin_users;
create trigger audit_admin_users
  after insert or update or delete on admin_users
  for each row execute function public.log_audit_event();

drop trigger if exists audit_events on events;
create trigger audit_events
  after insert or update or delete on events
  for each row execute function public.log_audit_event();

drop trigger if exists audit_event_registrations on event_registrations;
create trigger audit_event_registrations
  after insert or update or delete on event_registrations
  for each row execute function public.log_audit_event();

drop trigger if exists audit_event_reg_member_meta on event_reg_member_meta;
create trigger audit_event_reg_member_meta
  after insert or update or delete on event_reg_member_meta
  for each row execute function public.log_audit_event_member_meta();

-- ---------------------------------------------------------------------------
-- 4. Activity scoring — computed view, nothing persisted. Weights are v1
--    heuristics (see assumptions above); does NOT use age, gender, or
--    donation data per the church's activity-scoring rules.
-- ---------------------------------------------------------------------------
create or replace view public.member_activity_summary_view
with (security_invoker = true) as
with base as (
  select
    m.id as member_id,
    m.first_name,
    m.surname,
    coalesce(meta.member_type, 'regular_member') as member_type,
    meta.ministry_group,
    count(*) filter (where r.status = 'attended' and r.registered_at >= now() - interval '90 days') as attended_90d,
    count(*) filter (
      where r.status = 'attended'
        and r.registered_at >= now() - interval '180 days'
        and r.registered_at < now() - interval '90 days'
    ) as attended_prev_90d,
    count(*) filter (where r.registered_at >= now() - interval '90 days') as registrations_90d,
    count(*) filter (where r.status = 'attended') as attended_total,
    count(*) filter (where r.status = 'cancelled') as cancelled_total, -- no-show proxy until Phase 2 check_ins
    max(r.registered_at) filter (where r.status = 'attended') as last_attended_at
  from members m
  left join event_registrations r on r.member_id = m.id
  left join event_reg_member_meta meta on meta.member_id = m.id
  group by m.id, m.first_name, m.surname, meta.member_type, meta.ministry_group
),
scored as (
  select
    *,
    least(40, attended_90d * 10)
      + least(15, registrations_90d * 5)
      + (case when ministry_group is not null then 15 else 0 end)
      + (case when member_type = 'volunteer' then 15 else 0 end)
      + (case
          when attended_90d > attended_prev_90d then 10
          when attended_90d = attended_prev_90d and attended_90d > 0 then 5
          else 0
        end) as activity_score,
    (case
      when attended_90d > attended_prev_90d then 'improving'
      when attended_90d = attended_prev_90d and attended_90d > 0 then 'stable'
      when attended_90d < attended_prev_90d then 'declining'
      else 'new'
    end) as trend
  from base
)
select
  member_id,
  first_name,
  surname,
  member_type,
  ministry_group,
  attended_90d,
  attended_prev_90d,
  registrations_90d,
  attended_total,
  cancelled_total as no_show_count,
  last_attended_at,
  activity_score,
  (case
    when activity_score >= 80 then 'highly_active'
    when activity_score >= 60 then 'active'
    when activity_score >= 30 then 'occasional'
    else 'inactive'
  end) as activity_status,
  trend
from scored;

comment on view public.member_activity_summary_view is
  'v1 heuristic — attendance/registration/ministry/volunteer based only. No age, gender, or donation factors, per church activity-scoring rules.';
