import { describe, expect, it } from 'vitest';
import { isBareRoute } from './routes';

describe('isBareRoute', () => {
  it('marks auth surfaces as bare', () => {
    expect(isBareRoute('/login')).toBe(true);
    expect(isBareRoute('/auth/callback')).toBe(true);
  });

  it('keeps app routes inside shell', () => {
    expect(isBareRoute('/')).toBe(false);
    expect(isBareRoute('/members')).toBe(false);
  });
});
