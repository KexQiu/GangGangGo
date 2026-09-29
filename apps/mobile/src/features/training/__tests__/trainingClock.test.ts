import { beforeEach, expect, it } from 'vitest';
import { TrainingClock, parseTrainingCheckpoint, type TrainingCheckpoint } from '../trainingClock';
import { getTrainingPreset } from '../presets';
let now: number;
let wall: Date;
let saved: TrainingCheckpoint | null;
const create = (preset = 'beginner', checkpoint: TrainingCheckpoint | null = null) =>
  new TrainingClock(
    preset,
    checkpoint,
    (value) => {
      saved = value;
    },
    () => now,
    () => wall,
  );
function boundary(timer: TrainingClock) {
  timer.confirmPrompt();
  now += timer.nextBoundaryDelay ?? 0;
  timer.sample();
  timer.confirmPrompt();
}
beforeEach(() => {
  now = 0;
  wall = new Date('2026-09-29T00:00:00Z');
  saved = null;
});
it('prepares without counting, and counts only complete guided cycles for all modes', () => {
  for (const id of ['beginner', 'standard', 'quick']) {
    const timer = create(id);
    boundary(timer);
    expect(timer.elapsedSeconds).toBe(0);
    const preset = getTrainingPreset(id);
    for (let index = 0; index < preset.repetitions; index++) {
      boundary(timer);
      expect(timer.completedRepetitions).toBe(index);
      boundary(timer);
      expect(timer.completedRepetitions).toBe(index + 1);
    }
    expect(timer.draft).toMatchObject({
      completedRepetitions: preset.repetitions,
      durationSeconds: (preset.contractSeconds + preset.relaxSeconds) * preset.repetitions,
      isCompleted: true,
      feedback: 'unanswered',
    });
  }
});
it('does not skip relaxation or credit a repetition after a 2.1 second short-mode stall', () => {
  const timer = create('quick');
  boundary(timer);
  now += 2100;
  timer.sample();
  expect(timer.paused).toBe(true);
  expect(timer.interrupted).toBe(true);
  expect(timer.completedRepetitions).toBe(0);
  now += 90_000;
  timer.sample();
  expect(timer.completedRepetitions).toBe(0);
  timer.resume();
  timer.confirmPrompt();
  expect(timer.phase).toBe('relax');
  boundary(timer);
  expect(timer.completedRepetitions).toBe(0);
  boundary(timer);
  boundary(timer);
  expect(timer.completedRepetitions).toBe(1);
});
it('gives the next phase its full duration instead of catching up a tolerated late callback', () => {
  const timer = create('quick');
  boundary(timer);
  now += 1200;
  timer.sample();
  expect(timer.phase).toBe('relax');
  timer.confirmPrompt();
  expect(timer.nextBoundaryDelay).toBe(1000);
});
it('resumes an interrupted contraction with full relaxation without crediting it', () => {
  const timer = create();
  boundary(timer);
  now += 2000;
  timer.pause();
  now += 100_000;
  expect(timer.elapsedSeconds).toBe(2);
  timer.resume();
  boundary(timer);
  expect(timer.phase).toBe('contract');
  expect(timer.completedRepetitions).toBe(0);
});
it('resumes an interrupted relaxation with full relaxation and credits the prior complete contraction once', () => {
  const timer = create();
  boundary(timer);
  boundary(timer);
  now += 500;
  timer.pause();
  now += 100_000;
  timer.resume();
  timer.confirmPrompt();
  expect(timer.nextBoundaryDelay).toBe(3000);
  boundary(timer);
  expect(timer.completedRepetitions).toBe(1);
  expect(timer.phase).toBe('contract');
});
it('keeps actual activity separate from wall clock and a selected configuration snapshot', () => {
  const preset = { ...getTrainingPreset('beginner'), contractSeconds: 2, relaxSeconds: 6, repetitions: 1 };
  const timer = new TrainingClock(
    preset,
    null,
    (value) => {
      saved = value;
    },
    () => now,
    () => wall,
  );
  preset.repetitions = 10;
  boundary(timer);
  wall = new Date('2026-10-01T00:00:00Z');
  boundary(timer);
  boundary(timer);
  expect(timer.draft).toMatchObject({ durationSeconds: 8, completedRepetitions: 1, plan: { repetitions: 1 } });
});
it('restores paused and disallows cross-day continuation, retaining partial progress', () => {
  const timer = create();
  boundary(timer);
  boundary(timer);
  boundary(timer);
  timer.pause();
  wall = new Date('2026-09-30T00:00:00Z');
  const restored = create('quick', parseTrainingCheckpoint(JSON.stringify(saved)));
  expect(restored.stale).toBe(true);
  restored.resume();
  expect(restored.paused).toBe(true);
  expect(restored.finish('interrupted')).toMatchObject({ completedRepetitions: 1, isCompleted: false });
});
it('persists the same ended draft, feedback and times across restart and retries', () => {
  const timer = create();
  boundary(timer);
  now += 1000;
  const record = timer.finish('discomfort');
  timer.setFeedback('reported');
  wall = new Date('2026-09-30T00:00:00Z');
  const restored = create('quick', saved);
  restored.resume();
  expect(restored.paused).toBe(true);
  expect(restored.finish()).toEqual(record);
});
it('pauses on persistence failure and retains in-memory progress', () => {
  let failing = false;
  const timer = new TrainingClock(
    'beginner',
    null,
    () => {
      if (failing) throw new Error('disk full');
    },
    () => now,
  );
  boundary(timer);
  now += 1000;
  failing = true;
  expect(() => timer.pause()).toThrow('disk full');
  expect(timer.paused).toBe(true);
  expect(timer.elapsedSeconds).toBe(1);
});
it('rejects malformed checkpoints', () => {
  expect(() => parseTrainingCheckpoint('{broken')).toThrow();
  expect(() => parseTrainingCheckpoint(JSON.stringify({ version: 2, presetId: 'unknown' }))).toThrow();
});

it('locks submitted feedback across cold starts and freezes activity during an exit confirmation', () => {
  const timer = create('quick');
  boundary(timer);
  boundary(timer);
  timer.pause();
  now += 300_000;
  timer.sample();
  expect(timer.completedRepetitions).toBe(0);
  timer.resume();
  boundary(timer);
  expect(timer.completedRepetitions).toBe(1);
  timer.finish('user_stopped');
  timer.setFeedback('none');
  timer.lockSubmission();
  const restored = create('quick', saved);
  restored.setFeedback('reported');
  expect(restored.draft?.feedback).toBe('none');
  expect(restored.draft?.durationSeconds).toBe(2);
});
it('does not turn an expired checkpoint into current-day progress merely by opening and closing it', () => {
  const timer = create();
  boundary(timer);
  timer.pause();
  const previousDate = saved!.updatedAt;
  wall = new Date('2026-10-01T00:00:00Z');
  const restored = create('beginner', saved);
  restored.pause();
  expect(saved!.updatedAt).toBe(previousDate);
  expect(create('beginner', saved).stale).toBe(true);
});
it('repeated pauses and endpoint recovery count the last complete contraction exactly once', () => {
  const timer = create('quick');
  boundary(timer);
  for (let i = 0; i < 15; i++) {
    boundary(timer);
    boundary(timer);
  }
  boundary(timer);
  now += 1000;
  timer.pause();
  expect(timer.completedRepetitions).toBe(15);
  expect(timer.finished).toBe(false);
  const restored = create('quick', saved);
  restored.resume();
  restored.confirmPrompt();
  now += 500;
  restored.pause();
  restored.resume();
  boundary(restored);
  expect(restored.completedRepetitions).toBe(16);
  expect(restored.finished).toBe(true);
  expect(restored.elapsedSeconds).toBeGreaterThan(32);
});

it('records an actual wall-clock reversal without changing monotonic duration', () => {
  const timer = create('quick');
  boundary(timer);
  boundary(timer);
  wall = new Date('2026-09-28T23:00:00Z');
  boundary(timer);
  const record = timer.finish('user_stopped');
  expect(record.startedAt).toBe('2026-09-29T00:00:00.000Z');
  expect(record.endedAt).toBe(wall.toISOString());
  expect(record.durationSeconds).toBe(2);
  expect(record.completedRepetitions).toBe(1);
  expect(parseTrainingCheckpoint(JSON.stringify(saved))?.draft).toEqual(record);
});

it('keeps an overnight paused session blocked without requiring a process restart', () => {
  const timer = create();
  boundary(timer);
  timer.pause();
  wall = new Date('2026-09-30T00:00:00Z');
  expect(timer.stale).toBe(true);
  timer.resume();
  expect(timer.paused).toBe(true);
  expect(timer.finish('interrupted').isCompleted).toBe(false);
});

it('starts each full phase only after its prompt is committed, excluding a slow checkpoint write', () => {
  const timer = new TrainingClock(
    'quick',
    null,
    () => {
      now += 800;
    },
    () => now,
    () => wall,
  );
  expect(timer.nextBoundaryDelay).toBeNull();
  timer.confirmPrompt();
  now += 3000;
  timer.sample();
  expect(timer.phase).toBe('contract');
  now += 2100;
  timer.sample();
  expect(timer.elapsedSeconds).toBe(0);
  expect(timer.nextBoundaryDelay).toBeNull();
  timer.confirmPrompt();
  expect(timer.nextBoundaryDelay).toBe(1000);
  now += 1000;
  timer.sample();
  expect(timer.phase).toBe('relax');
  expect(timer.completedRepetitions).toBe(0);
  timer.confirmPrompt();
  expect(timer.nextBoundaryDelay).toBe(1000);
  now += 1000;
  timer.sample();
  expect(timer.completedRepetitions).toBe(1);
  expect(timer.elapsedSeconds).toBe(2);
});
