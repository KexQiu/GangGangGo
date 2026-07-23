export const USER_A_ID = '00000000-0000-4000-8000-000000000001';
export const PUSH_TOKEN_ID = '00000000-0000-4000-8000-000000000030';
export const NOW = '2026-07-13T08:30:00.000Z';
export const DATE = '2026-07-13';

export const avatarConfig = {
  background: 'leaf',
  emoji: 'smile',
} as const;

export const userSummary = {
  avatarUrl: avatarConfig,
  id: USER_A_ID,
  nickname: '小A',
};

export const userProfile = {
  ...userSummary,
  timezone: 'Asia/Shanghai',
};

export const dailyReportSnapshot = {
  date: DATE,
  habitCompletion: 4,
  streakDays: 7,
  toiletLongMeeting: false,
  toiletRecorded: true,
  trainingDone: false,
};

export const advancedReportDay = {
  date: DATE,
  habitCompletion: 4,
  habitFull: true,
  toiletLongMeeting: false,
  toiletRecorded: true,
  trainingDone: false,
};

export const advancedReportSummary = {
  currentStreakDays: 7,
  habitFullDays: 1,
  hasAnyRecord: true,
  recordDays: 1,
  toiletLongMeetingCount: 0,
  toiletRecordDays: 1,
  trainingDays: 0,
};
