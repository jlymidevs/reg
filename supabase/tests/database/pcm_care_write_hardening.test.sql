begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(17);

-- This transaction-local Auth user satisfies the real audit and role foreign keys.
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000111'::uuid,
  'authenticated',
  'authenticated',
  'pgtap-pcm@example.test',
  'not-used-by-pgtap',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  '',
  '',
  '',
  '',
  now(),
  now()
);

insert into public.roles (code, name)
values ('admin', 'Administrator')
on conflict (code) do nothing;

insert into public.user_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000000111'::uuid, id
from public.roles
where code = 'admin';

insert into public.pcm_staff (id, name, email, status)
values (
  '00000000-0000-0000-0000-000000000112'::uuid,
  'pgTAP PCM Staff',
  'pgtap-pcm@example.test',
  'active'
);

insert into public.members (id, email, assigned_pcm, journey_status)
values (
  '00000000-0000-0000-0000-000000000113'::uuid,
  'pgtap-member@example.test',
  '00000000-0000-0000-0000-000000000112'::uuid,
  'FTV'
);

insert into public.journey_stages (id, code, name, sort_order)
values (
  '00000000-0000-0000-0000-000000000114'::uuid,
  'PGTAP_CARE_WRITE_STAGE',
  'pgTAP Care Write Stage',
  9999
);

insert into public.journey_requirements (id, stage_id, code, name, sort_order)
values (
  '00000000-0000-0000-0000-000000000115'::uuid,
  '00000000-0000-0000-0000-000000000114'::uuid,
  'PGTAP_CARE_WRITE_REQUIREMENT',
  'pgTAP Care Write Requirement',
  9999
);

insert into public.approval_requests (id, request_type, member_id, requested_by, payload)
values
  (
    '00000000-0000-0000-0000-000000000116'::uuid,
    'member_status_change',
    '00000000-0000-0000-0000-000000000113'::uuid,
    '00000000-0000-0000-0000-000000000111'::uuid,
    '{"from":"FTV","to":"OGV"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000117'::uuid,
    'member_status_change',
    '00000000-0000-0000-0000-000000000113'::uuid,
    '00000000-0000-0000-0000-000000000111'::uuid,
    '{"from":"FTV","to":"INVALID"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000118'::uuid,
    'member_status_change',
    '00000000-0000-0000-0000-000000000113'::uuid,
    '00000000-0000-0000-0000-000000000111'::uuid,
    '{"from":"FTV","to":"OGV"}'::jsonb
  );

insert into public.member_journey_progress (member_id, stage_id, status)
values (
  '00000000-0000-0000-0000-000000000113'::uuid,
  '00000000-0000-0000-0000-000000000114'::uuid,
  'in_progress'
);

insert into public.member_requirement_completions (member_id, requirement_id, evidence_type)
values (
  '00000000-0000-0000-0000-000000000113'::uuid,
  '00000000-0000-0000-0000-000000000115'::uuid,
  'manual'
);

insert into public.follow_up_logs (member_id, date, method, notes)
values (
  '00000000-0000-0000-0000-000000000113'::uuid,
  current_date,
  'call',
  'pgTAP fixture'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000111', true);
select set_config('request.jwt.claim.email', 'pgtap-pcm@example.test', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000111","email":"pgtap-pcm@example.test","role":"authenticated"}',
  true
);

select is(
  public.is_pcm_for_member('00000000-0000-0000-0000-000000000113'::uuid),
  false,
  'matching active PCM email without pcm_staff role is denied'
);

select throws_ok(
  $$insert into public.approval_requests (request_type, member_id, requested_by) values ('member_status_change', '00000000-0000-0000-0000-000000000113', '00000000-0000-0000-0000-000000000111')$$,
  '42501',
  'permission denied for table approval_requests',
  'direct approval request insert is denied'
);

select throws_ok(
  $$update public.approval_requests set status = 'rejected' where id = '00000000-0000-0000-0000-000000000116'$$,
  '42501',
  'permission denied for table approval_requests',
  'direct approval request update is denied'
);

select throws_ok(
  $$insert into public.member_journey_progress (member_id, stage_id, status) values ('00000000-0000-0000-0000-000000000113', '00000000-0000-0000-0000-000000000114', 'completed')$$,
  '42501',
  'permission denied for table member_journey_progress',
  'direct journey progress insert is denied'
);

select throws_ok(
  $$update public.member_journey_progress set status = 'completed' where member_id = '00000000-0000-0000-0000-000000000113'$$,
  '42501',
  'permission denied for table member_journey_progress',
  'direct journey progress update is denied'
);

select throws_ok(
  $$insert into public.member_requirement_completions (member_id, requirement_id, evidence_type) values ('00000000-0000-0000-0000-000000000113', '00000000-0000-0000-0000-000000000115', 'manual')$$,
  '42501',
  'permission denied for table member_requirement_completions',
  'direct requirement completion insert is denied'
);

select throws_ok(
  $$update public.member_requirement_completions set notes = 'bypass' where member_id = '00000000-0000-0000-0000-000000000113'$$,
  '42501',
  'permission denied for table member_requirement_completions',
  'direct requirement completion update is denied'
);

select throws_ok(
  $$insert into public.follow_up_logs (member_id, date, method) values ('00000000-0000-0000-0000-000000000113', current_date, 'call')$$,
  '42501',
  'permission denied for table follow_up_logs',
  'direct follow-up insert is denied'
);

select throws_ok(
  $$update public.follow_up_logs set notes = 'bypass' where member_id = '00000000-0000-0000-0000-000000000113'$$,
  '42501',
  'permission denied for table follow_up_logs',
  'direct follow-up update is denied'
);

select throws_ok(
  $$select public.pcm_log_followup('00000000-0000-0000-0000-000000000113', current_date, 'invalid', null)$$,
  '22023',
  'invalid follow-up input',
  'invalid RPC input is rejected'
);

reset role;
select is(
  (select count(*) from public.follow_up_logs where member_id = '00000000-0000-0000-0000-000000000113'::uuid),
  1::bigint,
  'invalid RPC input creates no follow-up'
);

set local role authenticated;
select throws_ok(
  $$select public.pcm_decide_approval('00000000-0000-0000-0000-000000000117', 'approved', null)$$,
  '22023',
  'approval side effect failed',
  'invalid approval side effect is rejected'
);

reset role;
select is(
  (select status from public.approval_requests where id = '00000000-0000-0000-0000-000000000117'::uuid),
  'pending',
  'failed side effect keeps approval pending'
);
select is(
  (select journey_status from public.members where id = '00000000-0000-0000-0000-000000000113'::uuid),
  'FTV',
  'failed side effect keeps member status unchanged'
);

alter table public.admin_audit_logs
  add constraint pcm_test_reject_approval_audit
  check (action <> 'approve_request') not valid;

set local role authenticated;
select throws_like(
  $$select public.pcm_decide_approval('00000000-0000-0000-0000-000000000118', 'approved', null)$$,
  '%pcm_test_reject_approval_audit%',
  'forced audit failure is raised'
);

reset role;
select is(
  (select status from public.approval_requests where id = '00000000-0000-0000-0000-000000000118'::uuid),
  'pending',
  'forced audit failure keeps approval pending'
);
select is(
  (select journey_status from public.members where id = '00000000-0000-0000-0000-000000000113'::uuid),
  'FTV',
  'forced audit failure rolls back member status'
);

select * from finish();
rollback;
