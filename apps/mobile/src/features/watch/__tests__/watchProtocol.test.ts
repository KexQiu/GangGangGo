import { describe, expect, it } from 'vitest';

import fixture from '../../../../fixtures/watch-today-state-v2.json';
import { summarizeWatchPayloadForDebug, summarizeWatchStateForDebug } from '../watchDebugStore';
import { createInvalidWatchPayloadAck, extractWatchEvent } from '../watchMessageParser';
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

  it('logs only allowlisted Watch metadata', () => {
    const sensitiveValue = 'must-not-appear';
    const payloadSummary = summarizeWatchPayloadForDebug({
      event: {
        id: 'event-1',
        payload: {
          accessToken: sensitiveValue,
          symptoms: sensitiveValue,
        },
        type: 'habit_toggled',
      },
      refreshToken: sensitiveValue,
      replyId: 'reply-1',
      type: 'watch_event',
    });
    const stateSummary = summarizeWatchStateForDebug(fixture as unknown as WatchTodayState);

    expect(payloadSummary).toBe('habit_toggled · eventId=event-1');
    expect(payloadSummary).not.toContain(sensitiveValue);
    expect(summarizeWatchPayloadForDebug(sensitiveValue)).toBe('type=invalid');
    expect(stateSummary).toContain('schema=2');
    expect(stateSummary).not.toContain(JSON.stringify(fixture.toilet));
  });

  it('accepts schema v2 events and rejects unknown schema with an error ACK', () => {
    const validEvent = {
      createdAt: '2026-07-13T10:00:00Z',
      id: 'event-v2',
      payload: {
        habitKey: 'water',
        level: 'done',
      },
      schemaVersion: 2,
      type: 'habit_toggled',
    };

    expect(extractWatchEvent({ event: validEvent, type: 'watch_event' })).toEqual(validEvent);
    expect(extractWatchEvent({ event: { ...validEvent, schemaVersion: 3 }, type: 'watch_event' })).toBeNull();
    expect(createInvalidWatchPayloadAck()).toEqual({
      eventId: 'unknown',
      message: '手表消息格式不对。',
      status: 'rejected',
    });
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
