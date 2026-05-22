import type { UserProfile } from '@xiaotidu/contracts';

export type CurrentUser = UserProfile & {
  appleUserId: string;
};

export const mockCurrentUser: CurrentUser = {
  appleUserId: 'mock-apple-user',
  avatarUrl: null,
  id: '00000000-0000-4000-8000-000000000001',
  nickname: '小提督用户',
  timezone: 'Asia/Shanghai',
};
