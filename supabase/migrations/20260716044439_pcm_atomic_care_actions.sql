-- Mutations and their audit records execute together. Unhandled failures roll back all work.
create or replace function public.pcm_log_followup(
  p_member_id uuid,
  p_date date,
  p_method text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_logged_by uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not (public.has_role('pcm_staff') or public.is_admin()) then
    raise exception 'care action not authorized' using errcode = '42501';
  end if;

  if p_member_id is null or not public.can_access_member(p_member_id) then
    raise exception 'member access denied' using errcode = '42501';
  end if;

  if p_date is null or p_method is null
    or p_method not in ('call', 'text', 'visit', 'prayer', 'online', 'other') then
    raise exception 'invalid follow-up input' using errcode = '22023';
  end if;

  select s.id
  into v_logged_by
  from public.pcm_staff s
  where s.status = 'active'
    and lower(s.email) = public.auth_email()
  limit 1;

  insert into public.follow_up_logs (member_id, logged_by, date, method, notes)
  values (p_member_id, v_logged_by, p_date, p_method, nullif(pg_catalog.btrim(p_notes), ''));

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, after)
  values (
    v_actor_id,
    'log_followup',
    'members',
    p_member_id::text,
    pg_catalog.jsonb_build_object('method', p_method, 'date', p_date, 'notes', nullif(pg_catalog.btrim(p_notes), ''))
  );
end;
$$;

create or replace function public.pcm_request_status_change(
  p_member_id uuid,
  p_to_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_from_status text;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not (
    public.has_role('pcm_staff')
    or public.has_role('network_head')
    or public.has_role('ministry_head')
    or public.is_admin()
  ) then
    raise exception 'care action not authorized' using errcode = '42501';
  end if;

  if p_member_id is null or not public.can_access_member(p_member_id) then
    raise exception 'member access denied' using errcode = '42501';
  end if;

  if p_to_status not in ('FTV', 'OGV', 'RM', 'AM', 'DROPPED') then
    raise exception 'invalid pipeline status' using errcode = '22023';
  end if;

  if p_to_status = 'DROPPED' and char_length(coalesce(v_reason, '')) < 10 then
    raise exception 'dropped status requires a reason' using errcode = '22023';
  end if;

  select m.journey_status
  into v_from_status
  from public.members m
  where m.id = p_member_id
  for update;

  if not found or v_from_status is not distinct from p_to_status then
    raise exception 'member or move not found' using errcode = 'P0002';
  end if;

  insert into public.approval_requests (request_type, member_id, requested_by, payload)
  values (
    'member_status_change',
    p_member_id,
    v_actor_id,
    pg_catalog.jsonb_build_object('from', v_from_status, 'to', p_to_status, 'reason', v_reason)
  );

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    v_actor_id,
    'request_status_change',
    'members',
    p_member_id::text,
    pg_catalog.jsonb_build_object('journey_status', v_from_status),
    pg_catalog.jsonb_build_object('journey_status', p_to_status, 'reason', v_reason)
  );
end;
$$;

create or replace function public.pcm_decide_approval(
  p_approval_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request public.approval_requests%rowtype;
  v_note text := nullif(pg_catalog.btrim(p_note), '');
  v_next_status text;
  v_previous_status text;
  v_stage_id uuid;
  v_requirement_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not (
    public.has_role('pcm_staff')
    or public.has_role('network_head')
    or public.has_role('ministry_head')
    or public.is_admin()
  ) then
    raise exception 'care action not authorized' using errcode = '42501';
  end if;

  if p_approval_id is null or p_decision not in ('approved', 'rejected') then
    raise exception 'invalid approval input' using errcode = '22023';
  end if;

  select *
  into v_request
  from public.approval_requests
  where id = p_approval_id
  for update;

  if not found then
    raise exception 'approval request not found' using errcode = 'P0002';
  end if;

  if v_request.member_id is null or not public.can_access_member(v_request.member_id) then
    raise exception 'member access denied' using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'approval already decided' using errcode = 'P0001';
  end if;

  if p_decision = 'approved' then
    if v_request.request_type = 'member_status_change' then
      v_next_status := coalesce(v_request.payload ->> 'to', v_request.payload ->> 'new_value');
      if v_next_status not in ('FTV', 'OGV', 'RM', 'AM', 'DROPPED') then
        raise exception 'approval side effect failed' using errcode = '22023';
      end if;

      select m.journey_status
      into v_previous_status
      from public.members m
      where m.id = v_request.member_id
      for update;

      if not found then
        raise exception 'approval side effect failed' using errcode = 'P0002';
      end if;

      if v_previous_status is distinct from v_next_status then
        update public.members
        set journey_status = v_next_status
        where id = v_request.member_id;

        if not found then
          raise exception 'approval side effect failed' using errcode = 'P0002';
        end if;

        insert into public.member_field_history (member_id, field, old_value, new_value, changed_by)
        values (v_request.member_id, 'journey_status', v_previous_status, v_next_status, v_actor_id);
      end if;
    elsif v_request.request_type = 'journey_stage_completion' then
      select coalesce(
        nullif(v_request.payload ->> 'stage_id', '')::uuid,
        (select js.id from public.journey_stages js where js.code = v_request.payload ->> 'stage_code')
      )
      into v_stage_id;

      if v_stage_id is null then
        raise exception 'approval side effect failed' using errcode = 'P0002';
      end if;

      insert into public.member_journey_progress (
        member_id, stage_id, status, completed_at, approved_by, approval_request_id, notes
      )
      values (
        v_request.member_id, v_stage_id, 'completed', current_date, v_actor_id, v_request.id, v_note
      )
      on conflict (member_id, stage_id) do update
        set status = excluded.status,
            completed_at = excluded.completed_at,
            approved_by = excluded.approved_by,
            approval_request_id = excluded.approval_request_id,
            notes = excluded.notes,
            updated_at = now();
    elsif v_request.request_type = 'journey_requirement_completion' then
      select coalesce(
        nullif(v_request.payload ->> 'requirement_id', '')::uuid,
        (select jr.id from public.journey_requirements jr where jr.code = v_request.payload ->> 'requirement_code')
      )
      into v_requirement_id;

      if v_requirement_id is null then
        raise exception 'approval side effect failed' using errcode = 'P0002';
      end if;

      insert into public.member_requirement_completions (
        member_id, requirement_id, completed_on, evidence_type, approved_by, approval_request_id, notes
      )
      values (
        v_request.member_id, v_requirement_id, current_date, 'manual', v_actor_id, v_request.id, v_note
      )
      on conflict (member_id, requirement_id) do update
        set completed_on = excluded.completed_on,
            evidence_type = excluded.evidence_type,
            approved_by = excluded.approved_by,
            approval_request_id = excluded.approval_request_id,
            notes = excluded.notes;
    else
      raise exception 'approval side effect failed' using errcode = '22023';
    end if;
  end if;

  update public.approval_requests
  set status = p_decision,
      decided_by = v_actor_id,
      decided_at = now(),
      decision_note = v_note
  where id = v_request.id
    and status = 'pending';

  if not found then
    raise exception 'approval decision failed' using errcode = 'P0001';
  end if;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    v_actor_id,
    case when p_decision = 'approved' then 'approve_request' else 'reject_request' end,
    'approval_requests',
    v_request.id::text,
    pg_catalog.jsonb_build_object('status', v_request.status),
    pg_catalog.jsonb_build_object('status', p_decision, 'note', v_note)
  );
end;
$$;

revoke all on function public.pcm_log_followup(uuid, date, text, text) from public, anon;
revoke all on function public.pcm_request_status_change(uuid, text, text) from public, anon;
revoke all on function public.pcm_decide_approval(uuid, text, text) from public, anon;
grant execute on function public.pcm_log_followup(uuid, date, text, text) to authenticated;
grant execute on function public.pcm_request_status_change(uuid, text, text) to authenticated;
grant execute on function public.pcm_decide_approval(uuid, text, text) to authenticated;
