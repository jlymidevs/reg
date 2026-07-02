# jlycc-platform

Turborepo monorepo for Jesus Loves You Ministries / JLYCC — D-Journey platform.

## Layout

| Path | Purpose | Domain |
|---|---|---|
| `apps/registration` | Event registration + QR check-in | registration.jlycc.org |
| `apps/web` (todo) | Public website / CMS | jlycc.org |
| `apps/app` (todo) | Member portal | app.jlycc.org |
| `apps/pcm` (todo) | Pastoral Care Ministry portal | pcm.jlycc.org |
| `apps/admin` (todo) | Admin console | admin.jlycc.org |
| `packages/supabase` | Browser/server/middleware Supabase clients (`.jlycc.org` shared cookie) |
| `packages/permissions` | Role helpers (mirrors SQL RLS helpers) |
| `packages/types` | Domain types (swap for `supabase gen types` later) |
| `supabase/migrations` | 001–013 idempotent migrations (all applied to prod 2026-07-02) |
| `supabase/functions/qr-checkin` | Edge Function: QR attendance check-in |

## Dev

```bash
pnpm install
cd apps/registration && pnpm dev   # http://localhost:3005
```

Each app needs `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://gadjquxavyxsftnwurfo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

## Deploy Edge Function

```bash
npx supabase login          # needs personal access token
npx supabase functions deploy qr-checkin --project-ref gadjquxavyxsftnwurfo
```

## Vercel

One Vercel project per app; root directory `apps/<name>`; assign subdomain. Push to `main` auto-deploys.

## Auth notes

- Google OAuth via Supabase Auth. Add each app's `https://<subdomain>.jlycc.org/auth/callback` to Supabase Auth → URL Configuration → Redirect URLs (plus `http://localhost:3005/auth/callback` for dev).
- Scanner access requires a `user_roles` row (`pcm_staff` / `network_head` / `ministry_head` / `admin` / `super_admin`) — enforced by `public.can_scan()` in the Edge Function and RLS.
