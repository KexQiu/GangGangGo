export type ProStatus = 'free' | 'pro_active' | 'pro_grace_period' | 'pro_expired';

export type BuddyNudgeType = 'gentle' | 'move' | 'not_blank' | 'habit_left' | 'posture';

export type BuddyNudgeAckStatus = 'received' | 'later' | 'done';

export const BUDDY_NUDGE_ACK_STATUSES = ['received', 'later', 'done'] as const satisfies readonly BuddyNudgeAckStatus[];

export type DailyShareSnapshot = {
  date: string;
  habitCompletion: 0 | 1 | 2 | 3 | 4;
  streakDays: number;
  toiletRecorded: boolean;
  trainingDone: boolean;
};

export type TeamMemberRole = 'owner' | 'buddy';

export type TeamMemberStatus = 'active' | 'paused' | 'removed';

export type EntitlementsResponse = {
  proStatus: ProStatus;
};

export type ApiHealthResponse = {
  ok: true;
  service: 'xiaotidu-api';
  version: string;
};
