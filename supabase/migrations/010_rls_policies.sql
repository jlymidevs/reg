-- 010_rls_policies.sql
-- RLS helper functions + policies.
--
-- !! APPLY LAST, AND TEST FIRST ON A BRANCH/STAGING PROJECT !!
-- Enabling RLS on pre-existing tables (members, follow_up_logs, offerings) will block
-- any existing app code that queries them with the anon key and no matching policy.
-- Service-role clients are unaffected. Section C (existing tables) is separated so you
-- can apply Sections A+B (new tables) first and Section C after verifying current apps.

-- ===========================================================================
-- SECTION A: helper functions (security definer, stable)
-- ===========================================================================

create or replace function public.auth_email()
returns text language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.current_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select m.id from public.members m
  where m.auth_user_id = auth.uid()
     or (m.email is not null and lower(m.email) = public.auth_email())
  order by (m.auth_user_id = auth.uid()) desc
  limit 1;
$$;

create or replace function public.has_role(role_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.is_active
      and (ur.expires_at is null or ur.expires_at > now())
      and r.code = role_code
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('super_admin');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('admin') or public.has_role('super_admin');
$$;

-- PCM staff assigned to this member (matched via pcm_staff.email)
create or replace function public.is_pcm_for_member(p_member_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m
    join public.pcm_staff s on s.id = m.assigned_pcm
    where m.id = p_member_id
      and lower(s.email) = public.auth_email()
  );
$$;

-- network head over this member (via ministry's network OR heartlink's network)
create or replace function public.is_network_head_for_member(p_member_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id and r.code = 'network_head'
    where ur.user_id = auth.uid() and ur.is_active
      and ur.network_id is not null
      and (
        exists (select 1 from public.member_ministries mm
                join public.ministries mi on mi.id = mm.ministry_id
                where mm.member_id = p_member_id and mm.is_active
                  and mi.network_id = ur.network_id)
        or exists (select 1 from public.member_heartlinks mh
                   join public.heartlinks hl on hl.id = mh.heartlink_id
                   where mh.member_id = p_member_id and mh.left_on is null
                     and hl.network_id = ur.network_id)
      )
  );
$$;

create or replace function public.is_ministry_head_for_member(p_member_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id and r.code = 'ministry_head'
    where ur.user_id = auth.uid() and ur.is_active
      and ur.ministry_id is not null
      and exists (select 1 from public.member_ministries mm
                  where mm.member_id = p_member_id and mm.is_active
                    and mm.ministry_id = ur.ministry_id)
  );
$$;

create or replace function public.can_access_member(target_member_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_member_id = public.current_member_id()
      or public.is_admin()
      -- ASSUMPTION: pcm_staff role sees all members (needed for watchlist across whole church)
      or public.has_role('pcm_staff')
      or public.is_pcm_for_member(target_member_id)
      or public.is_network_head_for_member(target_member_id)
      or public.is_ministry_head_for_member(target_member_id);
$$;

grant execute on function
  public.auth_email(), public.current_member_id(), public.has_role(text),
  public.is_super_admin(), public.is_admin(),
  public.is_pcm_for_member(uuid), public.is_network_head_for_member(uuid),
  public.is_ministry_head_for_member(uuid), public.can_access_member(uuid)
to authenticated, anon;

-- ===========================================================================
-- SECTION B: RLS on NEW tables (safe — nothing queries these yet)
-- ===========================================================================

-- reference tables: readable by all authenticated, writable by admin
do $$
declare t text;
begin
  foreach t in array array['networks','ministries','heartlinks','journey_stages',
                           'journey_requirements','roles','apps','skills']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I', t, t);
    execute format('create policy %I_admin_write on public.%I for all to authenticated
                    using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- member-scoped tables: visible via can_access_member; writes by staff/admin
do $$
declare t text;
begin
  foreach t in array array['member_ministries','member_heartlinks',
                           'member_journey_progress','member_requirement_completions',
                           'journey_certificates','member_spiritual_profiles',
                           'member_education_profiles','member_work_profiles',
                           'member_skills','member_consents']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated
                    using (public.can_access_member(member_id))', t, t);
    execute format('drop policy if exists %I_staff_write on public.%I', t, t);
    execute format('create policy %I_staff_write on public.%I for all to authenticated
                    using (public.is_admin() or public.has_role(''pcm_staff''))
                    with check (public.is_admin() or public.has_role(''pcm_staff''))', t, t);
  end loop;
end $$;

-- events: published events readable by everyone (registration portal), all by staff
alter table public.events enable row level security;
drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events for select
  to anon, authenticated using (is_published and is_active);
drop policy if exists events_staff_all on public.events;
create policy events_staff_all on public.events for all to authenticated
  using (public.is_admin() or public.has_role('pcm_staff')
         or public.has_role('network_head') or public.has_role('ministry_head'))
  with check (public.is_admin() or public.has_role('pcm_staff')
         or public.has_role('network_head') or public.has_role('ministry_head'));

alter table public.event_registrations enable row level security;
drop policy if exists event_registrations_select on public.event_registrations;
create policy event_registrations_select on public.event_registrations for select
  to authenticated using (public.can_access_member(member_id));
drop policy if exists event_registrations_self_insert on public.event_registrations;
create policy event_registrations_self_insert on public.event_registrations for insert
  to authenticated with check (member_id = public.current_member_id());
drop policy if exists event_registrations_staff_write on public.event_registrations;
create policy event_registrations_staff_write on public.event_registrations for all
  to authenticated
  using (public.is_admin() or public.has_role('pcm_staff'))
  with check (public.is_admin() or public.has_role('pcm_staff'));

alter table public.attendance_logs enable row level security;
drop policy if exists attendance_logs_select on public.attendance_logs;
create policy attendance_logs_select on public.attendance_logs for select
  to authenticated using (public.can_access_member(member_id));
-- inserts happen via Edge Function (service role) or staff scanners
drop policy if exists attendance_logs_staff_insert on public.attendance_logs;
create policy attendance_logs_staff_insert on public.attendance_logs for insert
  to authenticated
  with check (public.is_admin() or public.has_role('pcm_staff')
              or public.has_role('network_head') or public.has_role('ministry_head'));

alter table public.user_roles enable row level security;
drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read on public.user_roles for select
  to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists user_roles_admin_write on public.user_roles;
create policy user_roles_admin_write on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- only super_admin can grant admin/super_admin (enforced by trigger, simplest reliable way)
create or replace function public.guard_privileged_role_grant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.roles r
             where r.id = new.role_id and r.code in ('admin','super_admin'))
     and not public.is_super_admin()
     and auth.uid() is not null then
    raise exception 'only super_admin can grant admin/super_admin roles';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_privileged_role_grant on public.user_roles;
create trigger trg_guard_privileged_role_grant
  before insert or update on public.user_roles
  for each row execute function public.guard_privileged_role_grant();

alter table public.approval_requests enable row level security;
drop policy if exists approval_requests_select on public.approval_requests;
create policy approval_requests_select on public.approval_requests for select
  to authenticated
  using (requested_by = auth.uid()
         or public.is_admin() or public.has_role('pcm_staff')
         or (member_id is not null and public.can_access_member(member_id)));
drop policy if exists approval_requests_insert on public.approval_requests;
create policy approval_requests_insert on public.approval_requests for insert
  to authenticated
  with check (public.is_admin() or public.has_role('pcm_staff')
              or public.has_role('network_head') or public.has_role('ministry_head'));
-- approvers: PCM staff, network head, ministry head, admin, super_admin
drop policy if exists approval_requests_decide on public.approval_requests;
create policy approval_requests_decide on public.approval_requests for update
  to authenticated
  using (public.is_admin() or public.has_role('pcm_staff')
         or (member_id is not null and (public.is_network_head_for_member(member_id)
                                        or public.is_ministry_head_for_member(member_id))))
  with check (true);

-- ===========================================================================
-- SECTION C: RLS on EXISTING tables — verify current apps first (see README)
-- ===========================================================================

alter table public.members enable row level security;
drop policy if exists members_select on public.members;
create policy members_select on public.members for select
  to authenticated using (public.can_access_member(id));
drop policy if exists members_self_update on public.members;
create policy members_self_update on public.members for update
  to authenticated
  using (id = public.current_member_id())
  with check (id = public.current_member_id());
  -- NOTE: column-level limits for self-update (phone, address, fb_name, nickname, etc.)
  -- enforce via a BEFORE UPDATE trigger or column grants; see README "limited own fields".
drop policy if exists members_staff_write on public.members;
create policy members_staff_write on public.members for all to authenticated
  using (public.is_admin() or public.has_role('pcm_staff'))
  with check (public.is_admin() or public.has_role('pcm_staff'));

alter table public.follow_up_logs enable row level security;
drop policy if exists follow_up_logs_select on public.follow_up_logs;
create policy follow_up_logs_select on public.follow_up_logs for select
  to authenticated
  using (public.is_admin() or public.has_role('pcm_staff')
         or public.is_network_head_for_member(member_id)
         or public.is_ministry_head_for_member(member_id));
drop policy if exists follow_up_logs_pcm_insert on public.follow_up_logs;
create policy follow_up_logs_pcm_insert on public.follow_up_logs for insert
  to authenticated
  with check (public.is_admin() or public.has_role('pcm_staff'));

-- donations: member sees own; only admin/super_admin see all.
-- PCM / network head / ministry head get NO policy => no access. Correct per spec.
alter table public.offerings enable row level security;
drop policy if exists offerings_own_select on public.offerings;
create policy offerings_own_select on public.offerings for select
  to authenticated
  using (
    member_id = public.current_member_id()
    or (email is not null and lower(email) = public.auth_email())
    or public.is_admin()
  );
drop policy if exists offerings_admin_write on public.offerings;
create policy offerings_admin_write on public.offerings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
