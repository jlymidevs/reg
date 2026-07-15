# PCM Live QA Checklist

Run this once with a real Google account that already has PCM access.

## Login and Routing

1. Open `pcm.jlycc.org/login`.
2. Sign in with Google.
3. Confirm redirect lands on dashboard, not back on login.
4. Open `/members`, `/watchlist`, `/journey-approvals`, `/followups`, `/reports/weekly`.

## Dashboard

1. Confirm dashboard cards show real counts.
2. Open one member from dashboard list.
3. Open one member from watchlist.

## Member Detail

1. Confirm profile summary loads.
2. Confirm approval history loads.
3. Confirm field history loads.
4. Save one follow-up using method `call` and a short note.
5. Confirm success banner appears.
6. Refresh page and confirm new follow-up appears in history.

## Approval Queue

1. Open one pending approval request.
2. Approve it with a short note.
3. Confirm success banner appears.
4. Refresh queue and confirm request no longer shows as pending.
5. Open affected member and confirm history/status changed as expected.

## Access Control

1. Test with non-PCM account.
2. Confirm sign-in succeeds but user is redirected to `/forbidden`.

## Final Smoke

1. Sign out.
2. Confirm protected routes redirect back to login.
3. Re-run one admin/PCM login.
4. Confirm no obvious console/network failures in browser devtools.
