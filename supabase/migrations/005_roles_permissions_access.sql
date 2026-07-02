-- 005_roles_permissions_access.sql
-- Clean role system alongside existing admin_users / user_profiles / user_app_access (kept as-is).
-- user_roles rows can be scoped: network_head scoped by network_id, ministry_head by ministry_id.

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,   -- member, network_head, ministry_head, pcm_staff, admin, super_admin
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_id     uuid not null references public.roles(id) on delete cascade,
  network_id  uuid references public.networks(id) on delete cascade,   -- scope for network_head
  ministry_id uuid references public.ministries(id) on delete cascade, -- scope for ministry_head
  granted_by  uuid references auth.users(id),
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  is_active   boolean not null default true
);
create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role_id);
-- avoid duplicate identical grants (scoped uniqueness with null-safe coalesce)
create unique index if not exists user_roles_unique_grant_key
  on public.user_roles (
    user_id, role_id,
    coalesce(network_id,  '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(ministry_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- app registry (registration_portal etc.) — complements existing user_app_access
create table if not exists public.apps (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,  -- website, member_portal, pcm_portal, admin_portal, registration_portal
  name       text not null,
  base_url   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
