import { describe, expect, it, vi } from 'vitest';
import { createTrainingCompletion, type TrainingCompletionDraft } from '../trainingCompletion';

const draft: TrainingCompletionDraft = {
  generation: 3,
  session: {
    id: 'same-id',
    startedAt: '2026-09-28T00:00:00Z',
    endedAt: '2026-09-28T00:02:00Z',
    presetId: 'standard',
    durationSeconds: 120,
    completedRepetitions: 12,
    isCompleted: true,
    feedback: 'unanswered' as const,
    endReason: 'completed' as const,
    plan: { contractSeconds: 5, relaxSeconds: 5, repetitions: 12 },
  },
};

describe('training completion navigation', () => {
  it('waits for save and coalesces repeated completion clicks', async () => {
    let resolve!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const onSaved = vi.fn();
    const completion = createTrainingCompletion(save, onSaved, vi.fn());
    const first = completion.finish(() => draft);
    const second = completion.finish(() => {
      throw new Error('must not recreate draft');
    });
    expect(second).toBe(first);
    expect(save).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    resolve();
    await expect(first).resolves.toBe(true);
    await completion.finish(() => draft);
    expect(save).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(draft.session);
  });

  it('stays on the page after failure and retries the original ID, times and owner generation', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);
    const onSaved = vi.fn();
    const onError = vi.fn();
    const completion = createTrainingCompletion(save, onSaved, onError);
    await expect(completion.finish(() => draft)).resolves.toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
    await expect(
      completion.finish(() => {
        throw new Error('must reuse original draft');
      }),
    ).resolves.toBe(true);
    expect(save.mock.calls.map(([value]) => value)).toEqual([draft, draft]);
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(draft.session);
  });

  it('does not navigate when a stale account draft is refused', async () => {
    const onSaved = vi.fn();
    const onError = vi.fn();
    const completion = createTrainingCompletion(
      async () => {
        throw new Error('session changed');
      },
      onSaved,
      onError,
    );
    await completion.finish(() => draft);
    await completion.finish(() => ({ ...draft, generation: 4 }));
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
