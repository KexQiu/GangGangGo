export type ProStatus = 'free' | 'pro_active' | 'pro_grace_period' | 'pro_expired';

export type ApiSuccessResponse<T> = {
  data: T;
};

export type ApiErrorCode =
  | 'bad_request'
  | 'conflict'
  | 'database_not_configured'
  | 'database_unreachable'
  | 'forbidden'
  | 'internal_error'
  | 'internal_server_error'
  | 'not_found'
  | 'rate_limited'
  | 'unauthorized'
  | 'validation_error';

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    details?: unknown;
    message: string;
  };
};

export type UserProfile = {
  avatarUrl: null | string;
  id: string;
  nickname: null | string;
  timezone: string;
};

export type UpdateUserProfileRequest = {
  avatarUrl?: null | string;
  nickname?: null | string;
  timezone?: string;
};

export type CreateAvatarUploadRequest = {
  contentLength: number;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
};

export type CreateAvatarUploadResponse = {
  expiresAt: string;
  objectKey: string;
  publicUrl: string;
  uploadMethod: 'mock_put' | 'presigned_put';
  uploadUrl: string;
};

export type AppleLoginRequest = {
  authorizationCode?: string;
  identityToken: string;
  nickname?: string;
};

export type AuthResponse = {
  token: string;
  user: UserProfile;
};

export type SubscriptionStatus = 'active' | 'grace_period' | 'expired' | 'revoked';

export type SubscriptionEnvironment = 'sandbox' | 'production';

export type AutoRenewStatus = 'on' | 'off' | 'unknown';

export type SubscriptionProductId = 'xiaotidu.pro.monthly' | 'xiaotidu.pro.yearly';

export type VerifySubscriptionRequest = {
  productId: SubscriptionProductId;
  transactionId: string;
};

export type RestoreSubscriptionRequest = {
  transactionIds: string[];
};

export type SubscriptionActionResponse = {
  entitlements: EntitlementsResponse;
  status: 'pending_verification';
};

export type BuddyNudgeType = 'gentle' | 'move' | 'not_blank' | 'habit_left' | 'posture';

export const BUDDY_NUDGE_TYPES = [
  'gentle',
  'move',
  'not_blank',
  'habit_left',
  'posture',
] as const satisfies readonly BuddyNudgeType[];

export type BuddyNudgeAckStatus = 'received' | 'later' | 'done';

export const BUDDY_NUDGE_ACK_STATUSES = ['received', 'later', 'done'] as const satisfies readonly BuddyNudgeAckStatus[];

export type BuddyNudgeDailyLimit = 0 | 3 | 5 | 8;

export const BUDDY_NUDGE_DAILY_LIMITS = [0, 3, 5, 8] as const satisfies readonly BuddyNudgeDailyLimit[];

export type QuietRange = {
  end: string;
  start: string;
};

export type DailyShareSnapshot = {
  date: string;
  habitCompletion: 0 | 1 | 2 | 3 | 4;
  streakDays: number;
  toiletRecorded: boolean;
  trainingDone: boolean;
};

export type UpsertDailyShareSnapshotRequest = {
  snapshot: DailyShareSnapshot;
};

export type DailyShareSnapshotResponse = {
  snapshot: DailyShareSnapshot;
};

export type TeamDailyShareSnapshot = {
  date: string;
  habitCompletion?: 0 | 1 | 2 | 3 | 4;
  streakDays?: number;
  toiletRecorded?: boolean;
  trainingDone?: boolean;
};

export type DailyReportSnapshot = DailyShareSnapshot & {
  habitFull: boolean;
  ninetyDayHabitFullDays: number;
  ninetyDayToiletLongMeetingCount: number;
  ninetyDayTrainingDays: number;
  thirtyDayHabitFullDays: number;
  thirtyDayToiletLongMeetingCount: number;
  thirtyDayTrainingDays: number;
  toiletLongMeeting: boolean;
  weeklyHabitFullDays: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  weeklyToiletLongMeetingCount: number;
  weeklyTrainingDays: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

export type UpsertDailyReportSnapshotRequest = {
  snapshot: DailyReportSnapshot;
};

export type DailyReportSnapshotResponse = {
  snapshot: DailyReportSnapshot;
};

export type TeamMemberRole = 'owner' | 'buddy';

export type TeamMemberStatus = 'active' | 'paused' | 'removed';

export type TeamMember = {
  displayName: null | string;
  id: string;
  joinedAt: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  user: Pick<UserProfile, 'avatarUrl' | 'id' | 'nickname'>;
};

export type Team = {
  id: string;
  members: TeamMember[];
  name: string;
  ownerUserId: string;
};

export type CreateTeamRequest = {
  name?: string;
};

export type UpdateTeamRequest = {
  name: string;
};

export type UpdateTeamMemberStatusRequest = {
  status: Extract<TeamMemberStatus, 'active' | 'paused'>;
};

export type TeamResponse = {
  team: null | Team;
};

export type CreateTeamInviteResponse = {
  expiresAt: string;
  inviteId: string;
  inviteUrl: string;
  token: string;
};

export type TeamInvitePreviewResponse = {
  expiresAt: string;
  inviterNickname: null | string;
  teamName: string;
};

export type AcceptTeamInviteRequest = {
  displayName?: string;
  shareSettings?: Partial<ShareSettings>;
};

export type AcceptTeamInviteResponse = TeamResponse;

export type ShareSettings = {
  paused: boolean;
  shareHabitCompletion: boolean;
  shareStreak: boolean;
  shareToiletRecorded: boolean;
  shareTraining: boolean;
};

export type ShareSettingsResponse = {
  settings: ShareSettings;
};

export type UpdateShareSettingsRequest = ShareSettings;

export type TeamSnapshot = {
  member: Pick<TeamMember, 'displayName' | 'id' | 'role' | 'status' | 'user'>;
  shareSettings: ShareSettings;
  snapshot: TeamDailyShareSnapshot | null;
};

export type TeamSnapshotsResponse = {
  date: string;
  snapshots: TeamSnapshot[];
};

export type BuddyNudgeSettings = {
  buddyUserId: string;
  dailyLimit: BuddyNudgeDailyLimit;
  enabled: boolean;
  quietRanges: QuietRange[];
  teamId: string;
  userId: string;
};

export type CreateBuddyNudgeRequest = {
  toUserId: string;
  type: BuddyNudgeType;
};

export type BuddyNudge = {
  ack: BuddyNudgeAck | null;
  createdAt: string;
  expiresAt: string;
  fromUser: Pick<UserProfile, 'avatarUrl' | 'id' | 'nickname'>;
  id: string;
  messageTemplate: string;
  teamId: string;
  toUser: Pick<UserProfile, 'avatarUrl' | 'id' | 'nickname'>;
  type: BuddyNudgeType;
};

export type BuddyNudgeAck = {
  createdAt: string;
  revisionCount: 0 | 1;
  status: BuddyNudgeAckStatus;
  updatedAt: string;
};

export type BuddyNudgeAckResponse = {
  ack: BuddyNudgeAck;
};

export type BuddyNudgesResponse = {
  nudges: BuddyNudge[];
};

export type AckBuddyNudgeRequest = {
  status: BuddyNudgeAckStatus;
};

export type BuddyNudgeSettingsResponse = {
  settings: BuddyNudgeSettings[];
};

export type UpdateBuddyNudgeSettingsRequest = {
  dailyLimit: BuddyNudgeDailyLimit;
  enabled: boolean;
  quietRanges: QuietRange[];
};

export type PushPlatform = 'android' | 'ios';

export type PushProvider = 'apns' | 'expo';

export type RegisterPushTokenRequest = {
  deviceId?: string;
  platform: PushPlatform;
  provider: PushProvider;
  token: string;
};

export type RegisterPushTokenResponse = {
  id: string;
};

export type AdvancedReportRange = '90d';

export type AdvancedReportResponse = {
  range: AdvancedReportRange;
  snapshot: DailyReportSnapshot | null;
};

export type TeamWeeklyReportResponse = {
  endedAt: string;
  memberCount: number;
  startedAt: string;
  summaries: Array<{
    habitFullDays: number;
    member: Pick<TeamMember, 'displayName' | 'id' | 'user'>;
    toiletRecordedDays: number;
    trainingDays: number;
  }>;
};

export type EntitlementsResponse = {
  proStatus: ProStatus;
};

export type ApiHealthResponse = {
  ok: true;
  service: 'xiaotidu-api';
  version: string;
};

export type DatabaseHealthResponse = {
  database: 'reachable';
  ok: true;
};
