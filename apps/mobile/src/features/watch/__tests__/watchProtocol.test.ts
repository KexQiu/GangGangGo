import { describe, expect, it } from 'vitest';

import fixture from '../../../../fixtures/watch-today-state-v2.json';
import type { WatchTodayState } from '../watchTypes';

const forbiddenKeys = new Set([
  'accessToken',
  'refreshToken',
  'durationSeconds',
  'endedAt',
  'note',
  'startedAt',
  'symptoms',
  'token',
]);

describe('Watch protocol v2 fixture', () => {
  it('matches the TypeScript payload contract', () => {
    expect(fixture.schemaVersion).toBe(2);
    expect(fixture.habits.completion).toBeGreaterThanOrEqual(0);
    expect(fixture.habits.completion).toBeLessThanOrEqual(4);
    expect(fixture.trainingModes).not.toHaveLength(0);

    const state = fixture as unknown as WatchTodayState;
    expect(state.toilet.stage).toBe('normal');
    expect(state.trainingModes[0]?.id).toBe('beginner');
  });

  it('does not expose tokens or detailed health records', () => {
    expect(findForbiddenKeys(fixture)).toEqual([]);
  });
});

function findForbiddenKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenKeys(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) => [
    ...(forbiddenKeys.has(key) ? [`${path}.${key}`] : []),
    ...findForbiddenKeys(child, `${path}.${key}`),
  ]);
}
