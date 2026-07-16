-- Team turnover is a single audited admin operation. Any failure rolls back all moves.
create table if not exists public.member_transfers (
  id uuid primary key default gen_random_uuid(),
  from_pcm_staff_id uuid not null references public.pcm_staff(id),
  to_pcm_staff_id uuid not null references public.pcm_staff(id),
  member_ids uuid[] not null default '{}',
  member_count integer not null default 0,
  reason text not null,
  note text,
  performed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.member_transfers enable row level security;

drop policy if exists member_transfers_admin_read on public.member_transfers;
create policy member_transfers_admin_read on public.member_transfers
  for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.member_transfers from public, anon, authenticated;

create or replace function public.pcm_execute_turnover(
  p_from_staff_id uuid,
  p_to_staff_id uuid,
  p_reason text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_note text := nullif(pg_catalog.btrim(p_note), '');
  v_member_ids uuid[];
  v_member_count integer;
begin
  if v_actor_id is null or not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_from_staff_id is null or p_to_staff_id is null or p_from_staff_id = p_to_staff_id then
    raise exception 'select different active staff members' using errcode = '22023';
  end if;

  if char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'turnover reason is required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.pcm_staff where id = p_from_staff_id and status = 'active')
     or not exists (select 1 from public.pcm_staff where id = p_to_staff_id and status = 'active') then
    raise exception 'staff member is unavailable' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(m.id), '{}'), count(*)::integer
  into v_member_ids, v_member_count
  from public.members m
  where m.assigned_pcm = p_from_staff_id;

  update public.members
  set assigned_pcm = p_to_staff_id
  where assigned_pcm = p_from_staff_id;

  update public.follow_up_tasks
  set assigned_to = p_to_staff_id,
      updated_at = now()
  where assigned_to = p_from_staff_id
    and status in ('pending', 'in_progress');

  insert into public.member_transfers (
    from_pcm_staff_id,
    to_pcm_staff_id,
    member_ids,
    member_count,
    reason,
    note,
    performed_by
  ) values (
    p_from_staff_id,
    p_to_staff_id,
    v_member_ids,
    v_member_count,
    v_reason,
    v_note,
    v_actor_id
  );

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, after)
  values (
    v_actor_id,
    'execute_team_turnover',
    'member_transfers',
    p_from_staff_id::text,
    pg_catalog.jsonb_build_object(
      'from_staff_id', p_from_staff_id,
      'to_staff_id', p_to_staff_id,
      'member_count', v_member_count,
      'reason', v_reason
    )
  );

  return v_member_count;
end;
$$;

create or replace function public.pcm_transfer_staff_work(
  p_source_staff_id uuid,
  p_destination_staff_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.pcm_execute_turnover(p_source_staff_id, p_destination_staff_id, p_reason, null);
end;
$$;

create or replace function public.pcm_admin_set_staff_role(
  p_user_id uuid,
  p_role_code text,
  p_network_id uuid default null,
  p_ministry_id uuid default null,
  p_staff_name text default null,
  p_is_active boolean default true,
  p_invited boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role_id uuid;
  v_email text;
  v_active_super_admins integer;
begin
  if v_actor_id is null or not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_user_id is null or p_role_code not in ('pcm_staff', 'network_head', 'ministry_head', 'admin', 'super_admin') then
    raise exception 'invalid staff role input' using errcode = '22023';
  end if;
  if p_role_code = 'network_head' and p_network_id is null then
    raise exception 'network head requires a network scope' using errcode = '22023';
  end if;
  if p_role_code = 'ministry_head' and p_ministry_id is null then
    raise exception 'ministry head requires a ministry scope' using errcode = '22023';
  end if;

  select id into v_role_id from public.roles where code = p_role_code;
  if v_role_id is null then
    raise exception 'staff role is unavailable' using errcode = 'P0002';
  end if;

  if not p_is_active and p_role_code = 'super_admin' and p_user_id = v_actor_id then
    select count(*)::integer into v_active_super_admins
    from public.user_roles ur join public.roles r on r.id = ur.role_id
    where r.code = 'super_admin' and ur.is_active;
    if v_active_super_admins <= 1 then
      raise exception 'cannot remove the final super admin' using errcode = '22023';
    end if;
  end if;

  insert into public.user_roles (user_id, role_id, network_id, ministry_id, granted_by, is_active)
  values (p_user_id, v_role_id, p_network_id, p_ministry_id, v_actor_id, p_is_active)
  on conflict
  do update set is_active = excluded.is_active, granted_by = excluded.granted_by, granted_at = now();

  if p_is_active then
    select email into v_email from auth.users where id = p_user_id;
    if v_email is not null then
      update public.pcm_staff
      set name = coalesce(nullif(pg_catalog.btrim(p_staff_name), ''), name),
          status = 'active'
      where lower(email) = lower(v_email);
      if not found then
        insert into public.pcm_staff (name, email, status)
        values (coalesce(nullif(pg_catalog.btrim(p_staff_name), ''), split_part(v_email, '@', 1)), lower(v_email), 'active');
      end if;
    end if;
  end if;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, after)
  values (
    v_actor_id,
    case when p_is_active then 'grant_staff_role' else 'remove_staff_role' end,
    'user_roles',
    p_user_id::text,
    pg_catalog.jsonb_build_object('role', p_role_code, 'network_id', p_network_id, 'ministry_id', p_ministry_id, 'active', p_is_active)
  );
end;
$$;

revoke all on function public.pcm_execute_turnover(uuid, uuid, text, text) from public, anon;
revoke all on function public.pcm_transfer_staff_work(uuid, uuid, text) from public, anon;
revoke all on function public.pcm_admin_set_staff_role(uuid, text, uuid, uuid, text, boolean, boolean) from public, anon;
grant execute on function public.pcm_execute_turnover(uuid, uuid, text, text) to authenticated;
grant execute on function public.pcm_transfer_staff_work(uuid, uuid, text) to authenticated;
grant execute on function public.pcm_admin_set_staff_role(uuid, text, uuid, uuid, text, boolean, boolean) to authenticated;
