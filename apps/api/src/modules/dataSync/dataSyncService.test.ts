import { describe, expect, it } from 'vitest';

import type { DataSyncMutation } from '@xiaotidu/contracts';

import { mockCurrentUser } from '../users/userTypes.js';
import { createMockDataSyncService, expirationForLocalDate } from './dataSyncService.js';

const mutation: DataSyncMutation = {
  changedAt: '2026-07-21T08:00:00.000Z',
  entityId: '2026-07-21',
  entityType: 'habit_checkin',
  mutationId: 'mutation-1',
  operation: 'upsert',
  payload: {
    bowel: 'good',
    date: '2026-07-21',
    fiber: 'medium',
    movement: 'good',
    water: 'low',
  },
};

describe('data sync service', () => {
  it('expires a local date after 90 calendar days in its recording time zone', () => {
    expect(expirationForLocalDate('2026-07-21', 'Asia/Shanghai').toISOString()).toBe('2026-10-18T16:00:00.000Z');
    expect(expirationForLocalDate('2026-07-21', 'Unknown/Zone').toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });

  it('accepts a mutation idempotently and preserves its original server version', async () => {
    const service = createMockDataSyncService();
    const first = await service.push(mockCurrentUser, [mutation], 'Asia/Shanghai');
    const duplicate = await service.push(
      mockCurrentUser,
      [{ ...mutation, changedAt: '2026-07-21T09:00:00.000Z' }],
      'Asia/Shanghai',
    );
    const pulled = await service.pull(mockCurrentUser, '0');

    expect(first.acceptedMutationIds).toEqual(['mutation-1']);
    expect(duplicate.changes).toEqual(first.changes);
    expect(pulled.changes).toEqual(first.changes);
  });

  it('orders latest accepted mutations and isolates users', async () => {
    const service = createMockDataSyncService();
    const otherUser = {
      ...mockCurrentUser,
      appleUserId: 'mock-other',
      id: '00000000-0000-4000-8000-000000000002',
    };
    await service.push(mockCurrentUser, [mutation], 'Asia/Shanghai');
    await service.push(
      mockCurrentUser,
      [
        {
          ...mutation,
          mutationId: 'mutation-2',
          payload: { ...mutation.payload, water: 'good' },
        },
      ],
      'Asia/Shanghai',
    );

    const pulled = await service.pull(mockCurrentUser, '0');
    const isolated = await service.pull(otherUser, '0');
    expect(pulled.changes.map((change) => change.version)).toEqual([1, 2]);
    expect(pulled.changes.at(-1)?.payload).toMatchObject({ water: 'good' });
    expect(isolated.changes).toEqual([]);
  });
});
