import type { JourneyStatus, RoleCode, StageCode } from '@jlycc/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DashboardMemberRow {
  member_id: string;
  name: string;
  member_code: string | null;
  journey_status: JourneyStatus | null;
  email: string | null;
  current_stage_code: StageCode | null;
  current_stage_name: string | null;
  stage_completed_count: number;
  stage_required_count: number;
  last_activity_on: string | null;
  days_inactive: number | null;
  primary_heartlink: string | null;
  total_attendance: number;
  active_ministries: number;
}

export interface WatchlistRow {
  member_id: string;
  name: string;
  member_code: string | null;
  journey_status: JourneyStatus | null;
  assigned_pcm: string | null;
  last_attendance_at: string | null;
  last_followup_on: string | null;
  last_activity_on: string | null;
  days_inactive: number;
  watch_level: 'watch' | 'inactive';
}

export interface ApprovalRequestRow {
  id: string;
  request_type:
    | 'member_status_change'
    | 'journey_stage_completion'
    | 'journey_requirement_completion'
    | 'role_assignment'
    | 'ministry_assignment'
    | 'heartlink_assignment';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  decision_note: string | null;
  payload: Record<string, string | null> | null;
  members: {
    name: string | null;
    member_code: string | null;
    journey_status: JourneyStatus | null;
  } | null;
}

export interface ApprovalRequestQueryRow {
  id: string;
  request_type: ApprovalRequestRow['request_type'];
  status: ApprovalRequestRow['status'];
  created_at: string;
  decision_note: string | null;
  payload: Record<string, string | null> | null;
  members:
    | {
        name: string | null;
        member_code: string | null;
        journey_status: JourneyStatus | null;
      }[]
    | null;
}

export interface WeeklyKpiRow {
  pcm_staff_id: string;
  pcm_staff_name: string;
  week_start: string;
  week_end: string;
  followups_completed: number;
  members_assigned: number;
  ftv_to_ogv: number;
  ogv_to_rm: number;
  rm_to_am: number;
  attendance_this_week: number;
  inactive_recovered: number;
  heartlink_assignments: number;
  requirements_completed: number;
}

export interface DashboardSnapshot {
  membersCount: number;
  watchlistCount: number;
  pendingApprovalsCount: number;
  inactiveCount: number;
  members: DashboardMemberRow[];
  watchlist: WatchlistRow[];
  approvals: ApprovalRequestRow[];
  weeklyKpi: WeeklyKpiRow | null;
}

export class DashboardSnapshotLoadError extends Error {
  constructor() {
    super('Dashboard data could not be loaded.');
    this.name = 'DashboardSnapshotLoadError';
  }
}

function isAdminRole(roles: RoleCode[]) {
  return roles.includes('admin') || roles.includes('super_admin') || roles.includes('pcm_staff');
}

function maybeMine<T extends { pcm_staff_id: string }>(
  rows: T[],
  userEmail: string | undefined
) {
  if (!userEmail) return null;
  return rows.find(() => false) ?? null;
}

export function normalizeApprovalRequests(rows: ApprovalRequestQueryRow[]): ApprovalRequestRow[] {
  return rows.map((row) => ({
    ...row,
    members: row.members?.[0] ?? null,
  }));
}

export async function loadDashboardSnapshot(
  supabase: SupabaseClient,
  roles: RoleCode[],
  userEmail?: string
): Promise<DashboardSnapshot> {
  const canSeeAll = isAdminRole(roles);

  const [
    { data: members, error: membersError },
    { data: watchlist, error: watchlistError },
    { data: approvals, error: approvalsError },
    { data: weeklyRows, error: weeklyKpiError },
  ] =
    await Promise.all([
      supabase
        .from('member_dashboard_view')
        .select(
          'member_id,name,member_code,journey_status,email,current_stage_code,current_stage_name,stage_completed_count,stage_required_count,last_activity_on,days_inactive,primary_heartlink,total_attendance,active_ministries'
        )
        .order('name')
        .limit(8),
      supabase
        .from('inactive_watchlist_view')
        .select(
          'member_id,name,member_code,journey_status,assigned_pcm,last_attendance_at,last_followup_on,last_activity_on,days_inactive,watch_level'
        )
        .order('days_inactive', { ascending: false })
        .limit(8),
      supabase
        .from('approval_requests')
        .select('id,request_type,status,created_at,decision_note,payload,members(name,member_code,journey_status)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('pcm_weekly_kpi_view')
        .select(
          'pcm_staff_id,pcm_staff_name,week_start,week_end,followups_completed,members_assigned,ftv_to_ogv,ogv_to_rm,rm_to_am,attendance_this_week,inactive_recovered,heartlink_assignments,requirements_completed'
        )
        .order('week_start', { ascending: false }),
      ]);

  if (membersError ?? watchlistError ?? approvalsError ?? weeklyKpiError) {
    throw new DashboardSnapshotLoadError();
  }

  const kpiList = (weeklyRows ?? []) as WeeklyKpiRow[];
  const weeklyKpi =
    canSeeAll
      ? kpiList[0] ?? null
      : maybeMine(
          kpiList,
          userEmail
        );

  const typedMembers = (members ?? []) as DashboardMemberRow[];
  const typedWatchlist = (watchlist ?? []) as WatchlistRow[];
  const typedApprovals = normalizeApprovalRequests((approvals ?? []) as ApprovalRequestQueryRow[]);

  return {
    membersCount: typedMembers.length,
    watchlistCount: typedWatchlist.length,
    pendingApprovalsCount: typedApprovals.length,
    inactiveCount: typedWatchlist.filter((row) => row.watch_level === 'inactive').length,
    members: typedMembers,
    watchlist: typedWatchlist,
    approvals: typedApprovals,
    weeklyKpi,
  };
}
