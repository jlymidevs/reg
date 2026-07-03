import { supabase } from './supabase';
import type { Database } from './database.types';

export type Event = Database['public']['Tables']['events']['Row'];
export type Member = Database['public']['Tables']['members']['Row'];
export type Registration = Database['public']['Tables']['event_registrations']['Row'];

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
