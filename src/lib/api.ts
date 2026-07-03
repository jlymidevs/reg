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
  members: Pick<Member, 'first_name' | 'surname' | 'phone' | 'address' | 'gender'> | null;
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
    .select('*, members(first_name, surname, phone, address, gender), events(title)')
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

// --- CHECK-IN (manual search; QR is a fast-follow) ---

export async function getRegistrationsForEvent(eventId: string): Promise<RegistrationWithRelations[]> {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('*, members(first_name, surname, phone, address, gender), events(title)')
    .eq('event_id', eventId)
    .order('registered_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as RegistrationWithRelations[];
}

export async function checkInRegistration(registrationId: string, method: 'manual' | 'qr' | 'walk_in' = 'manual', notes?: string) {
  const { data, error } = await supabase.rpc('admin_check_in', {
    p_registration_id: registrationId,
    p_method: method,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean; member_name: string; event_title: string; checked_in_at: string };
}

export async function undoCheckIn(registrationId: string) {
  const { error } = await supabase.rpc('admin_undo_check_in', { p_registration_id: registrationId });
  if (error) throw error;
  return true;
}

// --- FEEDBACK ENGINE (balanced 20-person sample, preview/confirm-before-send) ---

export type FeedbackBatch = Database['public']['Tables']['feedback_email_batches']['Row'];
export type FeedbackRecipient = Database['public']['Tables']['feedback_email_recipients']['Row'];
export type FeedbackResponse = Database['public']['Tables']['feedback_responses']['Row'];

export interface FeedbackBatchPreview {
  batch_id: string;
  eligible_count: number;
  selected_count: number;
  warning: string | null;
}

export async function generateFeedbackBatch(eventId: string): Promise<FeedbackBatchPreview> {
  const { data, error } = await supabase.rpc('generate_feedback_batch', { p_event_id: eventId });
  if (error) throw error;
  return data as unknown as FeedbackBatchPreview;
}

export async function getFeedbackBatchRecipients(batchId: string): Promise<(FeedbackRecipient & { members: Pick<Member, 'first_name' | 'surname'> | null })[]> {
  const { data, error } = await supabase
    .from('feedback_email_recipients')
    .select('*, members(first_name, surname)')
    .eq('batch_id', batchId);
  if (error) throw error;
  return (data ?? []) as any;
}

export async function getLatestFeedbackBatch(eventId: string): Promise<FeedbackBatch | null> {
  const { data, error } = await supabase
    .from('feedback_email_batches')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function sendFeedbackBatch(batchId: string): Promise<{ sent: number; failed: number }> {
  const { data, error } = await supabase.functions.invoke('send-feedback-batch', {
    body: { batch_id: batchId },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      const body = await ctx.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    throw error;
  }
  return { sent: data?.sent ?? 0, failed: data?.failed ?? 0 };
}

export async function getFeedbackResponses(eventId: string): Promise<FeedbackResponse[]> {
  const { data, error } = await supabase
    .from('feedback_responses')
    .select('*')
    .eq('event_id', eventId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// --- PUBLIC FEEDBACK FORM (token-based, no auth) ---

export async function getFeedbackContext(token: string): Promise<{ event_title: string; already_responded: boolean }> {
  const { data, error } = await supabase.rpc('get_feedback_context', { p_token: token });
  if (error) throw error;
  return data as { event_title: string; already_responded: boolean };
}

export interface FeedbackSubmission {
  token: string;
  overall_rating: number;
  answers: Record<string, string | number>;
  is_anonymous: boolean;
  follow_up_requested: boolean;
}

export async function submitFeedback(input: FeedbackSubmission) {
  const { error } = await supabase.rpc('submit_feedback_response', {
    p_token: input.token,
    p_overall_rating: input.overall_rating,
    p_answers: input.answers,
    p_is_anonymous: input.is_anonymous,
    p_follow_up_requested: input.follow_up_requested,
  });
  if (error) throw error;
  return true;
}
