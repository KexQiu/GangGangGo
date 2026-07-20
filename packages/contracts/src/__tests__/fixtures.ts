export const USER_A_ID = '00000000-0000-4000-8000-000000000001';
export const USER_B_ID = '00000000-0000-4000-8000-000000000002';
export const TEAM_ID = '00000000-0000-4000-8000-000000000010';
export const MEMBER_ID = '00000000-0000-4000-8000-000000000011';
export const NUDGE_ID = '00000000-0000-4000-8000-000000000020';
export const PUSH_TOKEN_ID = '00000000-0000-4000-8000-000000000030';
export const NOW = '2026-07-13T08:30:00.000Z';
export const LATER = '2026-07-13T09:00:00.000Z';
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

export const buddySummary = {
  avatarUrl: null,
  id: USER_B_ID,
  nickname: null,
};

export const userProfile = {
  ...userSummary,
  timezone: 'Asia/Shanghai',
};

export const dailyShareSnapshot = {
  date: DATE,
  habitCompletion: 4,
  streakDays: 7,
  toiletRecorded: true,
  trainingDone: false,
};

export const dailyReportSnapshot = {
  ...dailyShareSnapshot,
  toiletLongMeeting: false,
};

export const shareSettings = {
  paused: false,
  shareHabitCompletion: true,
  shareStreak: true,
  shareToiletRecorded: false,
  shareTraining: true,
};

export const teamMember = {
  displayName: '搭子',
  id: MEMBER_ID,
  joinedAt: NOW,
  role: 'owner',
  status: 'active',
  user: userSummary,
};

export const team = {
  id: TEAM_ID,
  members: [teamMember],
  name: '测试小队',
  ownerUserId: USER_A_ID,
};

export const nudgeAck = {
  createdAt: NOW,
  revisionCount: 0,
  status: 'received',
  updatedAt: NOW,
};

export const nudge = {
  ack: nudgeAck,
  createdAt: NOW,
  expiresAt: LATER,
  fromUser: userSummary,
  id: NUDGE_ID,
  messageTemplate: '起来动一动',
  teamId: TEAM_ID,
  toUser: buddySummary,
  type: 'move',
};

export const nudgeSettings = {
  buddyUserId: USER_B_ID,
  dailyLimit: 5,
  enabled: true,
  quietRanges: [{ end: '07:30', start: '23:00' }],
  teamId: TEAM_ID,
  userId: USER_A_ID,
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
