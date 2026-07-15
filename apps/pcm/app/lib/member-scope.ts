export type MemberScope = { memberId?: string; assignedPcmId?: string; networkId?: string; ministryId?: string };

export function resolveMemberScope(input: { role: string; userId: string; memberId?: string; networkId?: string; ministryId?: string }): MemberScope {
  if (input.role === "super_admin" || input.role === "admin") return {};
  if (input.role === "pcm_staff") return { assignedPcmId: input.userId };
  if (input.role === "network_head") return { networkId: input.networkId };
  if (input.role === "ministry_head") return { ministryId: input.ministryId };
  return input.memberId ? { memberId: input.memberId } : { memberId: "__no-member__" };
}
