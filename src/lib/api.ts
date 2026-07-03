import { supabase } from './supabase';
import type { Database } from './database.types';

export type Event = Database['public']['Tables']['events']['Row'];
export type Registration = Database['public']['Tables']['event_registrations']['Row'];

// --- PUBLIC API ---

export async function getActiveEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    // .order('starts_at', { ascending: true }); // Depending on DB support, omitting for safety
    
  if (error) throw error;
  
  // Sort on client side to be safe
  const sorted = [...(data as Event[])].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return sorted;
}

export async function getEventById(id: string) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle();
    
  if (error) throw error;
  return data as Event | null;
}

export async function createRegistration(registration: Omit<Database['public']['Tables']['event_registrations']['Insert'], 'status' | 'created_at' | 'id'>) {
  // @ts-ignore
  const { error } = await supabase
    .from('event_registrations')
    // @ts-ignore
    .insert([registration]);
    
  if (error) throw error;
  return true; 
}

// --- ADMIN API ---

export async function getAllEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data as Event[];
}

export async function createEvent(event: Omit<Database['public']['Tables']['events']['Insert'], 'id' | 'created_at'>) {
  // @ts-ignore
  const { data, error } = await supabase
    .from('events')
    // @ts-ignore
    .insert([event]);
    
  if (error) throw error;
  return data as any;
}

export async function updateEvent(id: string, updates: Database['public']['Tables']['events']['Update']) {
  // @ts-ignore
  const { data, error } = await supabase
    .from('events')
    // @ts-ignore
    .update(updates)
    .eq('id', id);
    
  if (error) throw error;
  return data as any;
}

export async function getAllRegistrations() {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('*, events(title)')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data;
}

export async function updateRegistrationStatus(id: string, status: string) {
  // @ts-ignore
  const { data, error } = await supabase
    .from('event_registrations')
    // @ts-ignore
    .update({ status })
    .eq('id', id);
    
  if (error) throw error;
  return data as any;
}
