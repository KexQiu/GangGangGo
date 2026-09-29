import { type ToiletTimerStage } from './toiletTypes';

export const TOILET_TIMER_TARGET_SECONDS = 20 * 60;

const TOILET_TIMER_CUE_SECONDS = [5 * 60, 10 * 60, 15 * 60, TOILET_TIMER_TARGET_SECONDS] as const;

export type ToiletLiveActivitySnapshot = {
  nextCueSeconds: number;
  stageKey: ToiletTimerStage;
  stageMessage: string;
  stageTitle: string;
  targetSeconds: number;
};

export function getToiletTimerStage(durationSeconds: number): ToiletTimerStage {
  if (durationSeconds >= 20 * 60) {
    return 'severe_warning';
  }

  if (durationSeconds >= 15 * 60) {
    return 'overtime';
  }

  if (durationSeconds >= 10 * 60) {
    return 'strong_warning';
  }

  if (durationSeconds >= 5 * 60) {
    return 'gentle_warning';
  }

  return 'normal';
}

export function getToiletStageCopy(stage: ToiletTimerStage): {
  description: string;
  title: string;
} {
  switch (stage) {
    case 'severe_warning':
      return {
        description: '已持续 20 分钟，请先结束，避免持续用力。',
        title: '请先结束如厕',
      };
    case 'gentle_warning':
      return {
        description: '已持续 5 分钟，办完就离开；没有便意时不必继续等。',
        title: '小花该下班了',
      };
    case 'strong_warning':
      return {
        description: '已持续 10 分钟，请先结束，避免长时间坐着或用力。',
        title: '别再加班了',
      };
    case 'overtime':
      return {
        description: '已持续 15 分钟，请先结束，稍后有便意再尝试。',
        title: '请先结束如厕',
      };
    case 'normal':
    default:
      return {
        description: '专心办正事，办完就收工。',
        title: '小花值班中',
      };
  }
}

export function getToiletLiveActivitySnapshot(durationSeconds: number): ToiletLiveActivitySnapshot {
  const normalizedSeconds = Math.max(0, Math.floor(durationSeconds));
  const stageKey = getToiletTimerStage(normalizedSeconds);
  const nextCueSeconds =
    TOILET_TIMER_CUE_SECONDS.find((cueSeconds) => cueSeconds > normalizedSeconds) ?? TOILET_TIMER_TARGET_SECONDS;

  return {
    nextCueSeconds,
    stageKey,
    targetSeconds: TOILET_TIMER_TARGET_SECONDS,
    ...getToiletLiveActivityStageCopy(stageKey),
  };
}

export function isLongToiletSession(durationSeconds: number): boolean {
  return durationSeconds >= 10 * 60;
}

export function formatToiletDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getToiletLiveActivityStageCopy(stage: ToiletTimerStage): {
  stageMessage: string;
  stageTitle: string;
} {
  switch (stage) {
    case 'severe_warning':
      return {
        stageMessage: '请先结束如厕',
        stageTitle: '请先结束如厕',
      };
    case 'gentle_warning':
      return {
        stageMessage: '小花该下班了',
        stageTitle: '小花该下班了',
      };
    case 'strong_warning':
      return {
        stageMessage: '别再加班了',
        stageTitle: '别再加班了',
      };
    case 'overtime':
      return {
        stageMessage: '请先结束如厕',
        stageTitle: '请先结束如厕',
      };
    case 'normal':
    default:
      return {
        stageMessage: '小花值班中',
        stageTitle: '小花值班中',
      };
  }
}
