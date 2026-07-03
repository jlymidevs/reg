-- JLYCC Reg — Phase 2: Check-in system (manual search first; QR is a
-- fast-follow). Additive only. Run once in Supabase SQL editor AFTER
-- supabase_phase1_foundation.sql.
--
-- Design notes:
--   - check_ins is a new table (no existing equivalent found in the shared
--     PCM schema — verified event_registrations/events columns first).
--   - Checking in also flips event_registrations.status to 'attended', so
--     everything already built on that status (DashboardOverview counts,
--     RegistrationsManager, member_activity_summary_view) picks up real
--     check-ins automatically with zero other code changes.
--   - Duplicate check-in is prevented at the DB level via a unique
--     constraint on registration_id, not just app logic.
--   - checked_in_by stores the admin's email (text), matching how
--     admin_users/audit_logs already identify actors — no auth.users join
--     needed for a simple display string.

create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references event_registrations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  method text not null default 'manual' check (method in ('manual', 'qr', 'walk_in')),
  checked_in_by text,
  checked_in_at timestamptz not null default now(),
  notes text
);

create index if not exists check_ins_event_idx on check_ins (event_id);

alter table check_ins enable row level security;

drop policy if exists "reg_admin_select_check_ins" on check_ins;
create policy "reg_admin_select_check_ins" on check_ins
  for select to authenticated using (public.is_reg_admin());
-- No direct insert/update/delete policy — all writes go through the
-- admin_check_in / admin_undo_check_in RPCs below (SECURITY DEFINER),
-- which also keep event_registrations.status in sync.

create or replace function public.admin_check_in(
  p_registration_id uuid,
  p_method text default 'manual',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := coalesce(auth.jwt() ->> 'email', '');
  v_reg event_registrations%rowtype;
  v_member members%rowtype;
  v_event events%rowtype;
  v_existing check_ins%rowtype;
begin
  if not public.is_reg_admin() then
    raise exception 'Not authorized.';
  end if;

  select * into v_reg from event_registrations where id = p_registration_id;
  if not found then
    raise exception 'Registration not found.';
  end if;

  if v_reg.status = 'cancelled' then
    raise exception 'This registration was cancelled.';
  end if;

  select * into v_existing from check_ins where registration_id = p_registration_id;
  if found then
    raise exception 'Already checked in at %.', to_char(v_existing.checked_in_at, 'Mon DD, HH12:MI AM');
  end if;

  insert into check_ins (registration_id, event_id, member_id, method, checked_in_by, notes)
  values (p_registration_id, v_reg.event_id, v_reg.member_id, coalesce(p_method, 'manual'), v_actor, p_notes);

  update event_registrations set status = 'attended' where id = p_registration_id;

  select * into v_member from members where id = v_reg.member_id;
  select * into v_event from events where id = v_reg.event_id;

  return jsonb_build_object(
    'ok', true,
    'member_name', trim(coalesce(v_member.first_name, '') || ' ' || coalesce(v_member.surname, '')),
    'event_title', v_event.title,
    'checked_in_at', now()
  );
end;
$$;

grant execute on function public.admin_check_in to authenticated;

create or replace function public.admin_undo_check_in(p_registration_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_reg_admin() then
    raise exception 'Not authorized.';
  end if;

  delete from check_ins where registration_id = p_registration_id;
  update event_registrations set status = 'registered' where id = p_registration_id and status = 'attended';

  return true;
end;
$$;

grant execute on function public.admin_undo_check_in to authenticated;

drop trigger if exists audit_check_ins on check_ins;
create trigger audit_check_ins
  after insert or update or delete on check_ins
  for each row execute function public.log_audit_event();
