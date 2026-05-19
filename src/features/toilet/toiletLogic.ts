import { type ToiletTimerStage } from './toiletTypes';

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
        description: '已经超过 20 分钟了。先收工，别让小花继续陪坐。',
        title: '真的该收工了',
      };
    case 'gentle_warning':
      return {
        description: '如果正事办完了，可以优雅收工。',
        title: '小声敲门',
      };
    case 'strong_warning':
      return {
        description: '建议尽快结束，别让局部压力陪你加班。',
        title: '差不多该收工了',
      };
    case 'overtime':
      return {
        description: '这次坐得有点久。如果经常这样，建议关注饮水、膳食纤维和排便习惯。',
        title: '这会儿有点长了',
      };
    case 'normal':
    default:
      return {
        description: '专心办正事，手机先别开小剧场。',
        title: '刚刚蹲下',
      };
  }
}

export function isLongToiletSession(durationSeconds: number): boolean {
  return durationSeconds >= 15 * 60;
}

export function formatToiletDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
