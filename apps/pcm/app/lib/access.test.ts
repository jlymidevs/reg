import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from "vitest";
import { resolveMemberScope } from "./member-scope";

describe("resolveMemberScope", () => {
  it("limits PCM staff to their assignments", () => {
    expect(resolveMemberScope({ role: "pcm_staff", userId: "pcm-1" })).toEqual({ assignedPcmId: "pcm-1" });
  });

  it("gives administrators church-wide scope", () => {
    expect(resolveMemberScope({ role: "super_admin", userId: "admin-1" })).toEqual({});
  });

  it("keeps members on their own member record", () => {
    expect(resolveMemberScope({ role: "member", userId: "member-1", memberId: "m-1" })).toEqual({ memberId: "m-1" });
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
});
