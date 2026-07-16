import { describe, expect, it, vi } from 'vitest';
import { DashboardSnapshotLoadError, loadDashboardSnapshot } from './pcm-data';

type QueryResult = { data: unknown; error: unknown };

function query(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (onfulfilled: (value: QueryResult) => unknown, onrejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  };

  return builder;
}

function createSupabase(results: QueryResult[]) {
  return {
    from: vi.fn(() => query(results.shift() ?? { data: null, error: null })),
  };
}

describe('loadDashboardSnapshot', () => {
  it('throws a typed error when a live dashboard query fails', async () => {
    const supabase = createSupabase([
      { data: null, error: { message: 'members unavailable' } },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);

    await expect(loadDashboardSnapshot(supabase as never, ['admin'])).rejects.toBeInstanceOf(DashboardSnapshotLoadError);
  });
});
