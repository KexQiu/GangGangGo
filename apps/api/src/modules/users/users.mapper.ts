import type { UserProfile } from '@xiaotidu/contracts';

import type { CurrentUser } from './userTypes.js';

export function toUserProfile(user: CurrentUser): UserProfile {
  return {
    avatarUrl: user.avatarUrl,
    id: user.id,
    nickname: user.nickname,
    timezone: user.timezone,
  };
}
