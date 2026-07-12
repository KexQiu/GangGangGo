export const queryKeys = {
  advancedReport: (userId: string) => ['advanced-report', userId] as const,
  invitePreview: (token: string) => ['invite-preview', token] as const,
  nudgeInbox: (userId: string) => ['nudge-inbox', userId] as const,
  nudgeSent: (userId: string) => ['nudge-sent', userId] as const,
  nudgeThreads: (userId: string) => ['nudge-threads', userId] as const,
  nudgeThread: (userId: string, buddyUserId: string) => ['nudge-thread', userId, buddyUserId] as const,
  team: (userId: string) => ['team', userId] as const,
  teamSnapshots: (userId: string) => ['team-snapshots', userId] as const,
  teamWeeklyReport: (userId: string) => ['team-weekly-report', userId] as const,
};
