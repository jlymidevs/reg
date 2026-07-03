import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define output file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'attendee_history.json');

async function syncHistory() {
  console.log('🔄 Starting attendee history sync...');
  
  try {
    // Fetch all registrations with event details
    const { data: registrations, error } = await supabase
      .from('event_registrations')
      .select('*, events(title)');
      
    if (error) throw error;
    
    // Group by email to create member profiles
    const membersMap = new Map();
    
    registrations.forEach((reg) => {
      const email = reg.email.toLowerCase();
      
      if (!membersMap.has(email)) {
        membersMap.set(email, {
          email,
          full_name: reg.full_name,
          phone: reg.phone,
          total_events_registered: 0,
          total_events_attended: 0,
          total_events_cancelled: 0,
          event_history: []
        });
      }
      
      const member = membersMap.get(email);
      
      // Update name/phone to latest if needed, though grouping by email is primary
      member.full_name = reg.full_name; 
      member.phone = reg.phone;
      
      // Update stats
      member.total_events_registered++;
      if (reg.status === 'attended') member.total_events_attended++;
      if (reg.status === 'cancelled') member.total_events_cancelled++;
      
      // Add to history
      member.event_history.push({
        registration_id: reg.id,
        event_id: reg.event_id,
        event_title: reg.events?.title,
        event_date: reg.events?.event_date,
        event_location: reg.events?.location,
        status: reg.status,
        registered_at: reg.created_at,
        notes: reg.notes
      });
    });
    
    // Sort histories by date (newest first)
    const membersArray = Array.from(membersMap.values()).map(member => {
      member.event_history.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
      return member;
    });
    
    // Create database object
    const database = {
      last_synced: new Date().toISOString(),
      total_members: membersArray.length,
      members: membersArray
    };
    
    // Write to local JSON file
    await fs.writeFile(DB_FILE, JSON.stringify(database, null, 2), 'utf-8');
    
    console.log(`✅ Successfully synced ${membersArray.length} members to ${DB_FILE}`);
    
  } catch (err) {
    console.error('❌ Error syncing history:', err);
  }
}

syncHistory();
