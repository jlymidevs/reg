-- JLYCC Event Registration v2 — Turnstile + email confirmation upgrade
-- Run once in Supabase SQL editor AFTER supabase_setup.sql.
--
-- Changes:
--   1. register_for_event gains optional p_email, returns event details
--      (used by the register Edge Function to compose the confirmation email).
--   2. Direct anon/authenticated execution is revoked — the public path is now
--      the `register` Edge Function only, which verifies Cloudflare Turnstile
--      before calling this RPC with the service role.

-- Old 6-arg signature must be dropped explicitly, otherwise CREATE OR REPLACE
-- with a new signature would leave both overloads callable.
drop function if exists public.register_for_event(uuid, text, text, text, text, text);

create or replace function public.register_for_event(
  p_event_id uuid,
  p_first_name text,
  p_surname text,
  p_phone text,
  p_address text default null,
  p_notes text default null,
  p_email text default null
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
  v_email text;
begin
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_surname), '') = '' then
    raise exception 'First name and surname are required.';
  end if;
  if p_phone !~ '^\+639\d{9}$' then
    raise exception 'Phone must be in format +639XXXXXXXXX.';
  end if;

  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Email address is not valid.';
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
    insert into members (first_name, surname, name, phone, address, email)
    values (trim(p_first_name), trim(p_surname), trim(p_first_name) || ' ' || trim(p_surname), p_phone, nullif(trim(p_address), ''), v_email)
    returning id into v_member_id;
  elsif v_email is not null then
    -- Backfill email for returning members who didn't provide one before
    update members set email = v_email
    where id = v_member_id and email is null;
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

  return jsonb_build_object(
    'ok', true,
    'member_id', v_member_id,
    'email', v_email,
    'event', jsonb_build_object(
      'title', v_event.title,
      'starts_at', v_event.starts_at,
      'ends_at', v_event.ends_at,
      'venue', v_event.venue
    )
  );
end;
$$;

-- Public path is now the register Edge Function (service role) only.
revoke execute on function public.register_for_event(uuid, text, text, text, text, text, text) from anon, authenticated, public;
grant execute on function public.register_for_event(uuid, text, text, text, text, text, text) to service_role;
