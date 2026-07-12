import { z } from 'zod';

export {
  acceptTeamInviteRequestSchema,
  createTeamRequestSchema,
  shareSettingsSchema,
  updateTeamMemberStatusRequestSchema,
  updateTeamRequestSchema,
  upsertDailyShareSnapshotRequestSchema as upsertDailyShareSnapshotSchema,
} from '@xiaotidu/contracts';

export const teamDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const teamMemberIdSchema = z.uuid();
export const teamInviteTokenSchema = z.string().min(16).max(256);
