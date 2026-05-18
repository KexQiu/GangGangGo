export type TrainingPresetId = 'beginner' | 'standard' | 'quick';

export type TrainingPhase = 'contract' | 'relax';

export type TrainingPreset = {
  id: TrainingPresetId;
  name: string;
  description: string;
  contractSeconds: number;
  relaxSeconds: number;
  repetitions: number;
};

export type TrainingStep = {
  phase: TrainingPhase;
  repetition: number;
  durationSeconds: number;
  startsAtSecond: number;
  endsAtSecond: number;
};

export type TrainingSession = {
  id: string;
  presetId: TrainingPresetId;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  completedRepetitions: number;
  isCompleted: boolean;
  discomfortReported: boolean;
};
