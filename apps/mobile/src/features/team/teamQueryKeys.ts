export const teamQueryKeys = {
  invitePreview: (token: string) => ['invite-preview', token] as const,
  team: (userId: string) => ['team', userId] as const,
  teamSnapshots: (userId: string) => ['team-snapshots', userId] as const,
};
