import { describe, expect, it } from 'vitest';
import { normalizePhone, registrationSchema } from './schema';

describe('normalizePhone', () => {
  it('strips non-digits and keeps last 10', () => {
    expect(normalizePhone('+63 917-123-4567')).toBe('9171234567');
  });
  it('returns short numbers as-is (digits only)', () => {
    expect(normalizePhone('12345')).toBe('12345');
  });
});

describe('registrationSchema', () => {
  const valid = {
    first_name: 'Ana', last_name: 'Cruz', mobile: '09171234567',
    email: 'ana@example.com', is_first_time: true, consent_given: true,
  };
  it('accepts a minimal valid payload', () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects when consent is false', () => {
    expect(registrationSchema.safeParse({ ...valid, consent_given: false }).success).toBe(false);
  });
  it('rejects invalid email', () => {
    expect(registrationSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
  });
  it('rejects mobile with fewer than 7 digits', () => {
    expect(registrationSchema.safeParse({ ...valid, mobile: '123' }).success).toBe(false);
  });
});
