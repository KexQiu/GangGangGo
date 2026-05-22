import { type TrainingPreset, type TrainingStep } from './trainingTypes';

export function buildTrainingTimeline(preset: TrainingPreset): TrainingStep[] {
  const steps: TrainingStep[] = [];
  let cursor = 0;

  for (let repetition = 1; repetition <= preset.repetitions; repetition += 1) {
    steps.push({
      phase: 'contract',
      repetition,
      durationSeconds: preset.contractSeconds,
      startsAtSecond: cursor,
      endsAtSecond: cursor + preset.contractSeconds,
    });
    cursor += preset.contractSeconds;

    steps.push({
      phase: 'relax',
      repetition,
      durationSeconds: preset.relaxSeconds,
      startsAtSecond: cursor,
      endsAtSecond: cursor + preset.relaxSeconds,
    });
    cursor += preset.relaxSeconds;
  }

  return steps;
}

export function getTimelineTotalSeconds(timeline: TrainingStep[]): number {
  return timeline.at(-1)?.endsAtSecond ?? 0;
}

export function getCurrentTrainingStep(elapsedSeconds: number, timeline: TrainingStep[]): TrainingStep {
  const lastStep = timeline.at(-1);

  if (!lastStep) {
    throw new Error('Training timeline cannot be empty');
  }

  return timeline.find((step) => elapsedSeconds < step.endsAtSecond) ?? lastStep;
}

export function getStepRemainingSeconds(elapsedSeconds: number, step: TrainingStep): number {
  return Math.max(0, step.endsAtSecond - elapsedSeconds);
}

export function getCompletedRepetitions(elapsedSeconds: number, timeline: TrainingStep[]): number {
  return timeline.filter((step) => step.phase === 'relax' && elapsedSeconds >= step.endsAtSecond).length;
}

export function formatTrainingDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function getPhaseCopy(phase: TrainingStep['phase']): {
  safetyHint: string;
  title: string;
} {
  if (phase === 'contract') {
    return {
      safetyHint: '呼吸在线，轻轻提，不用猛。',
      title: '轻轻抬一下',
    };
  }

  return {
    safetyHint: '松到底，别让小花加班。',
    title: '好，放松',
  };
}
