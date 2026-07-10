import type {
  BuddyNudgeAck,
  BuddyNudgeType,
  UserProfile,
} from '@xiaotidu/contracts';

export type NudgeRecord = {
  ack: BuddyNudgeAck | null;
  createdAt: Date;
  expiresAt: Date;
  fromUser: Pick<UserProfile, 'avatarUrl' | 'id' | 'nickname'>;
  id: string;
  messageTemplate: string;
  teamId: string;
  toUser: Pick<UserProfile, 'avatarUrl' | 'id' | 'nickname'>;
  type: BuddyNudgeType;
};

export type TeamMemberSummary = {
  role: 'buddy' | 'owner';
  status: 'active' | 'paused' | 'removed';
  user: Pick<UserProfile, 'avatarUrl' | 'id' | 'nickname'>;
};
