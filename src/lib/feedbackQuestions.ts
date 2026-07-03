// Fixed 12-question feedback set — not a builder, per spec. Q1 is stored
// separately as feedback_responses.overall_rating for fast aggregates;
// the rest live in the answers jsonb keyed by id.
export type FeedbackQuestion =
  | { id: string; type: 'rating'; label: string }
  | { id: string; type: 'textarea'; label: string }
  | { id: string; type: 'yesno'; label: string };

export const FEEDBACK_QUESTIONS: FeedbackQuestion[] = [
  { id: 'q2_registration_ease', type: 'rating', label: 'Was the registration process easy to complete?' },
  { id: 'q3_checkin_smooth', type: 'rating', label: 'Was check-in smooth and organized?' },
  { id: 'q4_welcomed', type: 'rating', label: 'Did you feel welcomed and included?' },
  { id: 'q5_age_suitable', type: 'rating', label: 'Was the event suitable and comfortable for your age group?' },
  { id: 'q6_inclusive', type: 'rating', label: 'Was the event respectful and inclusive for all genders?' },
  { id: 'q7_venue', type: 'rating', label: 'Was the venue/location accessible and comfortable?' },
  { id: 'q8_went_well', type: 'textarea', label: 'What part of the event went well?' },
  { id: 'q9_improve', type: 'textarea', label: 'What can we improve next time?' },
  { id: 'q10_all_ages', type: 'textarea', label: 'Suggestions for making future events better for children, youth, adults, seniors, men, women, and all members?' },
  { id: 'q11_follow_up', type: 'yesno', label: 'Would you like someone from the church team to follow up with you?' },
];
