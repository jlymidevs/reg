# PCM/Admin Restoration Design

## Objective

Restore PCM and Admin portal modules from the legacy D-Journey applications as production-ready Next.js routes backed by live Supabase data. The portal must use canonical `/dashboard/*` URLs, enforce role-scoped access, preserve existing PCM UI, and record all administrative changes.

## Scope

Included modules:

- CRM overview, Daily Pulse, pipeline, D-Journey, tasks, members, and attendance.
- Heartlink reports, meeting report encoding, announcements, and communications.
- Staff and roles, team turnover, KRA, promotions, settings, audit trail, and member-link approvals.
- Network, ministry, PCM, Admin, and Member role dashboards.
- Excel import staging, validation, duplicate resolution, approval, and apply workflow.

Excluded modules:

- CCEM/ISU tracking and unrelated events, booking, website, or giving applications.

## URL Contract

Canonical routes use `/dashboard/*`:

| Canonical route | Data source | Existing compatibility route |
| --- | --- | --- |
| `/dashboard` | `member_dashboard_view`, `inactive_watchlist_view`, `approval_requests`, `pcm_weekly_kpi_view` | `/` |
| `/dashboard/pulse` | `inactive_watchlist_view`, `follow_up_tasks`, `attendance_logs`, `follow_up_logs` | `/watchlist` |
| `/dashboard/pipeline` | `member_dashboard_view`, `approval_requests` | `/pipeline` |
| `/dashboard/journey` | `journey_stages`, `member_journey_progress`, `journey_requirements`, `member_requirement_completions` | `/dashboard/djourney` |
| `/dashboard/tasks` | `follow_up_tasks`, `follow_up_logs` | `/followups` |
| `/dashboard/meetings` | `heartlink_reports`, `heartlink_report_attendees`, `heartlinks`, `members` | `/reports/weekly` |
| `/dashboard/members` | `members`, profile tables, memberships, activity views | `/members` |
| `/dashboard/announcements` | `announcements` | unchanged |
| `/dashboard/staff` | `auth.users` server-side, `user_roles`, `pcm_staff` | unchanged |
| `/dashboard/turnover` | `members`, `pcm_staff`, `member_transfers` | unchanged |
| `/dashboard/kra` | `pcm_weekly_kpi_view`, `follow_up_logs`, journey history | unchanged |

Additional restored routes:

- `/dashboard/communications`
- `/dashboard/analytics`
- `/dashboard/integration`
- `/dashboard/promotions`
- `/dashboard/settings`
- `/dashboard/audit`
- `/dashboard/member-links`
- `/dashboard/attendance`
- `/dashboard/network`
- `/dashboard/ministry`
- `/dashboard/member`

The existing short routes redirect to their canonical dashboard equivalent. Navigation uses canonical URLs only.

## Data Model

Existing live data is the source of truth. Pages query existing members, member activity, attendance, follow-ups, approvals, staff, networks, ministries, HeartLinks, announcements, imports, audit logs, member links, and reports views.

New tables:

### `heartlink_reports`

Stores a weekly report for a HeartLink group. Fields include HeartLink ID, category, topic, venue, meeting date, start/end times, area pastor, coordinator, attendance totals, testimony/recommendation notes, submitter, publish status, created/updated timestamps, and organization ID.

### `heartlink_report_attendees`

Stores report attendees as regular, first-time, or child attendees. Rows may link to an existing member and retain a submitted display name for guests.

### `dashboard_preferences`

Stores per-user saved filters and display preferences. It contains only user-owned UI state and never controls authorization.

New tables enable RLS. `heartlink_reports` and attendees use role-scoped policies. `dashboard_preferences` is restricted to its owning user. New views use `security_invoker = true`.

## Permissions

| Role | Data scope | Write scope |
| --- | --- | --- |
| Super Admin/Admin | Church-wide | All included modules |
| PCM | Assigned members and own activity | Tasks, follow-ups, pipeline requests |
| Network Head | Assigned network, ministries, members, HeartLinks | Network-scoped reports and care actions |
| Ministry Head | Assigned ministry and members | Ministry-scoped care actions |
| Member | Own record and assigned content | Own profile/preferences only |

Server Actions and route handlers repeat authorization checks; UI visibility is not treated as authorization. Admin-only Auth API calls use the server-only service-role client and do not expose private data to clients.

## Operational Behavior

- Status, journey, role, turnover, announcement, promotion, import, member-link, report, and settings changes create audit events.
- Pipeline and journey changes retain approval workflow where existing policy requires approval.
- Meeting reports validate required meeting fields and attendee types before saving.
- All lists expose search, filters, pagination, explicit empty states, and error feedback.
- No mock values or placeholder action buttons remain in restored modules.
- Import workflow is non-destructive: stage workbook, validate rows, display errors/duplicates, approve selected rows, apply changes, then record result/audit rows.

## UI

The portal retains the current PCM visual system: teal and white palette, serif headings, left navigation, responsive cards/tables, and accessible controls. Every form control has a visible or screen-reader label. All interactive controls support keyboard operation.

## Delivery

Implementation proceeds by module group while preserving a single production release:

1. Canonical route redirects, shared permissions, audit helper, and required database migrations.
2. Core CRM and attendance.
3. Heartlink reports, communications, and announcements.
4. Admin operations and role-specific dashboards.
5. Import staging and apply workflow.
6. Security, role, build, and production smoke verification.

## Acceptance Criteria

- All listed canonical routes render live scoped data for authorized roles.
- Existing short routes redirect without broken links.
- Every write is authorized, validated, persisted, and audited.
- Importing cannot overwrite members until an authorized approval step completes.
- Role tests cover Super Admin, PCM, Network Head, Ministry Head, and Member visibility.
- Database migrations, RLS policies, typecheck, tests, production build, and route smoke checks pass before deployment.
