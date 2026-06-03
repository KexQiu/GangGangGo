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
        description: '已经超过 20 分钟了，给小花一点下班时间。',
        title: '真的该收工了',
      };
    case 'gentle_warning':
      return {
        description: '如果正事办完了，可以优雅收工。',
        title: '小声敲门',
      };
    case 'strong_warning':
      return {
        description: '正事办完就撤，别让局部压力加班。',
        title: '差不多该收工了',
      };
    case 'overtime':
      return {
        description: '这趟有点长，先收工，手机小剧场下次再播。',
        title: '蹲会儿长会了',
      };
    case 'normal':
    default:
      return {
        description: '专心办正事，手机先别开小剧场。',
        title: '刚刚蹲下',
      };
  }
}

export function getToiletLiveActivitySnapshot(durationSeconds: number): ToiletLiveActivitySnapshot {
  const normalizedSeconds = Math.max(0, Math.floor(durationSeconds));
  const stageKey = getToiletTimerStage(normalizedSeconds);
  const nextCueSeconds = TOILET_TIMER_CUE_SECONDS.find((cueSeconds) => cueSeconds > normalizedSeconds)
    ?? TOILET_TIMER_TARGET_SECONDS;

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
