-- Replace broad PCM access with role-gated member scope and audit support.
create or replace function public.is_pcm_for_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('pcm_staff')
    and exists (
      select 1
      from public.members m
      join public.pcm_staff s on s.id = m.assigned_pcm
      where m.id = p_member_id
        and s.status = 'active'
        and lower(s.email) = public.auth_email()
    );
$$;

-- This replaces the prior applied definition without rewriting migration history.
create or replace function public.can_access_member(target_member_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_member_id = public.current_member_id() then
    return true;
  end if;

  if public.is_admin() then
    return true;
  end if;

  if public.is_pcm_for_member(target_member_id) then
    return true;
  end if;

  if public.is_network_head_for_member(target_member_id) then
    return true;
  end if;

  if public.is_ministry_head_for_member(target_member_id) then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.is_pcm_for_member(uuid) from public, anon;
revoke all on function public.can_access_member(uuid) from public, anon;
grant execute on function public.is_pcm_for_member(uuid) to authenticated, service_role;
grant execute on function public.can_access_member(uuid) to authenticated, service_role;

-- Approval requests without a member remain visible to administrators only.
alter table public.approval_requests enable row level security;
drop policy if exists approval_requests_select on public.approval_requests;
drop policy if exists approval_requests_insert on public.approval_requests;
drop policy if exists approval_requests_decide on public.approval_requests;
drop policy if exists approval_requests_update on public.approval_requests;
create policy approval_requests_select on public.approval_requests
  for select to authenticated
  using (public.is_admin() or public.can_access_member(member_id));
create policy approval_requests_insert on public.approval_requests
  for insert to authenticated
  with check (public.is_admin() or public.can_access_member(member_id));
create policy approval_requests_update on public.approval_requests
  for update to authenticated
  using (public.is_admin() or public.can_access_member(member_id))
  with check (public.is_admin() or public.can_access_member(member_id));

-- Existing member-scoped write policies only checked the caller's staff role.
do $$
declare
  t text;
begin
  foreach t in array array[
    'member_ministries',
    'member_heartlinks',
    'member_journey_progress',
    'member_requirement_completions',
    'journey_certificates',
    'member_spiritual_profiles',
    'member_education_profiles',
    'member_work_profiles',
    'member_skills',
    'member_consents'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_write', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_access_member(member_id))',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_access_member(member_id))',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_access_member(member_id)) with check (public.can_access_member(member_id))',
      t || '_update', t
    );
  end loop;
end $$;

alter table public.follow_up_logs enable row level security;
drop policy if exists follow_up_logs_select on public.follow_up_logs;
drop policy if exists follow_up_logs_pcm_insert on public.follow_up_logs;
drop policy if exists follow_up_logs_insert on public.follow_up_logs;
drop policy if exists follow_up_logs_update on public.follow_up_logs;
create policy follow_up_logs_select on public.follow_up_logs
  for select to authenticated
  using (public.can_access_member(member_id));
create policy follow_up_logs_insert on public.follow_up_logs
  for insert to authenticated
  with check (public.can_access_member(member_id));
create policy follow_up_logs_update on public.follow_up_logs
  for update to authenticated
  using (public.can_access_member(member_id))
  with check (public.can_access_member(member_id));

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (char_length(btrim(action)) > 0),
  entity_type text not null check (char_length(btrim(entity_type)) > 0),
  entity_id text not null check (char_length(btrim(entity_id)) > 0),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_actor_created_at_idx
  on public.admin_audit_logs (actor_id, created_at desc);

alter table public.admin_audit_logs enable row level security;
drop policy if exists admin_audit_logs_admin_read on public.admin_audit_logs;
create policy admin_audit_logs_admin_read on public.admin_audit_logs
  for select to authenticated
  using (public.is_admin());

revoke all on table public.admin_audit_logs from public, anon, authenticated;
grant select on table public.admin_audit_logs to authenticated;
grant select, insert on table public.admin_audit_logs to service_role;
