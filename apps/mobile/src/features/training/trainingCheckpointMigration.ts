import { getTrainingPreset, isTrainingPresetId } from './presets';
import { parseTrainingCheckpoint, type TrainingCheckpoint } from './trainingClock';

/** 一次性迁移旧计时快照为待确认记录；旧时间轴不再用于继续训练。 */
export function migrateTrainingCheckpoint(value: string, now = new Date()): TrainingCheckpoint {
  const old = JSON.parse(value) as {
    id: string;
    presetId: string;
    startedAt: string;
    elapsedMs: number;
    endedAt: string | null;
  };
  if (
    !old ||
    !old.id ||
    !isTrainingPresetId(old.presetId) ||
    !Number.isFinite(Date.parse(old.startedAt)) ||
    !Number.isFinite(old.elapsedMs) ||
    old.elapsedMs < 0
  )
    throw new Error('旧训练进度无法读取，请返回后重试。');
  const preset = getTrainingPreset(old.presetId);
  const plan = {
    contractSeconds: preset.contractSeconds,
    relaxSeconds: preset.relaxSeconds,
    repetitions: preset.repetitions,
  };
  const elapsedMs = Math.min(old.elapsedMs, (plan.contractSeconds + plan.relaxSeconds) * plan.repetitions * 1000);
  const completedRepetitions = Math.floor(elapsedMs / ((plan.contractSeconds + plan.relaxSeconds) * 1000));
  const isCompleted = completedRepetitions === plan.repetitions;
  return {
    version: 2,
    id: old.id,
    presetId: preset.id,
    plan,
    startedAt: old.startedAt,
    updatedAt: now.toISOString(),
    elapsedMs,
    phase: 'ended',
    phaseElapsedMs: 0,
    completedRepetitions,
    contractionComplete: false,
    interrupted: true,
    submissionLocked: false,
    draft: {
      id: old.id,
      presetId: preset.id,
      plan,
      startedAt: old.startedAt,
      endedAt: old.endedAt ?? new Date(Math.max(Date.parse(old.startedAt), now.getTime())).toISOString(),
      durationSeconds: Math.floor(elapsedMs / 1000),
      completedRepetitions,
      isCompleted,
      feedback: 'unanswered',
      endReason: isCompleted ? 'completed' : 'interrupted',
    },
  };
}

/** 先验证新检查点再删除旧键；崩溃发生在两个写入之间时不会重新生成结束时间。 */
export function loadTrainingCheckpoint(
  storage: {
    getItemSync: (key: string) => string | null;
    setItemSync: (key: string, value: string) => void;
    removeItemSync: (key: string) => void;
  },
  key: string,
  oldKey: string,
): TrainingCheckpoint | null {
  const oldValue = storage.getItemSync(oldKey);
  let current = storage.getItemSync(key);
  if (!current && oldValue) {
    current = JSON.stringify(migrateTrainingCheckpoint(oldValue));
    storage.setItemSync(key, current);
  }
  const saved = parseTrainingCheckpoint(current);
  if (oldValue && saved) storage.removeItemSync(oldKey);
  return saved;
}
