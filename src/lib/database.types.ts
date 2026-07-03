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
          id: string
          email: string
          role: string
          created_at: string | null
        }
        Insert: {
          id?: string
          email: string
          role?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          role?: string
          created_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          actor_email: string | null
          action_type: string
          target_type: string
          target_id: string | null
          old_value: Json | null
          new_value: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_email?: string | null
          action_type: string
          target_type: string
          target_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_email?: string | null
          action_type?: string
          target_type?: string
          target_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          id: string
          first_name: string
          surname: string | null
          middle_name: string | null
          birthday: string | null
          gender: string | null
          phone: string | null
          email: string | null
          address: string | null
          status: string | null
          member_type: string
          tags: string[]
          ministry_group: string | null
          age_group: string | null
          communication_consent: boolean
          unsubscribed: boolean
          is_active: boolean
          archived_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          first_name: string
          surname?: string | null
          middle_name?: string | null
          birthday?: string | null
          gender?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          status?: string | null
          member_type?: string
          tags?: string[]
          ministry_group?: string | null
          age_group?: string | null
          communication_consent?: boolean
          unsubscribed?: boolean
          is_active?: boolean
          archived_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          surname?: string | null
          middle_name?: string | null
          birthday?: string | null
          gender?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          status?: string | null
          member_type?: string
          tags?: string[]
          ministry_group?: string | null
          age_group?: string | null
          communication_consent?: boolean
          unsubscribed?: boolean
          is_active?: boolean
          archived_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          id: string
          event_id: string
          member_id: string
          status: string
          notes: string | null
          registered_at: string
          registered_by: string | null
        }
        Insert: {
          id?: string
          event_id: string
          member_id: string
          status?: string
          notes?: string | null
          registered_at?: string
          registered_by?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          member_id?: string
          status?: string
          notes?: string | null
          registered_at?: string
          registered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'event_registrations_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_registrations_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          id: string
          title: string
          description: string | null
          event_type: string | null
          venue: string | null
          starts_at: string
          ends_at: string
          capacity: number | null
          requires_registration: boolean
          allow_walk_in: boolean
          is_published: boolean
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          event_type?: string | null
          venue?: string | null
          starts_at: string
          ends_at: string
          capacity?: number | null
          requires_registration?: boolean
          allow_walk_in?: boolean
          is_published?: boolean
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          event_type?: string | null
          venue?: string | null
          starts_at?: string
          ends_at?: string
          capacity?: number | null
          requires_registration?: boolean
          allow_walk_in?: boolean
          is_published?: boolean
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      website_settings: {
        Row: {
          key: string
          value: Json | null
          updated_at: string | null
        }
        Insert: {
          key: string
          value?: Json | null
          updated_at?: string | null
        }
        Update: {
          key?: string
          value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      member_activity_summary_view: {
        Row: {
          member_id: string
          first_name: string
          surname: string | null
          member_type: string
          ministry_group: string | null
          attended_90d: number
          attended_prev_90d: number
          registrations_90d: number
          attended_total: number
          no_show_count: number
          last_attended_at: string | null
          activity_score: number
          activity_status: string
          trend: string
        }
        Relationships: []
      }
    }
    Functions: {
      register_for_event: {
        Args: {
          p_event_id: string
          p_first_name: string
          p_surname: string
          p_phone: string
          p_address?: string | null
          p_notes?: string | null
          p_email?: string | null
        }
        Returns: Json
      }
      is_reg_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      get_admin_role: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
