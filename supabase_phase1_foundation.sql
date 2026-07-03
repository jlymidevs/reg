-- JLYCC Reg — Phase 1: Foundation (roles, audit log, member classification,
-- activity scoring). Additive only — no existing column/table is dropped or
-- renamed. Run once in Supabase SQL editor AFTER supabase_setup.sql and
-- supabase_registration_v2.sql.
--
-- Maps to the existing schema instead of duplicating it:
--   - admin_users (already the source of admin identity) gains a `role`
--     column instead of a new user_roles/auth.users mapping table.
--   - members (already the source-of-truth member record) gains
--     classification columns; no separate attendees table is created.
--   - event_registrations.status ('registered'/'attended'/'cancelled') is
--     reused as the attendance signal for activity scoring — no separate
--     check_ins table yet (that's Phase 2, for QR/manual check-in).
--
-- Assumptions (documented, revisit if wrong):
--   - "no-show" is approximated by status = 'cancelled' until Phase 2 adds
--     a real check_ins table with a distinct no-show state.
--   - Activity score weights are fixed constants in
--     calculate_member_activity_score(), not yet settings-driven (Phase 11
--     in the full spec). Easy to tune later — all in one function body.
--   - Ministry/volunteer participation is a flat point value based on
--     ministry_group / member_type being set, since there's no separate
--     ministry-participation log table yet.

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

-- Super admins can fully manage the admin roster; existing "read own row"
-- policy (from supabase_setup.sql) is left in place for everyone else.
drop policy if exists "super_admin_manage_admin_users" on admin_users;
create policy "super_admin_manage_admin_users" on admin_users
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 2. Member classification fields (additive columns on the existing
--    members table — this stays the single source of truth for people)
-- ---------------------------------------------------------------------------
alter table members add column if not exists member_type text not null default 'regular_member';
alter table members add constraint members_member_type_check
  check (member_type in ('regular_member','new_member','visitor','volunteer','leader','guest'));

alter table members add column if not exists tags text[] not null default '{}';
alter table members add column if not exists ministry_group text;
alter table members add column if not exists age_group text;
alter table members add constraint members_age_group_check
  check (age_group is null or age_group in ('child','youth','young_adult','adult','senior','prefer_not_to_say'));

alter table members add column if not exists communication_consent boolean not null default true;
alter table members add column if not exists unsubscribed boolean not null default false;
alter table members add column if not exists is_active boolean not null default true;
alter table members add column if not exists archived_at timestamptz;

-- Admins (any role) can update member classification; only super_admin
-- manages the admin roster itself (policy above).
drop policy if exists "reg_admin_update_members" on members;
create policy "reg_admin_update_members" on members
  for update to authenticated
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
    m.member_type,
    m.ministry_group,
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
  group by m.id, m.first_name, m.surname, m.member_type, m.ministry_group
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
