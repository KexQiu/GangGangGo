import { type HabitKey, type HabitLevel, type HabitRecordLevel } from './habitTypes';

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
    goodReference: '按今天的实际感受记录，不必每天排便；没有排便时可单独记录。便血或持续疼痛应就医评估。',
    levels: {
      good: {
        description: '排便轻松，不需要明显用力，也没有疼痛。便血请另行记录并咨询医生。',
        label: '顺畅',
      },
      low: {
        description: '费力、偏硬、用时久，或者疼痛或不适。',
        label: '困难',
      },
      medium: {
        description: '能排出来，但过程不够轻松。',
        label: '一般',
      },
    },
    quickTargetLabel: '按实际填写',
    title: '排便情况',
  },
  fiber: {
    goodReference: '粗略记录饮食构成，不估算纤维是否充足。摄入量同样重要，可逐步增加蔬果、全谷和豆类。',
    levels: {
      good: {
        description: '至少 2 餐有蔬菜，并有水果、全谷或豆类之一。',
        label: '较丰富',
      },
      low: {
        description: '今天几乎没吃蔬果、全谷或豆类。',
        label: '较少',
      },
      medium: {
        description: '吃到一些蔬菜、水果、全谷或豆类，还未达到“较丰富”所描述的组合。',
        label: '有一些',
      },
    },
    quickTargetLabel: '较丰富',
    title: '蔬果与全谷',
  },
  movement: {
    goodReference: '记录走动和活动的累计时长，多次活动可相加。起身有益，但本项不判断整体运动量是否充足。',
    levels: {
      good: {
        description: '今天累计走动或活动至少 30 分钟；短暂起身只计入实际活动时间。',
        label: '30分钟及以上',
      },
      low: {
        description: '今天累计走动或活动少于 10 分钟。活动时长不能单独反映久坐时间。',
        label: '少于10分钟',
      },
      medium: {
        description: '有起身或走动，累计大约 10-29 分钟。',
        label: '10–29分钟',
      },
    },
    quickTargetLabel: '至少30分钟',
    title: '活动/走动',
  },
  water: {
    goodReference:
      '按约 200 mL 一杯粗略记录。温和气候、低活动量成人饮水参考约 1500–1700 mL/天；需求因人而异，限液者按医嘱。',
    levels: {
      good: {
        description: '今天约 8 杯或更多。这个分档不表示越多越好，也不是适合所有人的饮水目标。',
        label: '8杯及以上',
      },
      low: {
        description: '今天约 0–3 杯。是否需要增加饮水，应结合个人情况或医嘱。',
        label: '0–3杯',
      },
      medium: {
        description: '今天约 4–7 杯。这是记录分档，不代表饮水不足。',
        label: '4–7杯',
      },
    },
    quickTargetLabel: '8杯及以上',
    title: '今日饮水',
  },
};

export const noBowelMovementStandard: HabitLevelStandard = {
  label: '今日未排便',
  description:
    '今天没有排便也可以如实记录，一天未排便本身不等于便秘。若频率持续改变、排便费力或伴疼痛、便血，请咨询医生。',
};

export function getHabitLevelStandard(key: HabitKey, level: HabitRecordLevel): HabitLevelStandard {
  if (level === 'not_today') return noBowelMovementStandard;
  return habitStandards[key].levels[level];
}
