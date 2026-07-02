-- 013_can_scan_rpc.sql
-- RPC used by the qr-checkin Edge Function to authorize scanners.

create or replace function public.can_scan()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.has_role('pcm_staff')
      or public.has_role('network_head')
      or public.has_role('ministry_head');
$$;

grant execute on function public.can_scan() to authenticated;
