import type {
  FriendSharedDay,
  HabitCheckInSyncPayload,
  ToiletSessionSyncPayload,
  ToiletSignalPresetSyncPayload,
  TrainingSessionSyncPayload,
} from '@xiaotidu/contracts';

// 字段与实际契约逐项对应；新增同步/共享字段时，类型检查要求同步补充说明。
export const syncDisclosureFields = {
  training: {
    presetId: '训练方案',
    startedAt: '起止时间',
    endedAt: '起止时间',
    localDate: '记录日期',
    durationSeconds: '时长',
    completedRepetitions: '完成次数',
    isCompleted: '完成状态',
    discomfortReported: '不适反馈',
  } satisfies Record<keyof TrainingSessionSyncPayload, string>,
  habit: {
    date: '记录日期',
    water: '饮水等级',
    fiber: '膳食纤维等级',
    movement: '活动等级',
    bowel: '排便习惯等级',
  } satisfies Record<keyof HabitCheckInSyncPayload, string>,
  toilet: {
    startedAt: '起止时间',
    endedAt: '起止时间',
    localDate: '记录日期',
    durationSeconds: '具体时长',
    feeling: '排便感受',
    discomfort: '不适',
    bleeding: '便血',
    stoolShape: '形状',
    stoolColor: '颜色',
    signals: '自定义小信号文字',
  } satisfies Record<keyof ToiletSessionSyncPayload, string>,
  signalPresets: { label: '常用小信号文字', createdAt: '创建时间' } satisfies Record<
    keyof ToiletSignalPresetSyncPayload,
    string
  >,
};

type SharedFields<Kind extends 'training' | 'habit' | 'toilet', Level extends 'summary' | 'detailed'> = Record<
  Exclude<keyof Extract<FriendSharedDay[Kind], { level: Level }>, 'level'>,
  string
>;

export const friendDisclosureFields = {
  training: {
    summary: { trainingDone: '当天是否达标' } satisfies SharedFields<'training', 'summary'>,
    detailed: {
      trainingDone: '当天是否达标',
      completedSessionCount: '完成组数',
      completedRepetitions: '完成次数',
      totalDurationSeconds: '总训练时长',
    } satisfies SharedFields<'training', 'detailed'>,
  },
  habit: {
    summary: { completionCount: '当天记录项数', streakDays: '连续记满四项的天数' } satisfies SharedFields<
      'habit',
      'summary'
    >,
    detailed: {
      completionCount: '当天记录项数',
      streakDays: '连续记满四项的天数',
      water: '饮水等级',
      fiber: '膳食纤维等级',
      movement: '活动等级',
      bowel: '排便习惯等级',
    } satisfies SharedFields<'habit', 'detailed'>,
  },
  toilet: {
    summary: { toiletRecorded: '当天是否有记录' } satisfies SharedFields<'toilet', 'summary'>,
    detailed: {
      toiletRecorded: '当天是否有记录',
      sessionCount: '记录次数',
      totalDurationSeconds: '总时长',
      medianDurationSeconds: '时长中位数',
      maxDurationSeconds: '最长时长',
      longSessionCount: '达到10分钟的次数',
      feelingCounts: '各感受次数',
      shapeCounts: '各形状次数',
      colorCounts: '各颜色次数',
      attentionCount: '需留意次数',
      signalCounts: '自定义小信号原文及各自出现次数',
    } satisfies SharedFields<'toilet', 'detailed'>,
  },
};

export function describeDisclosureFields(fields: Record<string, string>) {
  return [...new Set(Object.values(fields))].join('、');
}
