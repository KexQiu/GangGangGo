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
        description: '超过 20 分钟了，建议先结束。',
        title: '小花过劳了',
      };
    case 'gentle_warning':
      return {
        description: '5 分钟到了，如果已经办完，可以收工。',
        title: '小花该下班了',
      };
    case 'strong_warning':
      return {
        description: '10 分钟到了，建议准备结束。',
        title: '别再加班了',
      };
    case 'overtime':
      return {
        description: '时间偏久，先站起来活动一下。',
        title: '小花过劳了',
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
  return durationSeconds >= 15 * 60;
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
        stageMessage: '小花过劳了',
        stageTitle: '小花过劳了',
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
        stageMessage: '小花过劳了',
        stageTitle: '小花过劳了',
      };
    case 'normal':
    default:
      return {
        stageMessage: '小花值班中',
        stageTitle: '小花值班中',
      };
  }
}
