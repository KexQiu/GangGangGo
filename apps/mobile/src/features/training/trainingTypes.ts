import type { TrainingPresetId, TrainingParameters, TrainingFeedback, TrainingEndReason } from '@xiaotidu/contracts';
export type { TrainingPresetId, TrainingParameters, TrainingFeedback, TrainingEndReason } from '@xiaotidu/contracts';
export type TrainingPreset = TrainingParameters & { id: TrainingPresetId; name: string; description: string };
export type TrainingSession = {
  id: string;
  presetId: TrainingPresetId;
  plan: TrainingParameters;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  completedRepetitions: number;
  isCompleted: boolean;
  feedback: TrainingFeedback;
  endReason: TrainingEndReason;
};
