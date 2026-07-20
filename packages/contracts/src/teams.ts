import { z } from 'zod';

import { isoDateSchema, isoDateTimeSchema } from './common.js';
import { userSummarySchema } from './users.js';

export const habitCompletionSchema = z.number().int().min(0).max(4);
export const dailyShareSnapshotSchema = z
  .object({
    date: isoDateSchema,
    habitCompletion: habitCompletionSchema,
    streakDays: z.number().int().min(0),
    toiletRecorded: z.boolean(),
    trainingDone: z.boolean(),
  })
  .strict()
  .meta({ id: 'DailyShareSnapshot' });
export type DailyShareSnapshot = z.infer<typeof dailyShareSnapshotSchema>;

export const upsertDailyShareSnapshotRequestSchema = z
  .object({ snapshot: dailyShareSnapshotSchema })
  .strict()
  .meta({ id: 'UpsertDailyShareSnapshotRequest' });
export type UpsertDailyShareSnapshotRequest = z.infer<typeof upsertDailyShareSnapshotRequestSchema>;
export const dailyShareSnapshotResponseSchema = z
  .object({ snapshot: dailyShareSnapshotSchema })
  .meta({ id: 'DailyShareSnapshotResponse' });
export type DailyShareSnapshotResponse = z.infer<typeof dailyShareSnapshotResponseSchema>;

export const teamMemberRoleSchema = z.enum(['owner', 'buddy']);
export const teamMemberStatusSchema = z.enum(['active', 'paused', 'removed']);
export type TeamMemberRole = z.infer<typeof teamMemberRoleSchema>;
export type TeamMemberStatus = z.infer<typeof teamMemberStatusSchema>;

export const teamMemberSchema = z
  .object({
    displayName: z.string().nullable(),
    id: z.string().uuid(),
    joinedAt: isoDateTimeSchema,
    role: teamMemberRoleSchema,
    status: teamMemberStatusSchema,
    user: userSummarySchema,
  })
  .meta({ id: 'TeamMember' });
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const teamSchema = z
  .object({
    id: z.string().uuid(),
    members: z.array(teamMemberSchema),
    name: z.string(),
    ownerUserId: z.string().uuid(),
  })
  .meta({ id: 'Team' });
export type Team = z.infer<typeof teamSchema>;
export const teamResponseSchema = z.object({ team: teamSchema.nullable() }).meta({ id: 'TeamResponse' });
export type TeamResponse = z.infer<typeof teamResponseSchema>;

export const createTeamRequestSchema = z
  .object({ name: z.string().min(1).max(40).optional() })
  .strict()
  .meta({ id: 'CreateTeamRequest' });
export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;
export const updateTeamRequestSchema = z
  .object({ name: z.string().min(1).max(40) })
  .strict()
  .meta({ id: 'UpdateTeamRequest' });
export type UpdateTeamRequest = z.infer<typeof updateTeamRequestSchema>;
export const updateTeamMemberStatusRequestSchema = z
  .object({ status: z.enum(['active', 'paused']) })
  .strict()
  .meta({ id: 'UpdateTeamMemberStatusRequest' });
export type UpdateTeamMemberStatusRequest = z.infer<typeof updateTeamMemberStatusRequestSchema>;

export const shareSettingsSchema = z
  .object({
    paused: z.boolean(),
    shareHabitCompletion: z.boolean(),
    shareStreak: z.boolean(),
    shareToiletRecorded: z.boolean(),
    shareTraining: z.boolean(),
  })
  .strict()
  .meta({ id: 'ShareSettings' });
export type ShareSettings = z.infer<typeof shareSettingsSchema>;
export const shareSettingsResponseSchema = z
  .object({ settings: shareSettingsSchema })
  .meta({ id: 'ShareSettingsResponse' });
export type ShareSettingsResponse = z.infer<typeof shareSettingsResponseSchema>;
export type UpdateShareSettingsRequest = ShareSettings;

export const createTeamInviteResponseSchema = z
  .object({
    expiresAt: isoDateTimeSchema,
    inviteId: z.string().uuid(),
    inviteUrl: z.string().url(),
    token: z.string(),
  })
  .meta({ id: 'CreateTeamInviteResponse' });
export type CreateTeamInviteResponse = z.infer<typeof createTeamInviteResponseSchema>;
export const teamInvitePreviewResponseSchema = z
  .object({
    expiresAt: isoDateTimeSchema,
    inviterNickname: z.string().nullable(),
    teamName: z.string(),
  })
  .meta({ id: 'TeamInvitePreviewResponse' });
export type TeamInvitePreviewResponse = z.infer<typeof teamInvitePreviewResponseSchema>;
export const acceptTeamInviteRequestSchema = z
  .object({
    displayName: z.string().min(1).max(40).optional(),
    shareSettings: shareSettingsSchema.partial().optional(),
  })
  .strict()
  .meta({ id: 'AcceptTeamInviteRequest' });
export type AcceptTeamInviteRequest = z.infer<typeof acceptTeamInviteRequestSchema>;
export type AcceptTeamInviteResponse = TeamResponse;

export const teamDailyShareSnapshotSchema = dailyShareSnapshotSchema.partial().required({ date: true });
export type TeamDailyShareSnapshot = z.infer<typeof teamDailyShareSnapshotSchema>;
export const teamSnapshotSchema = z.object({
  member: teamMemberSchema.pick({ displayName: true, id: true, role: true, status: true, user: true }),
  shareSettings: shareSettingsSchema,
  snapshot: teamDailyShareSnapshotSchema.nullable(),
});
export type TeamSnapshot = z.infer<typeof teamSnapshotSchema>;
export const teamSnapshotsResponseSchema = z
  .object({ date: isoDateSchema, snapshots: z.array(teamSnapshotSchema) })
  .meta({ id: 'TeamSnapshotsResponse' });
export type TeamSnapshotsResponse = z.infer<typeof teamSnapshotsResponseSchema>;
