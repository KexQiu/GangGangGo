import trainingFixture from '../../../../fixtures/watch-training-event-v4.json';
import { describe, expect, it } from 'vitest';

import fixture from '../../../../fixtures/watch-today-state-v6.json';
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

describe('Watch protocol v6 fixture', () => {
  it('matches the TypeScript payload contract', () => {
    expect(fixture.schemaVersion).toBe(6);
    expect(fixture.canUseActions).toBe(true);
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
    expect(stateSummary).toContain('schema=6');
    expect(stateSummary).toContain('actions=on');
    expect(stateSummary).not.toContain(JSON.stringify(fixture.toilet));
  });

  it('accepts schema v4 events and rejects unknown schema with an error ACK', () => {
    const validEvent = {
      createdAt: '2026-07-13T10:00:00Z',
      id: 'event-v2',
      payload: {
        habitKey: 'water',
        level: 'good',
      },
      schemaVersion: 4,
      owner: { userId: 'user-A', profileId: 'profile-A' },
      type: 'habit_toggled',
    };

    expect(extractWatchEvent({ event: validEvent, type: 'watch_event' })).toEqual(validEvent);
    expect(extractWatchEvent({ event: { ...validEvent, schemaVersion: 2 }, type: 'watch_event' })).toBeNull();
    expect(extractWatchEvent(validEvent)).toBeNull();
    expect(extractWatchEvent({ event: { ...validEvent, schemaVersion: undefined }, type: 'watch_event' })).toBeNull();
    expect(createInvalidWatchPayloadAck()).toEqual({
      eventId: 'unknown',
      message: '手表消息格式不对，请同步手机和手表版本。',
      status: 'rejected',
    });
  });

  it.each([
    { owner: null },
    { owner: { userId: 'A', profileId: '' } },
    { createdAt: 'invalid' },
    { payload: { mode: 'unknown', completedSets: 1, durationSeconds: 60 } },
    { payload: { mode: 'standard', completedSets: -1, durationSeconds: 60 } },
    { payload: { mode: 'standard', completedSets: 1, durationSeconds: Number.NaN } },
    { type: 'habit_toggled', payload: { habitKey: 'water', level: 'done' } },
    { type: 'habit_toggled', payload: { habitKey: 'invalid', level: null } },
    { type: 'toilet_timer_action', payload: { action: 'finish', elapsedSeconds: 10 } },
  ])('rejects malformed payload fields %# while echoing the event ID', (invalid) => {
    const payload = {
      type: 'watch_event',
      event: {
        id: 'invalid-event',
        schemaVersion: 4,
        createdAt: '2026-09-28T00:00:00Z',
        owner: { userId: 'A', profileId: 'profile-A' },
        type: 'training_finished',
        payload: { mode: 'standard', completedSets: 1, durationSeconds: 60 },
        ...invalid,
      },
    };
    expect(extractWatchEvent(payload)).toBeNull();
    expect(createInvalidWatchPayloadAck(payload)).toMatchObject({ eventId: 'invalid-event', status: 'rejected' });
  });

  it('normalizes a Swift-encoded omitted habit level to a clear operation', () => {
    expect(
      extractWatchEvent({
        type: 'watch_event',
        event: {
          schemaVersion: 4,
          id: 'clear-water',
          createdAt: '2026-09-28T00:00:00Z',
          owner: { userId: 'A', profileId: 'profile-A' },
          type: 'habit_toggled',
          payload: { habitKey: 'water' },
        },
      }),
    ).toMatchObject({ type: 'habit_toggled', payload: { habitKey: 'water', level: null } });
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

it('reads the shared v4 partial-training fixture without treating a set as a repetition', () => {
  expect(extractWatchEvent(trainingFixture)).toEqual(trainingFixture.event);
  const invalid = structuredClone(trainingFixture);
  invalid.event.payload.session.plan.contractSeconds = 4;
  expect(extractWatchEvent(invalid)).toBeNull();
  const mismatched = structuredClone(trainingFixture);
  mismatched.event.payload.session.id = 'watch-other';
  expect(extractWatchEvent(mismatched)).toBeNull();
  const wrongCompletion = structuredClone(trainingFixture);
  wrongCompletion.event.payload.session.isCompleted = true;
  expect(extractWatchEvent(wrongCompletion)).toBeNull();
});
