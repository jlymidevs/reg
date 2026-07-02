-- 012_bridge_admin_users.sql
-- Bridge existing admin_users into new user_roles so current admins pass
-- the new RLS policies (is_admin()). Idempotent; run after seed.sql.
-- Only matches admins who have signed in at least once (row in auth.users).

insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.admin_users a
join auth.users u on lower(u.email) = lower(a.email)
join public.roles r on r.code = 'admin'
on conflict do nothing;

-- Promote specific emails to super_admin (edit list before running):
-- insert into public.user_roles (user_id, role_id)
-- select u.id, r.id from auth.users u, public.roles r
-- where lower(u.email) in ('owner@jlycc.org') and r.code = 'super_admin'
-- on conflict do nothing;
