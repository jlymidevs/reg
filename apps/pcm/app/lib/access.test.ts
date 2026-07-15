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
