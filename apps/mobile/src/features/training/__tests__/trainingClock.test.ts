import { beforeEach, expect, it } from 'vitest';
import { TrainingClock, parseTrainingCheckpoint, type TrainingCheckpoint } from '../trainingClock';

let monotonic: number;
let wall: Date;
let saved: TrainingCheckpoint | null;
function clock(checkpoint: TrainingCheckpoint | null = null) {
  return new TrainingClock(
    'beginner',
    checkpoint,
    (value) => {
      saved = value;
    },
    () => monotonic,
    () => wall,
  );
}
beforeEach(() => {
  monotonic = 0;
  wall = new Date('2026-09-29T00:00:00Z');
  saved = null;
});
it('calibrates a delayed tick from elapsed time and keeps the correct action phase', () => {
  const timer = clock();
  monotonic = 12_900;
  timer.sample();
  expect(timer.elapsedSeconds).toBe(12);
  expect(timer.finish()).toMatchObject({ completedRepetitions: 2, durationSeconds: 12, isCompleted: false });
});
it('excludes background time and preserves subsecond progress across repeated pauses', () => {
  const timer = clock();
  monotonic = 750;
  timer.pause();
  monotonic = 100_000;
  expect(timer.elapsedSeconds).toBe(0);
  expect(timer.paused).toBe(true);
  timer.pause();
  timer.resume();
  monotonic += 750;
  expect(timer.elapsedSeconds).toBe(1);
});
it('restores only checkpointed progress, paused, with the original preset and start time', () => {
  const original = clock();
  monotonic = 5_500;
  original.sample();
  wall = new Date('2026-09-30T00:00:00Z');
  monotonic = 0;
  const restored = new TrainingClock(
    'quick',
    parseTrainingCheckpoint(JSON.stringify(saved)),
    () => {},
    () => monotonic,
    () => wall,
  );
  expect(restored.paused).toBe(true);
  expect(restored.elapsedSeconds).toBe(5);
  expect(restored.preset.id).toBe('beginner');
  expect(restored.finish().startedAt).toBe('2026-09-29T00:00:00.000Z');
});
it('does not change duration when the wall clock changes, and caps at the preset duration', () => {
  const timer = clock();
  wall = new Date('2026-10-29T00:00:00Z');
  monotonic = 65_000;
  expect(timer.finish()).toMatchObject({ durationSeconds: 60, completedRepetitions: 10, isCompleted: true });
});
it('retains the original ID and end time across a restart before save retry', () => {
  const timer = clock();
  monotonic = 9_000;
  const first = timer.finish();
  wall = new Date('2026-10-01T00:00:00Z');
  const restored = clock(saved);
  restored.resume();
  expect(restored.paused).toBe(true);
  expect(restored.finish()).toEqual(first);
});
it('pauses after a failed checkpoint and can retry without losing in-memory progress', () => {
  let failing = false;
  const timer = new TrainingClock(
    'beginner',
    null,
    () => {
      if (failing) throw new Error('disk full');
    },
    () => monotonic,
    () => wall,
  );
  failing = true;
  monotonic = 4_500;
  expect(() => timer.sample()).toThrow('disk full');
  monotonic += 100_000;
  expect(timer.paused).toBe(true);
  expect(timer.elapsedSeconds).toBe(4);
  failing = false;
  timer.resume();
  monotonic += 500;
  expect(timer.elapsedSeconds).toBe(5);
});
it('rejects a malformed checkpoint instead of silently starting over', () => {
  expect(() => parseTrainingCheckpoint('{broken')).toThrow();
  expect(() => parseTrainingCheckpoint(JSON.stringify({ presetId: 'unknown', elapsedMs: -1 }))).toThrow();
});
