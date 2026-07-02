// Domain types for JLYCC platform.
// TODO: replace hand-written rows with `supabase gen types typescript` output.

export type JourneyStatus = 'FTV' | 'OGV' | 'RM' | 'AM';

export type RoleCode =
  | 'member'
  | 'network_head'
  | 'ministry_head'
  | 'pcm_staff'
  | 'admin'
  | 'super_admin';

export type StageCode =
  | 'GOOD_NEWS'
  | 'SAINT'
  | 'SHEEP'
  | 'SON'
  | 'SERVANT'
  | 'SOJOURNER';

export interface MemberSummary {
  id: string;
  name: string;
  member_code: string | null;
  journey_status: JourneyStatus | null;
}

export interface ChurchEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  is_published: boolean;
  is_active: boolean;
  requires_registration: boolean;
  allow_walk_in: boolean;
  capacity: number | null;
  network_id: string | null;
  ministry_id: string | null;
  requirement_id: string | null;
  image_url?: string | null;
}

export interface AttendanceLog {
  id: string;
  event_id: string;
  member_id: string;
  checked_in_at: string;
  method: 'qr' | 'manual' | 'kiosk';
}

export interface CheckinResponse {
  success: boolean;
  duplicate?: boolean;
  member?: MemberSummary;
  checked_in_at?: string;
  error?: string;
}

export type RegistrationStatus =
  | 'registered' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show' | 'pending_review';

export interface EventRegistration {
  id: string;
  event_id: string;
  member_id: string | null;
  status: RegistrationStatus;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_middle_name: string | null;
  guest_nickname: string | null;
  guest_email: string | null;
  guest_mobile: string | null;
  guest_gender: string | null;
  guest_birthday: string | null;
  guest_address: string | null;
  emergency_contact: string | null;
  is_first_time: boolean;
  heard_about: string | null;
  consent_given: boolean;
  registered_at: string;
}
