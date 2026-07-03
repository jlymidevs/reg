-- JLYCC Reg — Phase 3: Feedback engine (balanced 20-person sampling,
-- admin preview/confirm-before-send, public token-based feedback form).
-- Additive only. Run once AFTER supabase_phase2_checkin.sql.
--
-- Design notes:
--   - Feedback questions are the fixed 12-question set from the spec, not a
--     builder — stored as jsonb keyed q1..q12 on feedback_responses, plus a
--     dedicated overall_rating column for fast aggregate queries.
--   - Eligibility for a feedback batch: checked in (real check_ins row, not
--     just registered), member_type = 'regular_member' in
--     event_reg_member_meta (members with no meta row default to
--     regular_member per Phase 1), valid email on the shared members
--     table, communication_consent = true, unsubscribed = false, and not
--     already sent a feedback request for this event (checked against
--     feedback_email_recipients across ALL batches for the event, not just
--     the current draft).
--   - Balanced sampling: stratifies by (age_bracket, gender) bucket and
--     round-robins across buckets so no single bucket dominates the 20;
--     final tie-break is random() within each bucket. age_bracket/gender
--     are optional — members with either unset just form their own bucket.
--   - "Regenerate" = call generate_feedback_batch again while the batch is
--     still 'draft'; it clears and re-rolls that batch's recipients.

create table if not exists feedback_surveys (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null default 'Event Feedback',
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists feedback_surveys_one_per_event on feedback_surveys (event_id);

create table if not exists feedback_email_batches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  survey_id uuid not null references feedback_surveys(id) on delete cascade,
  created_by text,
  eligible_count integer not null default 0,
  selected_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists feedback_email_recipients (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references feedback_email_batches(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'responded')),
  sent_at timestamptz,
  error_message text
);

create index if not exists feedback_email_recipients_event_idx on feedback_email_recipients (event_id);
create index if not exists feedback_email_recipients_batch_idx on feedback_email_recipients (batch_id);

create table if not exists feedback_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  is_anonymous boolean not null default false,
  overall_rating integer check (overall_rating between 1 and 5),
  answers jsonb not null default '{}',
  follow_up_requested boolean not null default false,
  submitted_at timestamptz not null default now()
);

create index if not exists feedback_responses_event_idx on feedback_responses (event_id);

-- ---------------------------------------------------------------------------
-- RLS — admin read/manage everything; the public only ever touches this
-- data through the SECURITY DEFINER RPCs below (token-gated), never a
-- direct table policy.
-- ---------------------------------------------------------------------------
alter table feedback_surveys enable row level security;
alter table feedback_email_batches enable row level security;
alter table feedback_email_recipients enable row level security;
alter table feedback_responses enable row level security;

drop policy if exists "reg_admin_manage_feedback_surveys" on feedback_surveys;
create policy "reg_admin_manage_feedback_surveys" on feedback_surveys
  for all to authenticated using (public.is_reg_admin()) with check (public.is_reg_admin());

drop policy if exists "reg_admin_select_feedback_batches" on feedback_email_batches;
create policy "reg_admin_select_feedback_batches" on feedback_email_batches
  for select to authenticated using (public.is_reg_admin());

drop policy if exists "reg_admin_select_feedback_recipients" on feedback_email_recipients;
create policy "reg_admin_select_feedback_recipients" on feedback_email_recipients
  for select to authenticated using (public.is_reg_admin());

drop policy if exists "reg_admin_select_feedback_responses" on feedback_responses;
create policy "reg_admin_select_feedback_responses" on feedback_responses
  for select to authenticated using (public.is_reg_admin());
-- Anonymous responses (is_anonymous = true) still show member_id to admins
-- at the table level for now — the UI is responsible for hiding identity
-- when is_anonymous is true. Tightening this to a DB-level anonymized view
-- is a good Phase 4 follow-up once reporting is built.

-- ---------------------------------------------------------------------------
-- generate_feedback_batch — admin only. Creates the survey row on first
-- call, (re)selects up to 20 eligible regular members with balanced
-- sampling, and returns a preview. Safe to call repeatedly while draft.
-- ---------------------------------------------------------------------------
create or replace function public.generate_feedback_batch(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey_id uuid;
  v_batch_id uuid;
  v_eligible_count integer;
  v_selected_count integer;
  v_actor text := coalesce(auth.jwt() ->> 'email', '');
begin
  if not public.is_reg_admin() then
    raise exception 'Not authorized.';
  end if;

  insert into feedback_surveys (event_id)
  values (p_event_id)
  on conflict (event_id) do update set updated_at = now()
  returning id into v_survey_id;

  select id into v_batch_id from feedback_email_batches
  where event_id = p_event_id and status = 'draft'
  order by created_at desc limit 1;

  if v_batch_id is null then
    insert into feedback_email_batches (event_id, survey_id, created_by)
    values (p_event_id, v_survey_id, v_actor)
    returning id into v_batch_id;
  else
    delete from feedback_email_recipients where batch_id = v_batch_id;
  end if;

  create temp table _eligible on commit drop as
  select
    m.id as member_id,
    m.email,
    coalesce(meta.age_bracket, 'unspecified') as bucket_age,
    coalesce(m.gender, 'unspecified') as bucket_gender
  from members m
  join check_ins c on c.member_id = m.id and c.event_id = p_event_id
  left join event_reg_member_meta meta on meta.member_id = m.id
  where coalesce(meta.member_type, 'regular_member') = 'regular_member'
    and coalesce(meta.communication_consent, true) = true
    and coalesce(meta.unsubscribed, false) = false
    and m.email is not null and m.email <> ''
    and not exists (
      select 1 from feedback_email_recipients fer
      where fer.event_id = p_event_id and fer.member_id = m.id
    );

  select count(*) into v_eligible_count from _eligible;

  -- Balanced round-robin: rank members within their (age, gender) bucket
  -- randomly, then take rank 1 from every bucket before rank 2, etc.,
  -- until 20 (or all eligible, if fewer) are picked.
  with ranked as (
    select
      member_id, email,
      row_number() over (partition by bucket_age, bucket_gender order by random()) as bucket_rank
    from _eligible
  ),
  ordered as (
    select member_id, email, row_number() over (order by bucket_rank, random()) as pick_order
    from ranked
  )
  insert into feedback_email_recipients (batch_id, event_id, member_id, email)
  select v_batch_id, p_event_id, member_id, email
  from ordered
  where pick_order <= 20;

  get diagnostics v_selected_count = row_count;

  update feedback_email_batches
  set eligible_count = v_eligible_count, selected_count = v_selected_count
  where id = v_batch_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'eligible_count', v_eligible_count,
    'selected_count', v_selected_count,
    'warning', case when v_eligible_count < 20 then
      format('Only %s eligible regular members are available for feedback request.', v_eligible_count)
    else null end
  );
end;
$$;

grant execute on function public.generate_feedback_batch to authenticated;

-- ---------------------------------------------------------------------------
-- Public, token-gated feedback submission — no admin/auth required, mirrors
-- the trust model of the original public registration RPC.
-- ---------------------------------------------------------------------------
create or replace function public.get_feedback_context(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient feedback_email_recipients%rowtype;
  v_event events%rowtype;
begin
  select * into v_recipient from feedback_email_recipients where token = p_token;
  if not found then
    raise exception 'This feedback link is not valid.';
  end if;

  select * into v_event from events where id = v_recipient.event_id;

  return jsonb_build_object(
    'event_title', v_event.title,
    'already_responded', v_recipient.status = 'responded'
  );
end;
$$;

grant execute on function public.get_feedback_context to anon, authenticated;

create or replace function public.submit_feedback_response(
  p_token uuid,
  p_overall_rating integer,
  p_answers jsonb,
  p_is_anonymous boolean default false,
  p_follow_up_requested boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient feedback_email_recipients%rowtype;
begin
  select * into v_recipient from feedback_email_recipients where token = p_token;
  if not found then
    raise exception 'This feedback link is not valid.';
  end if;

  if v_recipient.status = 'responded' then
    raise exception 'Feedback for this event has already been submitted.';
  end if;

  if p_overall_rating is null or p_overall_rating < 1 or p_overall_rating > 5 then
    raise exception 'Overall rating must be between 1 and 5.';
  end if;

  insert into feedback_responses (event_id, member_id, is_anonymous, overall_rating, answers, follow_up_requested)
  values (
    v_recipient.event_id,
    case when p_is_anonymous then null else v_recipient.member_id end,
    p_is_anonymous,
    p_overall_rating,
    p_answers,
    p_follow_up_requested
  );

  update feedback_email_recipients set status = 'responded' where token = p_token;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_feedback_response to anon, authenticated;

drop trigger if exists audit_feedback_batches on feedback_email_batches;
create trigger audit_feedback_batches
  after insert or update or delete on feedback_email_batches
  for each row execute function public.log_audit_event();
