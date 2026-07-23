export const friendQueryKeys = {
  all: ['friends'] as const,
  data: (userId: string, friendUserId: string) => ['friends', userId, friendUserId, 'data'] as const,
  detail: (userId: string, friendUserId: string) => ['friends', userId, friendUserId, 'detail'] as const,
  events: (userId: string, friendUserId: string) => ['friends', userId, friendUserId, 'events'] as const,
  invite: (token: string) => ['friend-invite', token] as const,
  list: (userId: string) => ['friends', userId, 'list'] as const,
};
