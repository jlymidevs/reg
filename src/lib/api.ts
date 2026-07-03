import { supabase } from './supabase';
import type { Database } from './database.types';

export type Event = Database['public']['Tables']['events']['Row'];
export type Member = Database['public']['Tables']['members']['Row'];
export type Registration = Database['public']['Tables']['event_registrations']['Row'];
export type AdminUser = Database['public']['Tables']['admin_users']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
export type MemberActivity = Database['public']['Views']['member_activity_summary_view']['Row'];
export type MemberMeta = Database['public']['Tables']['event_reg_member_meta']['Row'];

export const ADMIN_ROLES = ['super_admin', 'admin', 'event_manager', 'checkin_staff', 'finance', 'viewer', 'volunteer'] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

export type RegistrationWithRelations = Registration & {
  members: Pick<Member, 'first_name' | 'surname' | 'phone' | 'address'> | null;
  events: Pick<Event, 'title'> | null;
};

// --- PUBLIC API ---

export async function getActiveEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .eq('is_published', true)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return data;
}

export interface RegistrationInput {
  event_id: string;
  first_name: string;
  surname: string;
  phone: string;
  address?: string;
  email?: string;
  notes?: string;
  turnstile_token?: string;
}

export async function registerForEvent(input: RegistrationInput): Promise<{ emailSent: boolean }> {
  // Registration goes through the `register` Edge Function, which verifies
  // Cloudflare Turnstile server-side, then calls the security-definer RPC
  // (capacity / past-event / duplicate checks), then sends the confirmation
  // email. Direct anon access to the RPC is revoked.
  const { data, error } = await supabase.functions.invoke('register', {
    body: input,
  });

  if (error) {
    // Edge Function returns {error: message} with 4xx for validation failures
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      const body = await ctx.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    throw error;
  }
  return { emailSent: Boolean(data?.emailSent) };
}

// --- ADMIN API (requires authenticated admin session) ---

export async function getAllEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createEvent(event: Database['public']['Tables']['events']['Insert']) {
  const { error } = await supabase.from('events').insert(event);
  if (error) throw error;
  return true;
}

export async function updateEvent(id: string, updates: Database['public']['Tables']['events']['Update']) {
  const { error } = await supabase.from('events').update(updates).eq('id', id);
  if (error) throw error;
  return true;
}

export async function getAllRegistrations(): Promise<RegistrationWithRelations[]> {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('*, members(first_name, surname, phone, address), events(title)')
    .order('registered_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as RegistrationWithRelations[];
}

export async function updateRegistrationStatus(id: string, status: 'registered' | 'cancelled' | 'attended') {
  const { error } = await supabase
    .from('event_registrations')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
  return true;
}

// --- USERS & ROLES (super_admin only, enforced by RLS on admin_users) ---

export async function getAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addAdminUser(email: string, role: AdminRole) {
  const { error } = await supabase.from('admin_users').insert({ email: email.trim().toLowerCase(), role });
  if (error) throw error;
  return true;
}

export async function updateAdminUserRole(id: string, role: AdminRole) {
  const { error } = await supabase.from('admin_users').update({ role }).eq('id', id);
  if (error) throw error;
  return true;
}

export async function removeAdminUser(id: string) {
  const { error } = await supabase.from('admin_users').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function getCurrentAdminRole(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_admin_role');
  if (error) throw error;
  return data;
}

// --- AUDIT LOG (read-only; writes happen via DB triggers) ---

export async function getAuditLogs(limit = 200): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// --- MEMBER CLASSIFICATION & ACTIVITY ---
// Classification lives in event_reg_member_meta, isolated from the shared
// members CRM table — see supabase_phase1_foundation.sql for why.

export async function getMemberMetaMap(): Promise<Record<string, MemberMeta>> {
  const { data, error } = await supabase.from('event_reg_member_meta').select('*');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((m) => [m.member_id, m]));
}

export async function updateMemberClassification(memberId: string, updates: {
  member_type?: string;
  tags?: string[];
  ministry_group?: string | null;
  age_bracket?: string | null;
  communication_consent?: boolean;
  unsubscribed?: boolean;
  is_active?: boolean;
}) {
  const { error } = await supabase
    .from('event_reg_member_meta')
    .upsert({ member_id: memberId, ...updates }, { onConflict: 'member_id' });
  if (error) throw error;
  return true;
}

export async function getMemberActivitySummary(): Promise<MemberActivity[]> {
  const { data, error } = await supabase
    .from('member_activity_summary_view')
    .select('*')
    .order('activity_score', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
