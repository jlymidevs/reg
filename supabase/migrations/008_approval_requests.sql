-- 008_approval_requests.sql
-- Manual approval workflow for promotions, journey completion, role/ministry/heartlink assignment.

create table if not exists public.approval_requests (
  id            uuid primary key default gen_random_uuid(),
  request_type  text not null check (request_type in (
                  'member_status_change',        -- FTV->OGV->RM->AM (journey_status)
                  'journey_stage_completion',
                  'journey_requirement_completion',
                  'role_assignment',
                  'ministry_assignment',
                  'heartlink_assignment'
                )),
  member_id     uuid references public.members(id) on delete cascade,
  requested_by  uuid references auth.users(id),
  payload       jsonb not null default '{}'::jsonb,  -- e.g. {"from":"OGV","to":"RM"} or {"requirement_code":"WATER_BAPTISM"}
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','cancelled')),
  decided_by    uuid references auth.users(id),
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now()
);
create index if not exists approval_requests_status_idx on public.approval_requests (status);
create index if not exists approval_requests_member_idx on public.approval_requests (member_id);
create index if not exists approval_requests_type_idx on public.approval_requests (request_type);

-- back-fill FKs declared in 003
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mjp_approval_request_fkey' and conrelid = 'public.member_journey_progress'::regclass
  ) then
    alter table public.member_journey_progress
      add constraint mjp_approval_request_fkey
      foreign key (approval_request_id) references public.approval_requests(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'mrc_approval_request_fkey' and conrelid = 'public.member_requirement_completions'::regclass
  ) then
    alter table public.member_requirement_completions
      add constraint mrc_approval_request_fkey
      foreign key (approval_request_id) references public.approval_requests(id) on delete set null;
  end if;
end $$;
