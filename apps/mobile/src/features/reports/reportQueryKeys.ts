export const reportQueryKeys = {
  advanced: (userId: string) => ['advanced-report', userId] as const,
  teamWeekly: (userId: string) => ['team-weekly-report', userId] as const,
};
