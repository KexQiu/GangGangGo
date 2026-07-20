export const nudgeQueryKeys = {
  settings: (userId: string) => ['nudge-settings', userId] as const,
  thread: (userId: string, buddyUserId: string) => ['nudge-thread', userId, buddyUserId] as const,
  threads: (userId: string) => ['nudge-threads', userId] as const,
};
