import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveMemberScope } from './member-scope';

const migrationsDirectory = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));

function readMigration(suffix: string) {
  const filename = readdirSync(migrationsDirectory).find((name) => name.endsWith(`_${suffix}.sql`));
  if (!filename) throw new Error(`Missing migration ending in _${suffix}.sql`);
  return readFileSync(`${migrationsDirectory}${filename}`, 'utf8');
}

function functionBody(sql: string, functionName: string) {
  const match = sql.match(
    new RegExp(`create or replace function public\\.${functionName}\\([\\s\\S]*?as \\\$\\$([\\s\\S]*?)\\$\\$;`, 'i')
  );
  if (!match) throw new Error(`Missing ${functionName} function body`);
  return match[1];
}

describe('resolveMemberScope', () => {
  it('limits PCM staff to their assignments', () => {
    expect(resolveMemberScope({ role: 'pcm_staff', userId: 'pcm-1' })).toEqual({ assignedPcmId: 'pcm-1' });
  });

  it('gives administrators church-wide scope', () => {
    expect(resolveMemberScope({ role: 'super_admin', userId: 'admin-1' })).toEqual({});
  });

  it('keeps members on their own member record', () => {
    expect(resolveMemberScope({ role: 'member', userId: 'member-1', memberId: 'm-1' })).toEqual({ memberId: 'm-1' });
  });
});

describe('PCM member access migration', () => {
  it('delegates PCM access to is_pcm_for_member without blocking other scopes', () => {
    const migration = readFileSync(
      fileURLToPath(new URL('../../../../supabase/migrations/20260715161453_pcm_role_scoped_member_access.sql', import.meta.url)),
      'utf8'
    );

    expect(migration).not.toContain('assigned_pcm_staff_id');
    expect(migration).toMatch(/if public\.is_pcm_for_member\(target_member_id\) then/);
    expect(migration.indexOf('public.is_network_head_for_member')).toBeGreaterThan(
      migration.indexOf('public.is_pcm_for_member')
    );
  });

  it('denies an email-matched PCM assignment without an active pcm_staff role', () => {
    const migration = readMigration('pcm_audit_log_and_scoped_rls');
    const helper = functionBody(migration, 'is_pcm_for_member');

    expect(helper).toMatch(/public\.has_role\('pcm_staff'\)\s+and\s+exists/i);
    expect(helper).toMatch(/s\.status\s*=\s*'active'/i);
    expect(helper).toMatch(/lower\(s\.email\)\s*=\s*public\.auth_email\(\)/i);
  });

  it('scopes approval, member-scoped, and follow-up policies to can_access_member', () => {
    const migration = readMigration('pcm_audit_log_and_scoped_rls');

    expect(migration).toMatch(/approval_requests_select[\s\S]*?using\s*\(public\.is_admin\(\) or public\.can_access_member\(member_id\)\)/i);
    expect(migration).toMatch(/approval_requests_insert[\s\S]*?with check\s*\(public\.is_admin\(\) or public\.can_access_member\(member_id\)\)/i);
    expect(migration).toMatch(/approval_requests_update[\s\S]*?using\s*\(public\.is_admin\(\) or public\.can_access_member\(member_id\)\)[\s\S]*?with check\s*\(public\.is_admin\(\) or public\.can_access_member\(member_id\)\)/i);
    expect(migration).toMatch(/member_ministries[\s\S]*?follow_up_logs/i);
    expect(migration).toMatch(/using \(public\.can_access_member\(member_id\)\)[\s\S]*?with check \(public\.can_access_member\(member_id\)\)/i);
  });

  it('creates admin audit logs with admin-only reads and no browser writes', () => {
    const migration = readMigration('pcm_audit_log_and_scoped_rls');

    expect(migration).toMatch(/create table if not exists public\.admin_audit_logs/i);
    expect(migration).toMatch(/created_at\s+timestamptz\s+not null default now\(\)/i);
    expect(migration).toMatch(/alter table public\.admin_audit_logs enable row level security/i);
    expect(migration).toMatch(/revoke all on table public\.admin_audit_logs from public, anon, authenticated/i);
    expect(migration).toMatch(/create policy admin_audit_logs_admin_read[\s\S]*?public\.is_admin\(\)/i);
  });
});

describe('PCM atomic care migration', () => {
  it('uses authenticated, role-gated, non-leaking RPCs', () => {
    const migration = readMigration('pcm_atomic_care_actions');

    for (const functionName of ['pcm_log_followup', 'pcm_request_status_change', 'pcm_decide_approval']) {
      const body = functionBody(migration, functionName);
      expect(body).toMatch(/v_actor_id uuid := auth\.uid\(\);[\s\S]*?if v_actor_id is null/i);
      expect(body).toMatch(/public\.can_access_member\(/i);
      expect(body).toMatch(/insert into public\.admin_audit_logs/i);
      expect(body).not.toMatch(/exception\s+when/i);
    }

    expect(migration).toMatch(/security definer\s+set search_path = ''/i);
    expect(migration).toMatch(/revoke all on function public\.pcm_decide_approval\(uuid, text, text\) from public, anon/i);
    expect(migration).toMatch(/grant execute on function public\.pcm_decide_approval\(uuid, text, text\) to authenticated/i);
  });

  it('orders approved side effects, decision, and audit so any failure rolls back', () => {
    const migration = readMigration('pcm_atomic_care_actions');
    const decision = functionBody(migration, 'pcm_decide_approval');

    expect(decision).toMatch(/raise exception 'approval side effect failed'/i);
    expect(decision.indexOf('update public.approval_requests')).toBeGreaterThan(
      decision.indexOf("if p_decision = 'approved' then")
    );
    expect(decision.indexOf('insert into public.admin_audit_logs')).toBeGreaterThan(
      decision.indexOf('update public.approval_requests')
    );
  });
});

describe('PCM RPC-only care write migration', () => {
  it('removes direct care mutations and scopes staff member updates', () => {
    const migration = readMigration('pcm_rpc_only_care_writes');

    for (const policy of [
      'approval_requests_insert',
      'approval_requests_update',
      'member_journey_progress_insert',
      'member_journey_progress_update',
      'member_requirement_completions_insert',
      'member_requirement_completions_update',
      'follow_up_logs_insert',
      'follow_up_logs_update',
    ]) {
      expect(migration).toMatch(new RegExp(`drop policy if exists ${policy} on public\\.`, 'i'));
    }

    expect(migration).toMatch(/revoke insert, update on table public\.approval_requests from public, anon, authenticated/i);
    expect(migration).toMatch(/revoke insert, update on table public\.member_journey_progress from public, anon, authenticated/i);
    expect(migration).toMatch(/revoke insert, update on table public\.member_requirement_completions from public, anon, authenticated/i);
    expect(migration).toMatch(/revoke insert, update on table public\.follow_up_logs from public, anon, authenticated/i);
    expect(migration).toMatch(/drop policy if exists members_staff_write on public\.members/i);
    expect(migration).toMatch(/create policy members_scoped_staff_update[\s\S]*?public\.has_role\('pcm_staff'\)[\s\S]*?public\.has_role\('network_head'\)[\s\S]*?public\.has_role\('ministry_head'\)[\s\S]*?public\.can_access_member\(id\)[\s\S]*?with check/i);
    expect(migration).toMatch(/create policy members_admin_update[\s\S]*?public\.is_admin\(\)[\s\S]*?with check \(public\.is_admin\(\)\)/i);
  });

  it('keeps pgTAP fixtures self-contained without disabling integrity checks', () => {
    const test = readFileSync(
      fileURLToPath(new URL('../../../../supabase/tests/database/pcm_care_write_hardening.test.sql', import.meta.url)),
      'utf8'
    );

    expect(test).toMatch(/select plan\(30\);/i);
    expect(test).toMatch(/insert into auth\.users/i);
    expect(test).not.toMatch(/session_replication_role/i);
  });
});
