import { z } from 'zod';

export const createTeamRequestSchema = z.object({
  name: z.string().min(1).max(40).optional(),
});

export const updateTeamRequestSchema = z.object({
  name: z.string().min(1).max(40),
});

export const updateTeamMemberStatusRequestSchema = z.object({
  status: z.union([z.literal('active'), z.literal('paused')]),
});

export const teamDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const teamMemberIdSchema = z.uuid();
export const teamInviteTokenSchema = z.string().min(16).max(256);

export const acceptTeamInviteRequestSchema = z.object({
  displayName: z.string().min(1).max(40).optional(),
  shareSettings: z
    .object({
      paused: z.boolean().optional(),
      shareHabitCompletion: z.boolean().optional(),
      shareStreak: z.boolean().optional(),
      shareToiletRecorded: z.boolean().optional(),
      shareTraining: z.boolean().optional(),
    })
    .optional(),
});

export const shareSettingsSchema = z.object({
  paused: z.boolean(),
  shareHabitCompletion: z.boolean(),
  shareStreak: z.boolean(),
  shareToiletRecorded: z.boolean(),
  shareTraining: z.boolean(),
});

const dailyShareSnapshotSchema = z.object({
  date: teamDateSchema,
  habitCompletion: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  streakDays: z.number().int().min(0),
  toiletRecorded: z.boolean(),
  trainingDone: z.boolean(),
});

export const upsertDailyShareSnapshotSchema = z.object({
  snapshot: dailyShareSnapshotSchema,
});
