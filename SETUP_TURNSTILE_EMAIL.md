# Turnstile + Confirmation Email — Setup

New registration flow: browser → `register` Edge Function (verifies Turnstile,
sends email) → `register_for_event` RPC. Direct anon access to the RPC is
revoked by `supabase_registration_v2.sql`.

Everything degrades gracefully: with no keys configured, registration still
works — Turnstile is skipped and no email is sent.

## 1. Database

Run `supabase_registration_v2.sql` in the Supabase SQL editor
(project `gadjquxavyxsftnwurfo`).

## 2. Deploy the Edge Function

```bash
npm i -g supabase        # if not installed
supabase login
supabase link --project-ref gadjquxavyxsftnwurfo
supabase functions deploy register --no-verify-jwt
```

> IMPORTANT: deploy the function BEFORE running the SQL in production, or
> registrations will fail during the gap (SQL revokes direct RPC access).

## 3. Cloudflare Turnstile (bot protection)

1. Cloudflare dashboard → Turnstile → Add widget
2. Domain: your production domain (+ `localhost` for dev)
3. Mode: **Managed** (invisible for most users)
4. Copy keys:
   - **Site key** → `.env` → `VITE_TURNSTILE_SITE_KEY=...` (also add to Vercel env vars)
   - **Secret key** → `supabase secrets set TURNSTILE_SECRET_KEY=...`

## 4. Resend (confirmation email)

1. Create a Resend account for JLYCC (do NOT reuse other-org keys)
2. Verify a sending domain (e.g. `jlycc.org`) — add the DNS records Resend shows
3. Set secrets:

```bash
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set EMAIL_FROM="JLYCC Events <events@jlycc.org>"
```

## 5. Verify

- Register with email → confirmation email arrives, success screen says so
- Register without email → works, no email
- With Turnstile keys set: submit button disabled until challenge passes

| Secret (Supabase) | Purpose |
|---|---|
| `TURNSTILE_SECRET_KEY` | Server-side bot check (unset = skip) |
| `RESEND_API_KEY` | Email sending (unset = skip) |
| `EMAIL_FROM` | From address, must match verified domain |

| Env var (Vercel/.env) | Purpose |
|---|---|
| `VITE_TURNSTILE_SITE_KEY` | Renders widget (unset = hidden) |
