-- Production Excel staging pipeline for PCM. Writes are admin-only and audited.
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_type text not null default 'PCM' check (file_type in ('PCM', 'ISU')),
  status text not null default 'staging' check (status in ('staging', 'reviewed', 'committed', 'rolled_back')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data_json jsonb not null,
  normalized_data_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'exact_match', 'candidate', 'new_record', 'rejected', 'committed', 'rolled_back')),
  matched_member_id uuid references public.members(id) on delete set null,
  error_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_id uuid not null references public.import_rows(id) on delete cascade,
  field_name text not null,
  error_message text not null,
  raw_value text,
  created_at timestamptz not null default now()
);

create table if not exists public.duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_id uuid not null references public.import_rows(id) on delete cascade,
  master_member_id uuid not null references public.members(id) on delete cascade,
  match_reason text not null,
  status text not null default 'pending' check (status in ('pending', 'merged', 'rejected', 'created_new')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists import_rows_batch_idx on public.import_rows(batch_id, row_number);
create index if not exists import_errors_batch_idx on public.import_errors(batch_id);
create index if not exists duplicate_candidates_batch_idx on public.duplicate_candidates(batch_id, status);

alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
alter table public.import_errors enable row level security;
alter table public.duplicate_candidates enable row level security;

drop policy if exists import_batches_admin_all on public.import_batches;
create policy import_batches_admin_all on public.import_batches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists import_rows_admin_all on public.import_rows;
create policy import_rows_admin_all on public.import_rows for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists import_errors_admin_all on public.import_errors;
create policy import_errors_admin_all on public.import_errors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists duplicate_candidates_admin_all on public.duplicate_candidates;
create policy duplicate_candidates_admin_all on public.duplicate_candidates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.match_import_duplicates(p_batch_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare r record; m record;
begin
  if not public.is_admin() then raise exception 'Import review is unavailable'; end if;
  for r in select * from public.import_rows where batch_id = p_batch_id and status = 'pending' loop
    select * into m from public.members
    where (nullif(r.normalized_data_json->>'email', '') is not null and lower(email) = lower(r.normalized_data_json->>'email'))
       or (nullif(r.normalized_data_json->>'phone', '') is not null and phone = r.normalized_data_json->>'phone')
    order by id limit 1;
    if found then
      update public.import_rows set status = 'exact_match', matched_member_id = m.id, updated_at = now() where id = r.id;
    else
      update public.import_rows set status = 'new_record', updated_at = now() where id = r.id;
    end if;
  end loop;
  update public.import_batches set status = 'reviewed', updated_at = now() where id = p_batch_id;
end;
$$;

create or replace function public.commit_import_batch(p_batch_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; member_id uuid; actor uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'Import apply is unavailable'; end if;
  if exists (select 1 from public.duplicate_candidates where batch_id = p_batch_id and status = 'pending')
    then raise exception 'Resolve duplicate candidates before applying this batch'; end if;
  if exists (select 1 from public.import_errors where batch_id = p_batch_id)
    then raise exception 'Resolve import errors before applying this batch'; end if;
  for r in select * from public.import_rows where batch_id = p_batch_id and status in ('new_record', 'exact_match') loop
    if r.status = 'exact_match' then
      member_id := r.matched_member_id;
      update public.members set
        first_name = coalesce(nullif(first_name, ''), r.normalized_data_json->>'first_name'),
        surname = coalesce(nullif(surname, ''), r.normalized_data_json->>'last_name'),
        email = coalesce(nullif(email, ''), r.normalized_data_json->>'email'),
        phone = coalesce(nullif(phone, ''), r.normalized_data_json->>'phone')
      where id = member_id;
    else
      insert into public.members(first_name, surname, email, phone, birth_date, journey_status)
      values (r.normalized_data_json->>'first_name', r.normalized_data_json->>'last_name', nullif(r.normalized_data_json->>'email',''), nullif(r.normalized_data_json->>'phone',''),
        case when r.normalized_data_json->>'date_of_birth' ~ '^\\d{4}-\\d{2}-\\d{2}$' then (r.normalized_data_json->>'date_of_birth')::date end, nullif(r.normalized_data_json->>'journey_status',''))
      returning id into member_id;
    end if;
    update public.import_rows set status = 'committed', matched_member_id = member_id, updated_at = now() where id = r.id;
    insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, after)
      values (actor, 'import_batch_apply', 'members', member_id::text, jsonb_build_object('batch_id', p_batch_id, 'row_id', r.id));
  end loop;
  update public.import_batches set status = 'committed', updated_at = now() where id = p_batch_id;
end;
$$;

create or replace function public.rollback_import_batch(p_batch_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Import rollback is unavailable'; end if;
  update public.import_rows set status = 'rolled_back', updated_at = now() where batch_id = p_batch_id and status <> 'committed';
  update public.import_batches set status = 'rolled_back', updated_at = now() where id = p_batch_id and status <> 'committed';
end;
$$;

revoke all on function public.match_import_duplicates(uuid) from public, anon;
revoke all on function public.commit_import_batch(uuid) from public, anon;
revoke all on function public.rollback_import_batch(uuid) from public, anon;
grant execute on function public.match_import_duplicates(uuid) to authenticated;
grant execute on function public.commit_import_batch(uuid) to authenticated;
grant execute on function public.rollback_import_batch(uuid) to authenticated;
