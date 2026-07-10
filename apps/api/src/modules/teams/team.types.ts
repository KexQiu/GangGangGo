import type { TeamMember } from '@xiaotidu/contracts';

export type TeamRecord = {
  archivedAt: Date | null;
  id: string;
  name: string;
  ownerUserId: string;
};

export type MemberRecord = {
  displayName: null | string;
  id: string;
  joinedAt: Date | string;
  role: 'buddy' | 'owner';
  status: 'active' | 'paused' | 'removed';
  user: TeamMember['user'];
};
