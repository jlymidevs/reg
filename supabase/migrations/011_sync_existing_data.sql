-- 011_sync_existing_data.sql
-- One-time (but re-runnable) sync of legacy text columns into normalized tables.
-- Run AFTER seed.sql. Every statement only fills gaps; nothing overwrites manual edits.
-- Mappings tuned against the 2026-07 audit of live distinct values.
-- Legacy columns stay untouched as audit trail; import_source='legacy_sync' marks synced rows.

-- ---------------------------------------------------------------------------
-- 1) member_code: JLY-<number> when number exists, else sequential by created_at
-- ---------------------------------------------------------------------------
update public.members
set member_code = 'JLY-' || lpad(number::text, 5, '0')
where member_code is null and number is not null;

with numbered as (
  select id, row_number() over (order by created_at, id)
         + coalesce((select max(number) from public.members), 0) as seq
  from public.members
  where member_code is null
)
update public.members m
set member_code = 'JLY-' || lpad(n.seq::text, 5, '0')
from numbered n where n.id = m.id;

-- ---------------------------------------------------------------------------
-- 2) qr_code_value: opaque 32-hex token, no PII
-- ---------------------------------------------------------------------------
update public.members
set qr_code_value = encode(gen_random_bytes(16), 'hex')
where qr_code_value is null;

-- ---------------------------------------------------------------------------
-- 3) status_in_church -> journey_status
--    Live values are mostly ministry names / roles, NOT FTV/OGV/RM/AM.
--    Only two unambiguous mappings exist: Regular -> RM, Active -> AM.
--    Everything else stays NULL for manual triage in admin portal.
-- ---------------------------------------------------------------------------
update public.members
set journey_status = case
  when lower(trim(status_in_church)) = 'regular' then 'RM'
  when lower(trim(status_in_church)) = 'active'  then 'AM'
end
where journey_status is null
  and lower(trim(coalesce(status_in_church,''))) in ('regular','active');

-- ---------------------------------------------------------------------------
-- 4) djourney -> current_journey_stage_id
--    Live values: SQ1 (39), Red (7), For Confirmation (3), Candidate (3).
--    SQ1 = Square One -> stage GOOD_NEWS. Others unmapped (meaning unconfirmed).
-- ---------------------------------------------------------------------------
update public.members m
set current_journey_stage_id = s.id
from public.journey_stages s
where m.current_journey_stage_id is null
  and s.code = 'GOOD_NEWS'
  and lower(trim(m.djourney)) in ('sq1', 'square one');

-- ---------------------------------------------------------------------------
-- 5) heartlink -> heartlinks + member_heartlinks
--    Live values mix leader names (Ruth, Mary Anne, Loui, Josephine A),
--    Yes/No flags, dates (09.17.17), and 'Red'. Only leader-name values become
--    groups; flags/dates skipped (create no junk groups).
-- ---------------------------------------------------------------------------
with named as (
  select distinct initcap(trim(heartlink)) as hl_name
  from public.members
  where heartlink is not null
    and trim(heartlink) <> ''
    and lower(trim(heartlink)) not in ('yes','no','red','n/a','none','-')
    and trim(heartlink) !~ '^[0-9.\\/ -]+$'   -- skip pure dates/numbers
)
insert into public.heartlinks (name, import_source)
select hl_name, 'legacy_sync' from named
on conflict (lower(name)) do nothing;

insert into public.member_heartlinks (member_id, heartlink_id, is_primary, import_source)
select m.id, hl.id, true, 'legacy_sync'
from public.members m
join public.heartlinks hl on lower(hl.name) = lower(trim(m.heartlink))
where m.heartlink is not null
  and not exists (select 1 from public.member_heartlinks x
                  where x.member_id = m.id and x.left_on is null)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 6) ministry names -> member_ministries (priority 1)
--    Ministry names appear in BOTH ministry_involvement AND status_in_church.
--    Explicit alias map from live values. Years/dates skipped.
--    Unmapped (not in ministry list): Radio, Big Boys, Wave, Missions, Elder,
--    PCM, Link, Arts, E-woman, Working Class, Deacon, Counter, DR, ADMIN, Seasonal.
-- ---------------------------------------------------------------------------
with alias_map(legacy, ministry_code) as (values
  ('prism',        'PRISM'),
  ('zoom',         'ZOOM'),
  ('move',         'MOVE'),
  ('move/admin',   'MOVE'),
  ('gk',           'GATE_KEEPERS'),
  ('gate keepers', 'GATE_KEEPERS'),
  ('fl',           'FRONT_LINER'),        -- ASSUMPTION: FL = Front Liner
  ('front liner',  'FRONT_LINER'),
  ('ds',           'DAVIDIC_SYMPHONIA'),  -- ASSUMPTION: DS = Davidic Symphonia
  ('davidic symphonia','DAVIDIC_SYMPHONIA'),
  ('cem',          'CCEM'),               -- ASSUMPTION: CEM = CCEM
  ('ccem',         'CCEM'),
  ('creative',     'CREATIVES'),
  ('creatives',    'CREATIVES'),
  ('d8:18',        'D818'),
  ('d8: 18',       'D818'),
  ('kingdom kids', 'KINGDOM_KIDS'),
  ('kingdom kidz', 'KINGDOM_KIDS'),
  ('best',         'BEST'),
  ('leadtakers youth', 'LEADTAKERS_YOUTH'),
  ('leadtakers pro',   'LEADTAKERS_PRO'),
  ('illuminate',   'ILLUMINATE'),
  ('sentinel',     'SENTINEL')
),
sources as (
  select id as member_id, lower(trim(ministry_involvement)) as legacy
  from public.members where ministry_involvement is not null
  union
  select id, lower(trim(status_in_church))
  from public.members where status_in_church is not null
)
insert into public.member_ministries (member_id, ministry_id, priority, import_source)
select distinct on (src.member_id) src.member_id, mi.id, 1, 'legacy_sync'
from sources src
join alias_map am on src.legacy = am.legacy
join public.ministries mi on mi.code = am.ministry_code
where not exists (select 1 from public.member_ministries x
                  where x.member_id = src.member_id and x.is_active)
on conflict (member_id, ministry_id) do nothing;

-- ---------------------------------------------------------------------------
-- 7) legacy completion flags -> member_requirement_completions
-- ---------------------------------------------------------------------------
insert into public.member_requirement_completions
  (member_id, requirement_id, completed_on, evidence_type, import_source)
select m.id, r.id, m.water_baptism, 'import', 'legacy_sync'
from public.members m
join public.journey_requirements r on r.code = 'WATER_BAPTISM'
where m.water_baptism is not null
on conflict (member_id, requirement_id) do nothing;

insert into public.member_requirement_completions
  (member_id, requirement_id, evidence_type, evidence_ref, import_source)
select m.id, r.id, 'import', m.transformation_weekend, 'legacy_sync'
from public.members m
join public.journey_requirements r on r.code = 'TRANSFORMATION_WEEKEND'
where m.transformation_weekend is not null
  and trim(m.transformation_weekend) <> ''
  and m.transformation_weekend not ilike 'no%'
  and m.transformation_weekend not ilike 'n/a%'
  and trim(m.transformation_weekend) not in ('-')
on conflict (member_id, requirement_id) do nothing;

insert into public.member_requirement_completions
  (member_id, requirement_id, evidence_type, evidence_ref, import_source)
select m.id, r.id, 'import', m.membership_orientation, 'legacy_sync'
from public.members m
join public.journey_requirements r on r.code = 'MEMBERSHIP_ORIENTATION'
where m.membership_orientation is not null
  and trim(m.membership_orientation) <> ''
  and m.membership_orientation not ilike 'no%'
  and m.membership_orientation not ilike 'n/a%'
  and trim(m.membership_orientation) not in ('-')
on conflict (member_id, requirement_id) do nothing;

-- ---------------------------------------------------------------------------
-- 8) seed member_journey_progress row for current stage
-- ---------------------------------------------------------------------------
insert into public.member_journey_progress (member_id, stage_id, status, import_source)
select m.id, m.current_journey_stage_id, 'in_progress', 'legacy_sync'
from public.members m
where m.current_journey_stage_id is not null
on conflict (member_id, stage_id) do nothing;

-- ---------------------------------------------------------------------------
-- 9) link offerings to members by email
-- ---------------------------------------------------------------------------
update public.offerings o
set member_id = m.id
from public.members m
where o.member_id is null
  and o.email is not null and m.email is not null
  and lower(o.email) = lower(m.email);

-- ---------------------------------------------------------------------------
-- 10) link auth users to members by email
-- ---------------------------------------------------------------------------
update public.members m
set auth_user_id = u.id
from auth.users u
where m.auth_user_id is null
  and m.email is not null
  and lower(u.email) = lower(m.email);
