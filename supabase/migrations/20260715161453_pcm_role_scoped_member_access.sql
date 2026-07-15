-- PCM staff may read only members assigned to auth.uid(); administrators retain church-wide access.
-- Network and ministry heads may read only members connected to their assigned network or ministry.
select pg_get_functiondef('public.can_access_member(uuid)'::regprocedure);

create or replace function public.can_access_member(target_member_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if target_member_id = public.current_member_id() then
    return true;
  end if;

  if public.is_admin() then
    return true;
  end if;

  if public.has_role('pcm_staff') then
    return exists (
      select 1 from public.members m
      where m.id = target_member_id
        and (m.assigned_pcm = auth.uid() or m.assigned_pcm_staff_id = auth.uid())
    );
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
