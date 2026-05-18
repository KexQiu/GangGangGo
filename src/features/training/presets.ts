import { type TrainingPreset, type TrainingPresetId } from './trainingTypes';

export const trainingPresets: TrainingPreset[] = [
  {
    id: 'beginner',
    name: '新手模式',
    description: '适合第一次营业，慢慢来，不抢进度。',
    contractSeconds: 3,
    relaxSeconds: 3,
    repetitions: 10,
  },
  {
    id: 'standard',
    name: '标准模式',
    description: '适合日常小练，稳稳抬起，认真放下。',
    contractSeconds: 5,
    relaxSeconds: 5,
    repetitions: 12,
  },
  {
    id: 'quick',
    name: '快速模式',
    description: '时间不多时来一组，短平快，不拖堂。',
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
