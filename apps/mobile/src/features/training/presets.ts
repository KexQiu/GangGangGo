import { type TrainingPreset, type TrainingPresetId } from './trainingTypes';

export const trainingPresets: TrainingPreset[] = [
  {
    id: 'beginner',
    name: '3 秒节奏',
    description: '收缩与放松各 3 秒。不必凑满次数，以能轻松完成为准。',
    contractSeconds: 3,
    relaxSeconds: 3,
    repetitions: 10,
  },
  {
    id: 'standard',
    name: '5 秒节奏',
    description: '收缩与放松各 5 秒。仅在适合自己且能充分放松时选择。',
    contractSeconds: 5,
    relaxSeconds: 5,
    repetitions: 12,
  },
  {
    id: 'quick',
    name: '短收缩节奏',
    description: '收缩与放松各 1 秒。这是另一种节奏，不等同于较长节奏的训练量。',
    contractSeconds: 1,
    relaxSeconds: 1,
    repetitions: 16,
  },
];

export function getTrainingPreset(presetId: string | undefined): TrainingPreset {
  return trainingPresets.find((preset) => preset.id === presetId) ?? trainingPresets[0];
}

export function isTrainingPresetId(value: string | undefined): value is TrainingPresetId {
  return trainingPresets.some((preset) => preset.id === value);
}
