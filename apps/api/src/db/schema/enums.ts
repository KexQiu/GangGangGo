import { pgEnum } from 'drizzle-orm/pg-core';

export const subscriptionEnvironmentEnum = pgEnum('subscription_environment', ['sandbox', 'production']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'grace_period', 'expired', 'revoked']);
export const autoRenewStatusEnum = pgEnum('auto_renew_status', ['on', 'off', 'unknown']);
export const friendDataLevelEnum = pgEnum('friend_data_level', ['none', 'summary', 'detailed']);
export const friendEventKindEnum = pgEnum('friend_event_kind', ['manual_nudge', 'toilet_finished']);
export const friendNudgeTypeEnum = pgEnum('friend_nudge_type', [
  'gentle',
  'move',
  'not_blank',
  'habit_left',
  'posture',
]);
export const friendNudgeAckStatusEnum = pgEnum('friend_nudge_ack_status', ['received', 'later', 'done']);
export const pushPlatformEnum = pgEnum('push_platform', ['ios', 'android']);
export const pushProviderEnum = pgEnum('push_provider', ['expo', 'apns']);
