import type { TrainingEndReason } from './trainingTypes';

export function formatTrainingDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatTrainingEndReason(reason: TrainingEndReason): string {
  return {
    completed: '本次节奏已完成',
    user_stopped: '主动提前结束',
    discomfort: '因不适停止',
    interrupted: '训练中断',
  }[reason];
}
