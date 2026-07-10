import { z } from 'zod';

export const appleLoginRequestSchema = z.object({
  authorizationCode: z.string().optional(),
  identityToken: z.string().min(1),
  nickname: z.string().min(1).max(40).optional(),
});
