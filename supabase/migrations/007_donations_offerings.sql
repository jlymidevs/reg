-- 007_donations_offerings.sql
-- Extends existing public.offerings in place (no rename, no data loss).
-- View public.donations gives new apps a clean name; offerings stays source of truth.

alter table public.offerings add column if not exists member_id uuid;
alter table public.offerings add column if not exists amount numeric(12,2);
alter table public.offerings add column if not exists currency text not null default 'PHP';
alter table public.offerings add column if not exists payment_method text;
alter table public.offerings add column if not exists reference_no text;
alter table public.offerings add column if not exists category text not null default 'offering';
alter table public.offerings add column if not exists notes text;
alter table public.offerings add column if not exists recorded_by uuid;
alter table public.offerings add column if not exists import_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'offerings_member_id_fkey' and conrelid = 'public.offerings'::regclass
  ) then
    alter table public.offerings
      add constraint offerings_member_id_fkey
      foreign key (member_id) references public.members(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'offerings_payment_method_check' and conrelid = 'public.offerings'::regclass
  ) then
    alter table public.offerings
      add constraint offerings_payment_method_check
      check (payment_method is null or payment_method in ('gcash','bank_transfer','cash','other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'offerings_recorded_by_fkey' and conrelid = 'public.offerings'::regclass
  ) then
    alter table public.offerings
      add constraint offerings_recorded_by_fkey
      foreign key (recorded_by) references auth.users(id) on delete set null;
  end if;
end $$;

create index if not exists offerings_member_idx on public.offerings (member_id);
create index if not exists offerings_giving_date_idx on public.offerings (giving_date);
create index if not exists offerings_email_lower_idx on public.offerings (lower(email)) where email is not null;

-- clean alias for new apps; security_invoker so RLS on offerings applies to callers
create or replace view public.donations
with (security_invoker = true) as
select
  id, created_at, giving_date, name, email,
  member_id, amount, currency, payment_method, reference_no, category, notes, recorded_by
from public.offerings;
