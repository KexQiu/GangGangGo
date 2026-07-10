import { pgEnum } from 'drizzle-orm/pg-core';

export const subscriptionEnvironmentEnum = pgEnum('subscription_environment', ['sandbox', 'production']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'grace_period',
  'expired',
  'revoked',
]);
export const autoRenewStatusEnum = pgEnum('auto_renew_status', ['on', 'off', 'unknown']);
export const teamMemberRoleEnum = pgEnum('team_member_role', ['owner', 'buddy']);
export const teamMemberStatusEnum = pgEnum('team_member_status', ['active', 'paused', 'removed']);
export const buddyNudgeTypeEnum = pgEnum('buddy_nudge_type', [
  'gentle',
  'move',
  'not_blank',
  'habit_left',
  'posture',
]);
export const buddyNudgeAckStatusEnum = pgEnum('buddy_nudge_ack_status', ['received', 'later', 'done']);
export const pushPlatformEnum = pgEnum('push_platform', ['ios', 'android']);
export const pushProviderEnum = pgEnum('push_provider', ['expo', 'apns']);
