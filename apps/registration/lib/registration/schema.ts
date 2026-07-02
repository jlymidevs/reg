import { z } from 'zod';

/** Digits only, last 10 (PH numbers: 0917... / +63917... both → 9171234567). */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(-10);
}

export const registrationSchema = z.object({
  first_name: z.string().trim().min(1, 'Required'),
  last_name: z.string().trim().min(1, 'Required'),
  middle_name: z.string().trim().optional().or(z.literal('')),
  nickname: z.string().trim().optional().or(z.literal('')),
  mobile: z.string().refine((v) => v.replace(/\D/g, '').length >= 7, 'Enter a valid mobile number'),
  email: z.string().trim().email('Enter a valid email'),
  gender: z.enum(['male', 'female']).optional(),
  birthday: z.string().optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
  emergency_contact: z.string().trim().optional().or(z.literal('')),
  is_first_time: z.boolean(),
  heard_about: z.string().trim().optional().or(z.literal('')),
  consent_given: z.boolean().refine((v) => v === true, { message: 'Consent is required' }),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
