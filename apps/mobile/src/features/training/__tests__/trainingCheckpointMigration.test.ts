import { expect, it } from 'vitest';
import { migrateTrainingCheckpoint, loadTrainingCheckpoint } from '../trainingCheckpointMigration';
import { TrainingClock, parseTrainingCheckpoint } from '../trainingClock';
it('converts old timing into one frozen interrupted record without resuming the old timeline', () => {
  const old = {
    id: 'old-1',
    presetId: 'standard',
    startedAt: '2026-09-28T00:00:00Z',
    elapsedMs: 25_000,
    endedAt: null,
  };
  const migrated = migrateTrainingCheckpoint(JSON.stringify(old), new Date('2026-09-29T00:00:00Z'));
  const clock = new TrainingClock('quick', parseTrainingCheckpoint(JSON.stringify(migrated)), () => {});
  clock.resume();
  expect(clock.paused).toBe(true);
  expect(clock.draft).toMatchObject({
    id: old.id,
    startedAt: old.startedAt,
    isCompleted: false,
    endReason: 'interrupted',
    completedRepetitions: 2,
    durationSeconds: 25,
    feedback: 'unanswered',
  });
  expect(clock.finish()).toEqual(migrated.draft);
});
it('rejects unreadable legacy progress rather than discarding it', () => {
  expect(() => migrateTrainingCheckpoint('{broken')).toThrow();
  expect(() => migrateTrainingCheckpoint(JSON.stringify({ presetId: 'unknown' }))).toThrow();
});

it('finishes an interrupted key migration without reviving old progress or changing its frozen draft', () => {
  const values = new Map([
    [
      'old',
      JSON.stringify({
        id: 'old-1',
        presetId: 'quick',
        startedAt: '2026-09-28T00:00:00Z',
        elapsedMs: 2000,
        endedAt: null,
      }),
    ],
  ]);
  let failRemoval = true;
  const storage = {
    getItemSync: (key: string) => values.get(key) ?? null,
    setItemSync: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItemSync: (key: string) => {
      if (failRemoval) throw new Error('interrupted');
      values.delete(key);
    },
  };
  expect(() => loadTrainingCheckpoint(storage, 'new', 'old')).toThrow('interrupted');
  const persisted = values.get('new');
  failRemoval = false;
  expect(loadTrainingCheckpoint(storage, 'new', 'old')).toEqual(JSON.parse(persisted!));
  expect(values.has('old')).toBe(false);
  values.delete('new');
  expect(loadTrainingCheckpoint(storage, 'new', 'old')).toBeNull();
});
