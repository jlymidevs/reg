-- Restore PCM pipeline drop guardrails and persistent reason metadata.
alter table public.members add column if not exists dropped_reason text;
alter table public.members add column if not exists dropped_at timestamptz;
alter table public.members add column if not exists dropped_by uuid references auth.users(id);

do $$
begin
  alter table public.members drop constraint if exists members_journey_status_check;
  alter table public.members add constraint members_journey_status_check
    check (journey_status is null or journey_status in ('FTV','OGV','RM','AM','DROPPED'));
end $$;

create index if not exists members_dropped_at_idx on public.members (dropped_at)
  where dropped_at is not null;
