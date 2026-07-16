-- Care writes must pass through the role-checked, atomic audit RPCs.
-- Retain SELECT policies so authorized users can still view scoped records.
drop policy if exists approval_requests_insert on public.approval_requests;
drop policy if exists approval_requests_update on public.approval_requests;
drop policy if exists approval_requests_decide on public.approval_requests;
revoke insert, update on table public.approval_requests from public, anon, authenticated;

drop policy if exists member_journey_progress_insert on public.member_journey_progress;
drop policy if exists member_journey_progress_update on public.member_journey_progress;
revoke insert, update on table public.member_journey_progress from public, anon, authenticated;

drop policy if exists member_requirement_completions_insert on public.member_requirement_completions;
drop policy if exists member_requirement_completions_update on public.member_requirement_completions;
revoke insert, update on table public.member_requirement_completions from public, anon, authenticated;

drop policy if exists follow_up_logs_insert on public.follow_up_logs;
drop policy if exists follow_up_logs_update on public.follow_up_logs;
revoke insert, update on table public.follow_up_logs from public, anon, authenticated;

-- Replace the legacy global PCM write policy. Members retain their self-update policy.
drop policy if exists members_staff_write on public.members;
drop policy if exists members_admin_update on public.members;
drop policy if exists members_scoped_staff_update on public.members;

create policy members_admin_update on public.members
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy members_scoped_staff_update on public.members
  for update to authenticated
  using (
    (
      public.has_role('pcm_staff')
      or public.has_role('network_head')
      or public.has_role('ministry_head')
    )
    and public.can_access_member(id)
  )
  with check (
    (
      public.has_role('pcm_staff')
      or public.has_role('network_head')
      or public.has_role('ministry_head')
    )
    and public.can_access_member(id)
  );
