import type { TrainingSession } from './trainingTypes';

export type TrainingCompletionDraft = { session: TrainingSession; generation: number };

/** 失败重试复用同一 ID 和结束时刻；保存期间的重复点击共用同一次写入。 */
export function createTrainingCompletion(
  save: (draft: TrainingCompletionDraft) => Promise<unknown>,
  onSaved: (session: TrainingSession) => void,
  onError: (error: unknown) => void,
) {
  let draft: TrainingCompletionDraft | null = null;
  let pending: Promise<boolean> | null = null;
  let saved = false;
  return {
    finish(createDraft: () => TrainingCompletionDraft): Promise<boolean> {
      if (saved) return Promise.resolve(true);
      if (pending) return pending;
      try {
        draft ??= createDraft();
      } catch (error) {
        onError(error);
        return Promise.resolve(false);
      }
      const current = draft;
      pending = (async () => {
        try {
          await save(current);
        } catch (error) {
          onError(error);
          return false;
        }
        saved = true;
        onSaved(current.session);
        return true;
      })().finally(() => {
        pending = null;
      });
      return pending;
    },
  };
}
