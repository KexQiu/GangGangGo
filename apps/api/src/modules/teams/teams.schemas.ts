import { z } from 'zod';

export const teamDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const teamMemberIdSchema = z.uuid();
export const teamInviteTokenSchema = z.string().min(16).max(256);
