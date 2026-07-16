-- HeartLink reporting and communications use RPC-only mutations so their audit
-- records are committed in the same transaction as the user-visible change.
create table if not exists public.heartlink_reports (
  id uuid primary key default gen_random_uuid(),
  heartlink_id uuid not null references public.heartlinks(id) on delete restrict,
  category text not null check (char_length(btrim(category)) > 0),
  topic text not null check (char_length(btrim(topic)) > 0),
  venue text not null check (char_length(btrim(venue)) > 0),
  report_date date not null,
  started_at time,
  ended_at time,
  pastor text,
  coordinator text,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint heartlink_reports_time_order check (started_at is null or ended_at is null or ended_at >= started_at),
  constraint heartlink_reports_publication_state check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status = 'published' and published_at is not null and published_by is not null)
  )
);

create index if not exists heartlink_reports_heartlink_date_idx
  on public.heartlink_reports (heartlink_id, report_date desc);
create index if not exists heartlink_reports_topic_idx
  on public.heartlink_reports (topic);
create index if not exists heartlink_reports_venue_idx
  on public.heartlink_reports (venue);

create table if not exists public.heartlink_report_attendees (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.heartlink_reports(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  attendee_type text not null check (attendee_type in ('regular', 'first_time', 'child')),
  attendee_name text not null check (char_length(btrim(attendee_name)) > 0),
  created_at timestamptz not null default now(),
  unique (report_id, attendee_type, attendee_name)
);

create index if not exists heartlink_report_attendees_report_idx
  on public.heartlink_report_attendees (report_id, attendee_type);
create index if not exists heartlink_report_attendees_member_idx
  on public.heartlink_report_attendees (member_id)
  where member_id is not null;

-- The application can store non-sensitive per-user presentation preferences.
create table if not exists public.dashboard_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz not null default now()
);

-- Some deployed environments already have announcements outside this migration
-- history. Add the columns needed by the canonical PCM communications flow.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0),
  body text not null check (char_length(btrim(body)) > 0),
  audience text not null default 'church' check (audience in ('church', 'network', 'ministry', 'role')),
  target_network_id uuid references public.networks(id) on delete restrict,
  target_ministry_id uuid references public.ministries(id) on delete restrict,
  target_role_code text references public.roles(code) on update cascade on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_target_shape check (
    (audience = 'church' and target_network_id is null and target_ministry_id is null and target_role_code is null)
    or (audience = 'network' and target_network_id is not null and target_ministry_id is null and target_role_code is null)
    or (audience = 'ministry' and target_network_id is null and target_ministry_id is not null and target_role_code is null)
    or (audience = 'role' and target_network_id is null and target_ministry_id is null and target_role_code is not null)
  )
);

alter table public.announcements add column if not exists title text;
alter table public.announcements add column if not exists body text;
alter table public.announcements add column if not exists audience text default 'church';
alter table public.announcements add column if not exists target_network_id uuid references public.networks(id) on delete restrict;
alter table public.announcements add column if not exists target_ministry_id uuid references public.ministries(id) on delete restrict;
alter table public.announcements add column if not exists target_role_code text references public.roles(code) on update cascade on delete restrict;
alter table public.announcements add column if not exists status text default 'draft';
alter table public.announcements add column if not exists published_at timestamptz;
alter table public.announcements add column if not exists published_by uuid references auth.users(id) on delete set null;
alter table public.announcements add column if not exists archived_at timestamptz;
alter table public.announcements add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.announcements add column if not exists created_by uuid references auth.users(id) on delete restrict;
alter table public.announcements add column if not exists updated_by uuid references auth.users(id) on delete restrict;
alter table public.announcements add column if not exists created_at timestamptz default now();
alter table public.announcements add column if not exists updated_at timestamptz default now();

create index if not exists announcements_status_created_at_idx
  on public.announcements (status, created_at desc);
create index if not exists announcements_network_idx
  on public.announcements (target_network_id)
  where target_network_id is not null;
create index if not exists announcements_ministry_idx
  on public.announcements (target_ministry_id)
  where target_ministry_id is not null;

create or replace function public.can_manage_heartlink(p_heartlink_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.heartlinks h
    where h.id = p_heartlink_id
      and (
        public.is_admin()
        or public.has_role('pcm_staff')
        or exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id and r.code = 'network_head'
          where ur.user_id = auth.uid()
            and ur.is_active
            and (ur.expires_at is null or ur.expires_at > now())
            and ur.network_id = h.network_id
        )
        or exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id and r.code = 'ministry_head'
          join public.member_ministries mm on mm.ministry_id = ur.ministry_id and mm.is_active
          join public.member_heartlinks mh on mh.member_id = mm.member_id and mh.left_on is null
          where ur.user_id = auth.uid()
            and ur.is_active
            and (ur.expires_at is null or ur.expires_at > now())
            and mh.heartlink_id = h.id
        )
      )
  );
$$;

create or replace function public.can_manage_announcement(
  p_audience text,
  p_network_id uuid,
  p_ministry_id uuid,
  p_role_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or (
      p_audience = 'network'
      and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id and r.code = 'network_head'
        where ur.user_id = auth.uid()
          and ur.is_active
          and (ur.expires_at is null or ur.expires_at > now())
          and ur.network_id = p_network_id
      )
    )
    or (
      p_audience = 'ministry'
      and (
        exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id and r.code = 'ministry_head'
          where ur.user_id = auth.uid()
            and ur.is_active
            and (ur.expires_at is null or ur.expires_at > now())
            and ur.ministry_id = p_ministry_id
        )
        or exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id and r.code = 'network_head'
          join public.ministries m on m.network_id = ur.network_id
          where ur.user_id = auth.uid()
            and ur.is_active
            and (ur.expires_at is null or ur.expires_at > now())
            and m.id = p_ministry_id
        )
      )
    );
$$;

create or replace function public.can_view_announcement(
  p_audience text,
  p_network_id uuid,
  p_ministry_id uuid,
  p_role_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or (p_audience = 'church' and auth.uid() is not null)
    or (p_audience = 'role' and p_role_code is not null and public.has_role(p_role_code))
    or (
      p_audience = 'network'
      and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id and r.code = 'network_head'
        where ur.user_id = auth.uid()
          and ur.is_active
          and (ur.expires_at is null or ur.expires_at > now())
          and ur.network_id = p_network_id
      )
    )
    or (
      p_audience = 'network'
      and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id and r.code = 'ministry_head'
        join public.ministries m on m.id = ur.ministry_id
        where ur.user_id = auth.uid()
          and ur.is_active
          and (ur.expires_at is null or ur.expires_at > now())
          and m.network_id = p_network_id
      )
    )
    or (
      p_audience = 'ministry'
      and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id and r.code = 'ministry_head'
        where ur.user_id = auth.uid()
          and ur.is_active
          and (ur.expires_at is null or ur.expires_at > now())
          and ur.ministry_id = p_ministry_id
      )
    )
    or (
      p_audience = 'ministry'
      and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id and r.code = 'network_head'
        join public.ministries m on m.network_id = ur.network_id
        where ur.user_id = auth.uid()
          and ur.is_active
          and (ur.expires_at is null or ur.expires_at > now())
          and m.id = p_ministry_id
      )
    );
$$;

create or replace function public.pcm_scoped_heartlinks()
returns table (id uuid, name text, network_id uuid, network_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.name, h.network_id, n.name
  from public.heartlinks h
  left join public.networks n on n.id = h.network_id
  where public.can_manage_heartlink(h.id)
  order by h.name;
$$;

-- This selector keeps the target controls aligned with the same scope that
-- the announcement mutation enforces. Role targets are admin-only in the UI.
create or replace function public.pcm_scoped_announcement_targets()
returns table (audience text, id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'network'::text, n.id, n.name
  from public.networks n
  where public.is_admin()
     or exists (
       select 1
       from public.user_roles ur
       join public.roles r on r.id = ur.role_id and r.code = 'network_head'
       where ur.user_id = auth.uid()
         and ur.is_active
         and (ur.expires_at is null or ur.expires_at > now())
         and ur.network_id = n.id
     )
  union all
  select 'ministry'::text, m.id, m.name
  from public.ministries m
  where public.is_admin()
     or exists (
       select 1
       from public.user_roles ur
       join public.roles r on r.id = ur.role_id and r.code = 'ministry_head'
       where ur.user_id = auth.uid()
         and ur.is_active
         and (ur.expires_at is null or ur.expires_at > now())
         and ur.ministry_id = m.id
     )
     or exists (
       select 1
       from public.user_roles ur
       join public.roles r on r.id = ur.role_id and r.code = 'network_head'
       where ur.user_id = auth.uid()
         and ur.is_active
         and (ur.expires_at is null or ur.expires_at > now())
         and ur.network_id = m.network_id
     )
  order by 1, 3;
$$;

create or replace function public.pcm_save_heartlink_report(
  p_report_id uuid,
  p_heartlink_id uuid,
  p_category text,
  p_topic text,
  p_venue text,
  p_report_date date,
  p_started_at time default null,
  p_ended_at time default null,
  p_pastor text default null,
  p_coordinator text default null,
  p_notes text default null,
  p_attendees jsonb default '[]'::jsonb,
  p_publish boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_report public.heartlink_reports%rowtype;
  v_report_id uuid;
  v_attendee jsonb;
  v_attendee_type text;
  v_attendee_name text;
  v_was_published boolean := false;
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
    raise exception 'heartlink report access denied' using errcode = '42501';
  end if;

  if p_heartlink_id is null or not public.can_manage_heartlink(p_heartlink_id) then
    raise exception 'heartlink unavailable' using errcode = '42501';
  end if;

  if nullif(pg_catalog.btrim(p_category), '') is null
    or nullif(pg_catalog.btrim(p_topic), '') is null
    or nullif(pg_catalog.btrim(p_venue), '') is null
    or p_report_date is null then
    raise exception 'invalid heartlink report input' using errcode = '22023';
  end if;

  if p_started_at is not null and p_ended_at is not null and p_ended_at < p_started_at then
    raise exception 'invalid heartlink report times' using errcode = '22023';
  end if;

  if p_attendees is null or jsonb_typeof(p_attendees) <> 'array' then
    raise exception 'invalid heartlink attendees' using errcode = '22023';
  end if;

  if p_report_id is null then
    insert into public.heartlink_reports (
      heartlink_id, category, topic, venue, report_date, started_at, ended_at,
      pastor, coordinator, notes, status, published_at, published_by, created_by, updated_by
    )
    values (
      p_heartlink_id,
      pg_catalog.btrim(p_category),
      pg_catalog.btrim(p_topic),
      pg_catalog.btrim(p_venue),
      p_report_date,
      p_started_at,
      p_ended_at,
      nullif(pg_catalog.btrim(p_pastor), ''),
      nullif(pg_catalog.btrim(p_coordinator), ''),
      nullif(pg_catalog.btrim(p_notes), ''),
      case when p_publish then 'published' else 'draft' end,
      case when p_publish then now() else null end,
      case when p_publish then v_actor_id else null end,
      v_actor_id,
      v_actor_id
    )
    returning id into v_report_id;

    insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, after)
    values (
      v_actor_id,
      'create_heartlink_report',
      'heartlink_reports',
      v_report_id::text,
      jsonb_build_object('heartlink_id', p_heartlink_id, 'status', case when p_publish then 'published' else 'draft' end)
    );
  else
    select *
    into v_report
    from public.heartlink_reports
    where id = p_report_id
      and public.can_manage_heartlink(heartlink_id)
    for update;

    if not found then
      raise exception 'heartlink report unavailable' using errcode = 'P0002';
    end if;

    v_was_published := v_report.status = 'published';
    update public.heartlink_reports
    set heartlink_id = p_heartlink_id,
        category = pg_catalog.btrim(p_category),
        topic = pg_catalog.btrim(p_topic),
        venue = pg_catalog.btrim(p_venue),
        report_date = p_report_date,
        started_at = p_started_at,
        ended_at = p_ended_at,
        pastor = nullif(pg_catalog.btrim(p_pastor), ''),
        coordinator = nullif(pg_catalog.btrim(p_coordinator), ''),
        notes = nullif(pg_catalog.btrim(p_notes), ''),
        status = case when p_publish then 'published' else status end,
        published_at = case when p_publish and status <> 'published' then now() else published_at end,
        published_by = case when p_publish and status <> 'published' then v_actor_id else published_by end,
        updated_by = v_actor_id,
        updated_at = now()
    where id = v_report.id
    returning id into v_report_id;

    insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, before, after)
    values (
      v_actor_id,
      'update_heartlink_report',
      'heartlink_reports',
      v_report_id::text,
      jsonb_build_object('status', v_report.status, 'heartlink_id', v_report.heartlink_id),
      jsonb_build_object('status', case when p_publish then 'published' else v_report.status end, 'heartlink_id', p_heartlink_id)
    );
  end if;

  delete from public.heartlink_report_attendees where report_id = v_report_id;

  for v_attendee in select value from jsonb_array_elements(p_attendees)
  loop
    v_attendee_type := nullif(pg_catalog.btrim(v_attendee ->> 'attendee_type'), '');
    v_attendee_name := nullif(pg_catalog.btrim(v_attendee ->> 'attendee_name'), '');
    if v_attendee_type not in ('regular', 'first_time', 'child') or v_attendee_name is null then
      raise exception 'invalid heartlink attendees' using errcode = '22023';
    end if;

    insert into public.heartlink_report_attendees (report_id, attendee_type, attendee_name)
    values (v_report_id, v_attendee_type, v_attendee_name);
  end loop;

  if p_publish and not v_was_published then
    insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, after)
    values (
      v_actor_id,
      'publish_heartlink_report',
      'heartlink_reports',
      v_report_id::text,
      jsonb_build_object('status', 'published')
    );
  end if;

  return v_report_id;
end;
$$;

create or replace function public.pcm_save_announcement(
  p_announcement_id uuid,
  p_title text,
  p_body text,
  p_audience text,
  p_target_id uuid default null,
  p_target_role_code text default null,
  p_publish boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_announcement public.announcements%rowtype;
  v_announcement_id uuid;
  v_network_id uuid;
  v_ministry_id uuid;
  v_role_code text;
  v_was_published boolean := false;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not (public.is_admin() or public.has_role('network_head') or public.has_role('ministry_head')) then
    raise exception 'announcement access denied' using errcode = '42501';
  end if;

  if nullif(pg_catalog.btrim(p_title), '') is null or nullif(pg_catalog.btrim(p_body), '') is null then
    raise exception 'invalid announcement input' using errcode = '22023';
  end if;

  v_network_id := case when p_audience = 'network' then p_target_id else null end;
  v_ministry_id := case when p_audience = 'ministry' then p_target_id else null end;
  v_role_code := case when p_audience = 'role' then nullif(pg_catalog.btrim(p_target_role_code), '') else null end;

  if p_audience not in ('church', 'network', 'ministry', 'role')
    or (p_audience in ('network', 'ministry') and p_target_id is null)
    or (p_audience = 'role' and v_role_code is null)
    or (p_audience = 'church' and (p_target_id is not null or p_target_role_code is not null)) then
    raise exception 'invalid announcement target' using errcode = '22023';
  end if;

  if v_network_id is not null and not exists (select 1 from public.networks where id = v_network_id) then
    raise exception 'invalid announcement target' using errcode = '22023';
  end if;
  if v_ministry_id is not null and not exists (select 1 from public.ministries where id = v_ministry_id) then
    raise exception 'invalid announcement target' using errcode = '22023';
  end if;
  if v_role_code is not null and not exists (select 1 from public.roles where code = v_role_code) then
    raise exception 'invalid announcement target' using errcode = '22023';
  end if;

  if not public.can_manage_announcement(p_audience, v_network_id, v_ministry_id, v_role_code) then
    raise exception 'announcement target unavailable' using errcode = '42501';
  end if;

  if p_announcement_id is null then
    insert into public.announcements (
      title, body, audience, target_network_id, target_ministry_id, target_role_code,
      status, published_at, published_by, created_by, updated_by
    )
    values (
      pg_catalog.btrim(p_title),
      pg_catalog.btrim(p_body),
      p_audience,
      v_network_id,
      v_ministry_id,
      v_role_code,
      case when p_publish then 'published' else 'draft' end,
      case when p_publish then now() else null end,
      case when p_publish then v_actor_id else null end,
      v_actor_id,
      v_actor_id
    )
    returning id into v_announcement_id;

    insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, after)
    values (
      v_actor_id,
      'create_announcement',
      'announcements',
      v_announcement_id::text,
      jsonb_build_object('audience', p_audience, 'status', case when p_publish then 'published' else 'draft' end)
    );
  else
    select *
    into v_announcement
    from public.announcements
    where id = p_announcement_id
      and public.can_manage_announcement(audience, target_network_id, target_ministry_id, target_role_code)
    for update;

    if not found then
      raise exception 'announcement unavailable' using errcode = 'P0002';
    end if;

    v_was_published := v_announcement.status = 'published';
    update public.announcements
    set title = pg_catalog.btrim(p_title),
        body = pg_catalog.btrim(p_body),
        audience = p_audience,
        target_network_id = v_network_id,
        target_ministry_id = v_ministry_id,
        target_role_code = v_role_code,
        status = case when p_publish then 'published' else status end,
        published_at = case when p_publish and status <> 'published' then now() else published_at end,
        published_by = case when p_publish and status <> 'published' then v_actor_id else published_by end,
        updated_by = v_actor_id,
        updated_at = now()
    where id = v_announcement.id
    returning id into v_announcement_id;

    insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, before, after)
    values (
      v_actor_id,
      'update_announcement',
      'announcements',
      v_announcement_id::text,
      jsonb_build_object('audience', v_announcement.audience, 'status', v_announcement.status),
      jsonb_build_object('audience', p_audience, 'status', case when p_publish then 'published' else v_announcement.status end)
    );
  end if;

  if p_publish and not v_was_published then
    insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, after)
    values (
      v_actor_id,
      'publish_announcement',
      'announcements',
      v_announcement_id::text,
      jsonb_build_object('status', 'published')
    );
  end if;

  return v_announcement_id;
end;
$$;

create or replace function public.pcm_archive_announcement(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_announcement public.announcements%rowtype;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select *
  into v_announcement
  from public.announcements
  where id = p_announcement_id
    and public.can_manage_announcement(audience, target_network_id, target_ministry_id, target_role_code)
  for update;

  if not found then
    raise exception 'announcement unavailable' using errcode = 'P0002';
  end if;

  update public.announcements
  set status = 'archived',
      archived_at = now(),
      archived_by = v_actor_id,
      updated_by = v_actor_id,
      updated_at = now()
  where id = v_announcement.id;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    v_actor_id,
    'archive_announcement',
    'announcements',
    v_announcement.id::text,
    jsonb_build_object('status', v_announcement.status),
    jsonb_build_object('status', 'archived')
  );
end;
$$;

alter table public.heartlink_reports enable row level security;
alter table public.heartlink_report_attendees enable row level security;
alter table public.announcements enable row level security;
alter table public.dashboard_preferences enable row level security;

drop policy if exists heartlink_reports_select on public.heartlink_reports;
create policy heartlink_reports_select on public.heartlink_reports
  for select to authenticated
  using (public.can_manage_heartlink(heartlink_id));

drop policy if exists heartlink_report_attendees_select on public.heartlink_report_attendees;
create policy heartlink_report_attendees_select on public.heartlink_report_attendees
  for select to authenticated
  using (
    exists (
      select 1
      from public.heartlink_reports r
      where r.id = report_id
        and public.can_manage_heartlink(r.heartlink_id)
    )
  );

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (public.can_view_announcement(audience, target_network_id, target_ministry_id, target_role_code));

drop policy if exists dashboard_preferences_select on public.dashboard_preferences;
create policy dashboard_preferences_select on public.dashboard_preferences
  for select to authenticated
  using (user_id = auth.uid());
drop policy if exists dashboard_preferences_insert on public.dashboard_preferences;
create policy dashboard_preferences_insert on public.dashboard_preferences
  for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists dashboard_preferences_update on public.dashboard_preferences;
create policy dashboard_preferences_update on public.dashboard_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.heartlink_reports from public, anon, authenticated;
revoke all on table public.heartlink_report_attendees from public, anon, authenticated;
revoke all on table public.announcements from public, anon, authenticated;
revoke all on table public.dashboard_preferences from public, anon, authenticated;
grant select on table public.heartlink_reports to authenticated;
grant select on table public.heartlink_report_attendees to authenticated;
grant select on table public.announcements to authenticated;
grant select, insert, update on table public.dashboard_preferences to authenticated;

revoke all on function public.can_manage_heartlink(uuid) from public, anon;
revoke all on function public.can_manage_announcement(text, uuid, uuid, text) from public, anon;
revoke all on function public.can_view_announcement(text, uuid, uuid, text) from public, anon;
revoke all on function public.pcm_scoped_heartlinks() from public, anon;
revoke all on function public.pcm_scoped_announcement_targets() from public, anon;
revoke all on function public.pcm_save_heartlink_report(uuid, uuid, text, text, text, date, time, time, text, text, text, jsonb, boolean) from public, anon;
revoke all on function public.pcm_save_announcement(uuid, text, text, text, uuid, text, boolean) from public, anon;
revoke all on function public.pcm_archive_announcement(uuid) from public, anon;
grant execute on function public.can_manage_heartlink(uuid) to authenticated;
grant execute on function public.can_manage_announcement(text, uuid, uuid, text) to authenticated;
grant execute on function public.can_view_announcement(text, uuid, uuid, text) to authenticated;
grant execute on function public.pcm_scoped_heartlinks() to authenticated;
grant execute on function public.pcm_scoped_announcement_targets() to authenticated;
grant execute on function public.pcm_save_heartlink_report(uuid, uuid, text, text, text, date, time, time, text, text, text, jsonb, boolean) to authenticated;
grant execute on function public.pcm_save_announcement(uuid, text, text, text, uuid, text, boolean) to authenticated;
grant execute on function public.pcm_archive_announcement(uuid) to authenticated;
