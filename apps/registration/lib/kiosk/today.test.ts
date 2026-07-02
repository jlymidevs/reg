import { describe, expect, it } from 'vitest';
import { findTodayEvents, findRegistrableEvents } from './today';
import type { ChurchEvent } from '@jlycc/types';

function ev(overrides: Partial<ChurchEvent>): ChurchEvent {
  return {
    id: 'e1', title: 'T', description: null, event_type: 'service', venue: null,
    starts_at: '2026-07-02T10:00:00+08:00', ends_at: null,
    is_published: true, is_active: true, requires_registration: false,
    allow_walk_in: true, capacity: null, network_id: null, ministry_id: null,
    requirement_id: null,
    ...overrides,
  };
}

const NOW = new Date('2026-07-02T09:00:00+08:00');

describe('findTodayEvents', () => {
  it('includes an event starting later today', () => {
    expect(findTodayEvents([ev({})], NOW)).toHaveLength(1);
  });
  it('excludes tomorrow', () => {
    expect(findTodayEvents([ev({ starts_at: '2026-07-03T10:00:00+08:00' })], NOW)).toHaveLength(0);
  });
  it('includes an event that started earlier today (still checking in)', () => {
    expect(findTodayEvents([ev({ starts_at: '2026-07-02T07:00:00+08:00' })], NOW)).toHaveLength(1);
  });
});

describe('findRegistrableEvents', () => {
  it('includes upcoming requires_registration events', () => {
    expect(
      findRegistrableEvents([ev({ requires_registration: true, starts_at: '2026-07-04T09:00:00+08:00' })], NOW)
    ).toHaveLength(1);
  });
  it('excludes events not requiring registration', () => {
    expect(findRegistrableEvents([ev({})], NOW)).toHaveLength(0);
  });
  it('excludes events already ended (6h grace)', () => {
    expect(
      findRegistrableEvents([ev({ requires_registration: true, starts_at: '2026-07-01T09:00:00+08:00' })], NOW)
    ).toHaveLength(0);
  });
});
