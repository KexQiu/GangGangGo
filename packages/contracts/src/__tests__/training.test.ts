import { expect, it } from 'vitest';
import {
  createDefaultTrainingPreferences,
  trainingPreferencesSchema,
  trainingDefaults,
  trainingSessionSyncPayloadSchema,
  dataSyncMutationSchema,
} from '../index.js';
it('defaults the personal target off and only allows reducing holds and counts or increasing rests', () => {
  expect(createDefaultTrainingPreferences().dailyTarget).toBeNull();
  for (const id of ['beginner', 'standard', 'quick'] as const) {
    const defaults = trainingDefaults[id];
    for (const parameters of [
      { contractSeconds: defaults.contractSeconds + 1 },
      { relaxSeconds: defaults.relaxSeconds - 1 },
      { relaxSeconds: 31 },
      { repetitions: defaults.repetitions + 1 },
      { repetitions: 1.5 },
    ]) {
      const value = createDefaultTrainingPreferences();
      Object.assign(value.presets[id], parameters);
      expect(trainingPreferencesSchema.safeParse(value).success).toBe(false);
    }
    const value = createDefaultTrainingPreferences();
    value.presets[id] = { contractSeconds: 1, relaxSeconds: 30, repetitions: 1 };
    expect(trainingPreferencesSchema.safeParse(value).success).toBe(true);
  }
});
it('preserves feedback distinctions, fixed snapshots, partial records and the singleton configuration contract', () => {
  for (const feedback of ['unanswered', 'none', 'reported']) {
    expect(
      trainingSessionSyncPayloadSchema.safeParse({
        presetId: 'beginner',
        plan: { contractSeconds: 1, relaxSeconds: 6, repetitions: 2 },
        startedAt: '2026-09-29T00:00:00Z',
        endedAt: '2026-09-29T00:00:08Z',
        localDate: '2026-09-29',
        durationSeconds: 8,
        completedRepetitions: 1,
        isCompleted: false,
        feedback,
        endReason: 'user_stopped',
      }).success,
    ).toBe(true);
  }
  const mutation = {
    mutationId: 'id-1',
    entityType: 'training_preferences',
    entityId: 'preferences',
    operation: 'upsert',
    payload: createDefaultTrainingPreferences(),
    changedAt: '2026-09-29T00:00:00Z',
  };
  expect(dataSyncMutationSchema.safeParse(mutation).success).toBe(true);
  expect(dataSyncMutationSchema.safeParse({ ...mutation, entityId: 'other' }).success).toBe(false);
  expect(dataSyncMutationSchema.safeParse({ ...mutation, operation: 'delete', payload: null }).success).toBe(false);
});
