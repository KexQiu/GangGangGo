import { type HabitKey, type HabitLevel } from './habitTypes';

export type HabitLevelStandard = {
  description: string;
  label: string;
};

export type HabitStandard = {
  goodReference: string;
  levels: Record<HabitLevel, HabitLevelStandard>;
  quickTargetLabel: string;
  title: string;
};

export const habitStandards: Record<HabitKey, HabitStandard> = {
  bowel: {
    goodReference: '达标参考：少用力、用时短、没有明显痛或血。',
    levels: {
      good: {
        description: '少用力、用时短，没有明显痛或血。',
        label: '顺畅',
      },
      low: {
        description: '费力、偏硬、用时久，或者明显不舒服。',
        label: '困难',
      },
      medium: {
        description: '能排出来，但过程不够轻松。',
        label: '一般',
      },
    },
    quickTargetLabel: '少用力',
    title: '排便顺畅度',
  },
  fiber: {
    goodReference: '达标参考：至少 2 餐有蔬菜，再补水果、全谷或豆类之一。',
    levels: {
      good: {
        description: '至少 2 餐有蔬菜，并有水果、全谷或豆类之一。',
        label: '达标',
      },
      low: {
        description: '今天几乎没吃蔬果、全谷或豆类。',
        label: '不足',
      },
      medium: {
        description: '有 1 餐补到蔬菜、水果、全谷或豆类。',
        label: '一般',
      },
    },
    quickTargetLabel: '2 餐+',
    title: '膳食纤维',
  },
  movement: {
    goodReference: '达标参考：累计走动或活动约 30 分钟，也可以多次起身凑够。',
    levels: {
      good: {
        description: '累计走动或活动约 30 分钟，或多次起身透气。',
        label: '活动够',
      },
      low: {
        description: '连续久坐偏多，累计活动少于 10 分钟。',
        label: '久坐多',
      },
      medium: {
        description: '有起身或走动，累计大约 10-29 分钟。',
        label: '一般',
      },
    },
    quickTargetLabel: '30 分钟',
    title: '活动/走动',
  },
  water: {
    goodReference: '达标参考：8 杯左右，按约 200ml 一杯算，不用拿量杯审自己。',
    levels: {
      good: {
        description: '8 杯左右，少量多次更稳。',
        label: '达标',
      },
      low: {
        description: '0-3 杯，今天水分有点少。',
        label: '不足',
      },
      medium: {
        description: '4-7 杯，已经补了些水。',
        label: '一般',
      },
    },
    quickTargetLabel: '8 杯',
    title: '今日饮水',
  },
};

export function getHabitLevelStandard(key: HabitKey, level: HabitLevel): HabitLevelStandard {
  return habitStandards[key].levels[level];
}
