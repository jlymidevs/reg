-- Approval decisions must not reveal whether an out-of-scope request exists.
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
  v_dropped_reason text;
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
    and member_id is not null
    and public.can_access_member(member_id)
  for update;

  if not found then
    raise exception 'approval unavailable' using errcode = 'P0002';
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

      if v_next_status = 'DROPPED' then
        v_dropped_reason := nullif(pg_catalog.btrim(v_request.payload ->> 'reason'), '');
        if char_length(coalesce(v_dropped_reason, '')) < 10 then
          raise exception 'dropped status requires a reason' using errcode = '22023';
        end if;
      end if;

      select m.journey_status
      into v_previous_status
      from public.members m
      where m.id = v_request.member_id
      for update;

      if not found then
        raise exception 'approval side effect failed' using errcode = 'P0002';
      end if;

      update public.members
      set journey_status = v_next_status,
          dropped_reason = case when v_next_status = 'DROPPED' then v_dropped_reason else null end,
          dropped_at = case when v_next_status = 'DROPPED' then now() else null end,
          dropped_by = case when v_next_status = 'DROPPED' then v_actor_id else null end
      where id = v_request.member_id;

      if not found then
        raise exception 'approval side effect failed' using errcode = 'P0002';
      end if;

      if v_previous_status is distinct from v_next_status then
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

revoke all on function public.pcm_decide_approval(uuid, text, text) from public, anon;
grant execute on function public.pcm_decide_approval(uuid, text, text) to authenticated;

-- These authorities remain readable by member scope, but writes require a future audited RPC.
drop policy if exists member_ministries_insert on public.member_ministries;
drop policy if exists member_ministries_update on public.member_ministries;
revoke insert, update on table public.member_ministries from public, anon, authenticated;

drop policy if exists member_heartlinks_insert on public.member_heartlinks;
drop policy if exists member_heartlinks_update on public.member_heartlinks;
revoke insert, update on table public.member_heartlinks from public, anon, authenticated;

drop policy if exists journey_certificates_insert on public.journey_certificates;
drop policy if exists journey_certificates_update on public.journey_certificates;
revoke insert, update on table public.journey_certificates from public, anon, authenticated;
