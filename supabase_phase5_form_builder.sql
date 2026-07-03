-- JLYCC Reg — Phase 5: Registration form builder (simple editor, not
-- drag-and-drop — matches the spec's own fallback for when drag-and-drop
-- is too much). Additive only. Run once AFTER supabase_phase3_feedback.sql.
--
-- Scope for this pass (documented deferrals):
--   - No conditional fields (e.g. "if minor, show guardian fields") — the
--     fixed guest_* / consent_given columns already on event_registrations
--     partially cover common cases; a real conditional-logic engine is a
--     bigger follow-up.
--   - No file upload field type — needs a Storage bucket + validation,
--     deferred until a concrete use case needs it.
--   - Field configs are a jsonb array on events.form_fields, not a
--     separate form_fields table — simplest structure for "one form per
--     event", matches how admission fields already work (no multi-version
--     form history needed yet).

alter table events add column if not exists form_fields jsonb not null default '[]';
alter table event_registrations add column if not exists form_response jsonb not null default '{}';

-- register_for_event gains p_form_response; old 7-arg signature must be
-- dropped explicitly (same pattern as the v1→v2 upgrade).
drop function if exists public.register_for_event(uuid, text, text, text, text, text, text);

create or replace function public.register_for_event(
  p_event_id uuid,
  p_first_name text,
  p_surname text,
  p_phone text,
  p_address text default null,
  p_notes text default null,
  p_email text default null,
  p_form_response jsonb default '{}'
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

  select id into v_member_id
  from members
  where phone = p_phone
  limit 1;

  if v_member_id is null then
    insert into members (first_name, surname, name, phone, address, email)
    values (trim(p_first_name), trim(p_surname), trim(p_first_name) || ' ' || trim(p_surname), p_phone, nullif(trim(p_address), ''), v_email)
    returning id into v_member_id;
  elsif v_email is not null then
    update members set email = v_email
    where id = v_member_id and email is null;
  end if;

  if exists (
    select 1 from event_registrations
    where event_id = p_event_id
      and member_id = v_member_id
      and status <> 'cancelled'
  ) then
    raise exception 'This phone number is already registered for this event.';
  end if;

  insert into event_registrations (event_id, member_id, status, notes, form_response)
  values (p_event_id, v_member_id, 'registered', nullif(trim(p_notes), ''), coalesce(p_form_response, '{}'));

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

revoke execute on function public.register_for_event(uuid, text, text, text, text, text, text, jsonb) from anon, authenticated, public;
grant execute on function public.register_for_event(uuid, text, text, text, text, text, text, jsonb) to service_role;
