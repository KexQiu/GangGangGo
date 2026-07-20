import { describe, expect, it } from 'vitest';

import { getLocalDateKey } from '../../features/habits/habitLogic';
import { buildLocalDateRange } from '../dateRange';
import { collectAllPages, normalizePageSize } from '../pagination';

describe('storage pagination', () => {
  it('normalizes page sizes to a bounded positive integer', () => {
    expect(normalizePageSize()).toBe(100);
    expect(normalizePageSize(Number.NaN)).toBe(100);
    expect(normalizePageSize(0)).toBe(1);
    expect(normalizePageSize(2.9)).toBe(2);
    expect(normalizePageSize(999)).toBe(250);
  });

  it('builds inclusive local-day ranges with an exclusive end', () => {
    const now = new Date(2026, 6, 13, 18, 45, 0);
    const expectedStart = new Date(now);
    expectedStart.setHours(0, 0, 0, 0);
    expectedStart.setDate(expectedStart.getDate() - 89);
    const expectedEnd = new Date(now);
    expectedEnd.setHours(0, 0, 0, 0);
    expectedEnd.setDate(expectedEnd.getDate() + 1);

    const range = buildLocalDateRange(90, now);

    expect(range.fromDate).toBe(getLocalDateKey(expectedStart));
    expect(range.fromDateTime).toBe(expectedStart.toISOString());
    expect(range.toDateExclusive).toBe(getLocalDateKey(expectedEnd));
    expect(range.toDateTimeExclusive).toBe(expectedEnd.toISOString());
  });

  it('collects every bounded page without dropping the trailing page', async () => {
    const pages = new Map([
      [undefined, { items: [3, 2], nextCursor: 'page-2' }],
      ['page-2', { items: [1], nextCursor: null }],
    ]);

    const items = await collectAllPages<number, string>(
      async (cursor) => pages.get(cursor) ?? { items: [], nextCursor: null },
    );

    expect(items).toEqual([3, 2, 1]);
  });
});
