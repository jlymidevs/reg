-- 009_views_reports.sql
-- Reporting views. All security_invoker so caller's RLS applies.
-- Inactivity rule: >=14 days no activity -> watchlist; >=30 days -> inactive.

-- last activity per member (attendance or follow-up contact)
create or replace view public.member_activity_view
with (security_invoker = true) as
select
  m.id as member_id,
  m.name,
  m.member_code,
  m.journey_status,
  m.assigned_pcm,
  a.last_attendance_at,
  f.last_followup_on,
  greatest(
    coalesce(a.last_attendance_at::date, '1900-01-01'::date),
    coalesce(f.last_followup_on,          '1900-01-01'::date),
    coalesce(m.entry_date,                '1900-01-01'::date),
    coalesce(m.created_at::date,          '1900-01-01'::date)
  ) as last_activity_on,
  (current_date - greatest(
    coalesce(a.last_attendance_at::date, '1900-01-01'::date),
    coalesce(f.last_followup_on,          '1900-01-01'::date),
    coalesce(m.entry_date,                '1900-01-01'::date),
    coalesce(m.created_at::date,          '1900-01-01'::date)
  )) as days_inactive
from public.members m
left join (
  select member_id, max(checked_in_at) as last_attendance_at
  from public.attendance_logs group by member_id
) a on a.member_id = m.id
left join (
  select member_id, max(date) as last_followup_on
  from public.follow_up_logs group by member_id
) f on f.member_id = m.id;

create or replace view public.inactive_watchlist_view
with (security_invoker = true) as
select
  v.*,
  case when v.days_inactive >= 30 then 'inactive'
       else 'watch' end as watch_level
from public.member_activity_view v
where v.days_inactive >= 14
order by v.days_inactive desc;

-- journey progress summary per member
create or replace view public.member_journey_summary_view
with (security_invoker = true) as
select
  m.id as member_id,
  m.name,
  m.member_code,
  m.journey_status,
  s.code  as current_stage_code,
  s.name  as current_stage_name,
  s.sort_order as current_stage_order,
  coalesce(rq.total_required, 0)   as stage_required_count,
  coalesce(dc.done_in_stage, 0)    as stage_completed_count,
  coalesce(dc_all.done_total, 0)   as total_requirements_completed
from public.members m
left join public.journey_stages s on s.id = m.current_journey_stage_id
left join lateral (
  select count(*) as total_required
  from public.journey_requirements r
  where r.stage_id = m.current_journey_stage_id and r.is_required and r.is_active
) rq on true
left join lateral (
  select count(*) as done_in_stage
  from public.member_requirement_completions c
  join public.journey_requirements r on r.id = c.requirement_id
  where c.member_id = m.id and r.stage_id = m.current_journey_stage_id
) dc on true
left join lateral (
  select count(*) as done_total
  from public.member_requirement_completions c
  where c.member_id = m.id
) dc_all on true;

-- weekly KPI per PCM staff (week starts Monday)
create or replace view public.pcm_weekly_kpi_view
with (security_invoker = true) as
with weeks as (
  select generate_series(
    date_trunc('week', current_date - interval '12 weeks'),
    date_trunc('week', current_date),
    interval '1 week'
  )::date as week_start
)
select
  ps.id   as pcm_staff_id,
  ps.name as pcm_staff_name,
  w.week_start,
  (w.week_start + 6) as week_end,
  (select count(*) from public.follow_up_logs fl
    where fl.logged_by = ps.id
      and fl.date >= w.week_start and fl.date < w.week_start + 7) as followups_completed,
  (select count(*) from public.members m
    where m.assigned_pcm = ps.id) as members_assigned,
  (select count(*) from public.member_field_history h
    join public.members m2 on m2.id = h.member_id and m2.assigned_pcm = ps.id
    where h.field = 'journey_status' and h.old_value = 'FTV' and h.new_value = 'OGV'
      and h.changed_at >= w.week_start and h.changed_at < w.week_start + 7) as ftv_to_ogv,
  (select count(*) from public.member_field_history h
    join public.members m2 on m2.id = h.member_id and m2.assigned_pcm = ps.id
    where h.field = 'journey_status' and h.old_value = 'OGV' and h.new_value = 'RM'
      and h.changed_at >= w.week_start and h.changed_at < w.week_start + 7) as ogv_to_rm,
  (select count(*) from public.member_field_history h
    join public.members m2 on m2.id = h.member_id and m2.assigned_pcm = ps.id
    where h.field = 'journey_status' and h.old_value = 'RM' and h.new_value = 'AM'
      and h.changed_at >= w.week_start and h.changed_at < w.week_start + 7) as rm_to_am,
  (select count(distinct al.member_id) from public.attendance_logs al
    join public.members m2 on m2.id = al.member_id and m2.assigned_pcm = ps.id
    where al.checked_in_at >= w.week_start and al.checked_in_at < w.week_start + 7) as attendance_this_week,
  -- inactive recovered: attended this week after a gap of 30+ days (or first-ever attendance 30+ days after entry)
  (select count(distinct al.member_id) from public.attendance_logs al
    join public.members m2 on m2.id = al.member_id and m2.assigned_pcm = ps.id
    where al.checked_in_at >= w.week_start and al.checked_in_at < w.week_start + 7
      and coalesce(
        (select max(prev.checked_in_at)::date from public.attendance_logs prev
          where prev.member_id = al.member_id and prev.checked_in_at < w.week_start),
        coalesce(m2.entry_date, m2.created_at::date)
      ) <= w.week_start - 30) as inactive_recovered,
  (select count(*) from public.member_heartlinks mh
    join public.members m2 on m2.id = mh.member_id and m2.assigned_pcm = ps.id
    where mh.joined_on >= w.week_start and mh.joined_on < w.week_start + 7) as heartlink_assignments,
  (select count(*) from public.member_requirement_completions c
    join public.members m2 on m2.id = c.member_id and m2.assigned_pcm = ps.id
    where c.completed_on >= w.week_start and c.completed_on < w.week_start + 7) as requirements_completed
from public.pcm_staff ps
cross join weeks w;

create or replace view public.event_attendance_summary_view
with (security_invoker = true) as
select
  e.id as event_id,
  e.title,
  e.event_type,
  e.starts_at,
  e.ministry_id,
  e.network_id,
  (select count(*) from public.event_registrations r
    where r.event_id = e.id and r.status not in ('cancelled')) as registered_count,
  (select count(*) from public.attendance_logs a where a.event_id = e.id) as attended_count,
  case when (select count(*) from public.event_registrations r
             where r.event_id = e.id and r.status not in ('cancelled')) > 0
       then round(
         (select count(*) from public.attendance_logs a where a.event_id = e.id)::numeric * 100
         / (select count(*) from public.event_registrations r
            where r.event_id = e.id and r.status not in ('cancelled')), 1)
       end as attendance_rate_pct
from public.events e;

-- one-stop dashboard row per member (member portal home)
create or replace view public.member_dashboard_view
with (security_invoker = true) as
select
  m.id as member_id,
  m.name, m.member_code, m.journey_status, m.email,
  js.current_stage_code, js.current_stage_name,
  js.stage_completed_count, js.stage_required_count,
  act.last_activity_on, act.days_inactive,
  hl.name as primary_heartlink,
  (select count(*) from public.attendance_logs a where a.member_id = m.id) as total_attendance,
  (select count(*) from public.member_ministries mm
    where mm.member_id = m.id and mm.is_active) as active_ministries
from public.members m
left join public.member_journey_summary_view js on js.member_id = m.id
left join public.member_activity_view act on act.member_id = m.id
left join public.member_heartlinks mh
  on mh.member_id = m.id and mh.is_primary and mh.left_on is null
left join public.heartlinks hl on hl.id = mh.heartlink_id;
