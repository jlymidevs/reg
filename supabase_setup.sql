-- JLYCC Event Registration — run once in Supabase SQL editor (project gadjquxavyxsftnwurfo)
-- Adds ONLY new objects/policies. Does not modify existing church-platform tables or policies.

-- ---------------------------------------------------------------------------
-- 1. Admin check helper (email-based, matches existing admin_users table)
-- ---------------------------------------------------------------------------
create or replace function public.is_reg_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_reg_admin to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Public registration RPC (security definer so anon can register without
--    open insert policies; enforces capacity / past-event / active checks
--    server-side, atomically)
-- ---------------------------------------------------------------------------
create or replace function public.register_for_event(
  p_event_id uuid,
  p_first_name text,
  p_surname text,
  p_phone text,
  p_address text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event events%rowtype;
  v_active_count integer;
  v_member_id uuid;
begin
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_surname), '') = '' then
    raise exception 'First name and surname are required.';
  end if;
  if p_phone !~ '^\+639\d{9}$' then
    raise exception 'Phone must be in format +639XXXXXXXXX.';
  end if;

  select * into v_event
  from events
  where id = p_event_id
    and is_active = true
    and is_published = true
  for update;

  if not found then
    raise exception 'This event is not open for registration.';
  end if;

  if v_event.ends_at < now() then
    raise exception 'This event has already ended.';
  end if;

  if v_event.capacity is not null then
    select count(*) into v_active_count
    from event_registrations
    where event_id = p_event_id
      and status <> 'cancelled';

    if v_active_count >= v_event.capacity then
      raise exception 'This event is fully booked.';
    end if;
  end if;

  -- Reuse existing member by phone so repeat attendees don't duplicate
  select id into v_member_id
  from members
  where phone = p_phone
  limit 1;

  if v_member_id is null then
    insert into members (first_name, surname, phone, address)
    values (trim(p_first_name), trim(p_surname), p_phone, nullif(trim(p_address), ''))
    returning id into v_member_id;
  end if;

  -- Block duplicate active registration for the same event
  if exists (
    select 1 from event_registrations
    where event_id = p_event_id
      and member_id = v_member_id
      and status <> 'cancelled'
  ) then
    raise exception 'This phone number is already registered for this event.';
  end if;

  insert into event_registrations (event_id, member_id, status, notes)
  values (p_event_id, v_member_id, 'registered', nullif(trim(p_notes), ''));

  return jsonb_build_object('ok', true, 'member_id', v_member_id);
end;
$$;

grant execute on function public.register_for_event to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Admin policies for the registration dashboard (additive; permissive OR
--    with any existing policies)
-- ---------------------------------------------------------------------------
drop policy if exists "reg_admin_select_events" on events;
create policy "reg_admin_select_events" on events
  for select to authenticated using (public.is_reg_admin());

drop policy if exists "reg_admin_insert_events" on events;
create policy "reg_admin_insert_events" on events
  for insert to authenticated with check (public.is_reg_admin());

drop policy if exists "reg_admin_update_events" on events;
create policy "reg_admin_update_events" on events
  for update to authenticated
  using (public.is_reg_admin()) with check (public.is_reg_admin());

drop policy if exists "reg_admin_select_registrations" on event_registrations;
create policy "reg_admin_select_registrations" on event_registrations
  for select to authenticated using (public.is_reg_admin());

drop policy if exists "reg_admin_update_registrations" on event_registrations;
create policy "reg_admin_update_registrations" on event_registrations
  for update to authenticated
  using (public.is_reg_admin()) with check (public.is_reg_admin());

drop policy if exists "reg_admin_select_members" on members;
create policy "reg_admin_select_members" on members
  for select to authenticated using (public.is_reg_admin());

drop policy if exists "reg_admin_read_own_admin_row" on admin_users;
create policy "reg_admin_read_own_admin_row" on admin_users
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ---------------------------------------------------------------------------
-- 4. Make sure your admin exists (replace email; auth user must also exist in
--    Authentication > Users with a password)
-- ---------------------------------------------------------------------------
-- insert into admin_users (email) values ('your-admin@email.com')
--   on conflict do nothing;
