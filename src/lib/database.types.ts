export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
        }
      }
      event_registrations: {
        Row: {
          id: string
          event_id: string
          first_name: string
          last_name: string
          city_address: string
          phone: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          first_name: string
          last_name: string
          city_address: string
          phone: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          first_name?: string
          last_name?: string
          city_address?: string
          phone?: string
          status?: string
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          title: string
          description: string | null
          venue: string | null
          starts_at: string
          ends_at: string
          capacity: number | null
          requires_registration: boolean
          allow_walk_in: boolean
          is_published: boolean
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          venue?: string | null
          starts_at: string
          ends_at: string
          capacity?: number | null
          requires_registration?: boolean
          allow_walk_in?: boolean
          is_published?: boolean
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          venue?: string | null
          starts_at?: string
          ends_at?: string
          capacity?: number | null
          requires_registration?: boolean
          allow_walk_in?: boolean
          is_published?: boolean
          is_active?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
