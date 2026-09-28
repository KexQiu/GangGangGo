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
